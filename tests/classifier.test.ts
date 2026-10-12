import { describe, expect, it } from 'vitest';
import { applyGuards, classify, hookSupported, parseResponse, type ClassifyInput, type GenerateFn } from '@/lib/classifier';

const input = (item_id: number, vc_id = 'vc1'): ClassifyInput => ({
  item_id, vc_id, vc_name: 'A B', vc_firm: 'F', vc_aliases: [], firm_aliases: [], title: 't', snippet: null, source: 'google_news',
});
const label = (item_id: number, o: Record<string, unknown> = {}) => ({
  item_id, about_this_vc: true, confidence: 0.9, subject: 'firm', signal_type: 'investment', relevance_level: 'adjacent',
  possible_competitor: false, competitor_evidence: null, funded_company: null, role_change_hint: null, event_key: 'e', summary: 's', hook: null, ...o,
});
const opts = (generate: GenerateFn, keys = ['k1'], myProduct = 'TMS SaaS') => ({ keys, model: 'm', persona: { targetSpace: 'logistics software', myProduct }, generate, backoffMs: [1, 1, 1] });

describe('classifier', () => {
  it('zod rejects malformed output', () => {
    expect(parseResponse('not json')).toBeNull();
    expect(parseResponse(JSON.stringify({ items: [label(1, { confidence: 2 })] }))).toBeNull();
    expect(parseResponse(JSON.stringify({ items: [label(1, { signal_type: 'gossip' })] }))).toBeNull();
    expect(parseResponse(JSON.stringify({ items: [label(1, { relevance_level: 'somewhat' })] }))).toBeNull();
    expect(parseResponse(JSON.stringify({ items: [label(1)] }))).not.toBeNull();
  });

  it('ignores unknown and repeated item ids; missing ids become unclassified', async () => {
    const gen: GenerateFn = async () => JSON.stringify({ items: [label(1), label(1, { confidence: 0.1 }), label(99)] });
    const r = await classify([input(1), input(2)], opts(gen));
    expect(r.updates.map((u) => u.id)).toEqual([1]);
    expect(r.updates[0].status).toBe('accepted');
    expect(r.unclassified).toEqual([2]);
  });

  it('applies acceptance: about_this_vc, confidence ≥ 0.7, not irrelevant', async () => {
    const gen: GenerateFn = async () => JSON.stringify({ items: [
      label(1, { confidence: 0.69 }), label(2, { about_this_vc: false }), label(3, { signal_type: 'irrelevant' }), label(4),
    ] });
    const r = await classify([1, 2, 3, 4].map((i) => input(i)), opts(gen));
    expect(r.updates.map((u) => [u.id, u.status, u.reject_reason])).toEqual([
      [1, 'rejected', 'llm_low_confidence'], [2, 'rejected', 'llm_not_about_vc'], [3, 'rejected', 'llm_irrelevant'], [4, 'accepted', null],
    ]);
  });

  it('retries invalid JSON once, then marks items unclassified', async () => {
    let calls = 0;
    const gen: GenerateFn = async () => { calls++; return '{bad'; };
    const r = await classify([input(1)], opts(gen));
    expect(calls).toBe(2);
    expect(r.unclassified).toEqual([1]);
    expect(r.failedVcIds).toEqual([]);
  });

  it('fails the batch VCs after 429 retries', async () => {
    const gen: GenerateFn = async () => { throw Object.assign(new Error('quota'), { status: 429 }); };
    const r = await classify([input(1, 'vcA'), input(2, 'vcB')], opts(gen));
    expect(r.calls).toBe(4);
    expect(r.http429).toBe(4);
    expect(r.failedVcIds.sort()).toEqual(['vcA', 'vcB']);
    expect(r.updates).toEqual([]);
  });

  it('rotates to the fallback key on 401', async () => {
    const used: string[] = [];
    const gen: GenerateFn = async ({ apiKey }) => {
      used.push(apiKey);
      if (apiKey === 'bad') throw Object.assign(new Error('unauth'), { status: 401 });
      return JSON.stringify({ items: [label(1)] });
    };
    const r = await classify([input(1)], opts(gen, ['bad', 'good']));
    expect(used).toEqual(['bad', 'good']);
    expect(r.updates).toHaveLength(1);
  });
  it('competitor guard clears flags whose evidence is not verbatim in the text', async () => {
    const it2 = (title: string): ClassifyInput => ({ ...input(1), title });
    const gen = (o: Record<string, unknown>): GenerateFn => async () => JSON.stringify({ items: [label(1, o)] });
    let r = await classify([it2('SuperProcure, a Unified TMS Platform, secures funding')], opts(gen({ possible_competitor: true, competitor_evidence: 'Unified TMS Platform', funded_company: 'SuperProcure' })));
    expect(r.updates[0]).toMatchObject({ possible_competitor: true, competitor_evidence: 'Unified TMS Platform', funded_company: 'SuperProcure' });
    r = await classify([it2('CargoFL raises seed round')], opts(gen({ possible_competitor: true, competitor_evidence: 'freight procurement platform', funded_company: 'Cargo FL Inc' })));
    expect(r.updates[0]).toMatchObject({ possible_competitor: false, competitor_evidence: null, funded_company: null });
  });

  it('applyGuards keeps funded_company only when it is in the text', () => {
    const l = { ...label(1), relevance: 0.4, funded_company: 'Yantra Packs' } as never;
    expect(applyGuards(l, { title: 'Yantra Packs raises Rs 12 Cr', snippet: null }).funded_company).toBe('Yantra Packs');
    expect(applyGuards(l, { title: 'Packaging startup raises Rs 12 Cr', snippet: null }).funded_company).toBeNull();
  });

  it('relevance floor rejects with llm_low_relevance', async () => {
    const gen: GenerateFn = async () => JSON.stringify({ items: [label(1, { relevance_level: 'unrelated' })] });
    const r = await classify([input(1)], { ...opts(gen), thresholds: { minConfidence: 0.7, minRelevance: 0.2 } });
    expect(r.updates[0]).toMatchObject({ status: 'rejected', reject_reason: 'llm_low_relevance' });
  });

  it('maps relevance_level to 1.0 / 0.7 / 0.4 / 0.1 and stores both', async () => {
    const levels = ['core', 'logistics_non_software', 'adjacent', 'unrelated'] as const;
    const gen: GenerateFn = async () => JSON.stringify({ items: levels.map((lv, i) => label(i + 1, { relevance_level: lv })) });
    const r = await classify(levels.map((_, i) => input(i + 1)), opts(gen));
    expect(r.updates.map((u) => [u.relevance_level, u.relevance])).toEqual([['core', 1], ['logistics_non_software', 0.7], ['adjacent', 0.4], ['unrelated', 0.1]]);
  });

  it('an empty my_product never yields a competitor flag', async () => {
    const it2: ClassifyInput = { ...input(1), title: 'SuperProcure, a Unified TMS Platform, secures funding' };
    const gen: GenerateFn = async () => JSON.stringify({ items: [label(1, { possible_competitor: true, competitor_evidence: 'Unified TMS Platform' })] });
    expect((await classify([it2], opts(gen, ['k1'], 'TMS SaaS'))).updates[0].possible_competitor).toBe(true);
    expect((await classify([it2], opts(gen, ['k1'], '   '))).updates[0]).toMatchObject({ possible_competitor: false, competitor_evidence: null });
  });

  it('the prompt separates target space (relevance) from product (competitor)', async () => {
    let system = '';
    const gen: GenerateFn = async (a) => { system = a.system; return JSON.stringify({ items: [label(1)] }); };
    await classify([input(1)], opts(gen, ['k1'], ''));
    expect(system).toContain("Founder's target space (judge relevance_level against this only): logistics software");
    expect(system).toContain('(none: always set possible_competitor to false)');
  });

  it('hook guard: names and numbers must come from the item, VC name, aliases or firm', () => {
    const support = 'Yantra Packs raises Rs 12 crore seed from Caret Capital Prajakt Raut';
    expect(hookSupported('Saw that Caret Capital backed Yantra Packs in its Rs 12 crore seed round.', support)).toBe(true);
    expect(hookSupported('Congrats on leading the Yantra Packs round, Prajakt.', support)).toBe(true);
    expect(hookSupported('Saw that Caret Capital backed Delhivery last week.', support)).toBe(false); // unsupported name
    expect(hookSupported('Congrats on the Rs 50 crore round.', support)).toBe(false);                 // unsupported number
    expect(hookSupported('Read your take. Yantra Packs looks strong.', support)).toBe(true);          // sentence-initial exempt
  });

  it('drops unsupported hooks and never keeps a hook on a rejected item', async () => {
    const it2: ClassifyInput = { ...input(1), title: 'Yantra Packs raises Rs 12 crore', vc_name: 'Prajakt Raut', vc_firm: 'Caret Capital' };
    const run = async (o: Record<string, unknown>) => (await classify([it2], opts(async () => JSON.stringify({ items: [label(1, o)] })))).updates[0];
    expect((await run({ hook: 'Saw Caret Capital backed Yantra Packs with Rs 12 crore.' })).hook).toBe('Saw Caret Capital backed Yantra Packs with Rs 12 crore.');
    expect((await run({ hook: 'Saw Sequoia backed Yantra Packs.' })).hook).toBeNull();
    expect((await run({ hook: 'Saw Caret Capital backed Yantra Packs.', about_this_vc: false })).hook).toBeNull();
    expect((await run({ hook: 'Saw Caret Capital backed Yantra Packs.', confidence: 0.3 })).hook).toBeNull();
  });
});
