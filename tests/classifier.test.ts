import { describe, expect, it } from 'vitest';
import { classify, parseResponse, type ClassifyInput, type GenerateFn } from '@/lib/classifier';

const input = (item_id: number, vc_id = 'vc1'): ClassifyInput => ({
  item_id, vc_id, vc_name: 'A B', vc_firm: 'F', vc_aliases: [], firm_aliases: [], title: 't', snippet: null, source: 'google_news',
});
const label = (item_id: number, o: Record<string, unknown> = {}) => ({
  item_id, about_this_vc: true, confidence: 0.9, subject: 'firm', signal_type: 'investment', relevance: 0.5, event_key: 'e', summary: 's', ...o,
});
const opts = (generate: GenerateFn, keys = ['k1']) => ({ keys, model: 'm', companyProfile: 'p', generate, backoffMs: [1, 1, 1] });

describe('classifier', () => {
  it('zod rejects malformed output', () => {
    expect(parseResponse('not json')).toBeNull();
    expect(parseResponse(JSON.stringify({ items: [label(1, { confidence: 2 })] }))).toBeNull();
    expect(parseResponse(JSON.stringify({ items: [label(1, { signal_type: 'gossip' })] }))).toBeNull();
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
});
