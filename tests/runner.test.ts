import { describe, expect, it } from 'vitest';
import { ACTIONS, sameFirm } from '@/lib/actions';
import type { GenerateFn } from '@/lib/classifier';
import type { CollectResult } from '@/lib/collectors';
import { step, type RunInfo, type Store, type StoredSignal } from '@/lib/runner';
import type { LabelUpdate, NewSignal, SignalRow, VcContext, VcRow } from '@/lib/types';

const NOW = new Date('2026-10-12T00:00:00Z');
type Sig = SignalRow & { title_norm: string; url_hash: string };

// In-memory Store with claim_batch semantics (no re-claim of rows claimed in the last 10 minutes).
function memoryStore(n: number, opts: { firmOf?: (i: number) => string; firmRss?: string; linkedinCheckedAt?: string | null } = {}) {
  const linkedinChecked: string[] = [];
  const vcs: VcRow[] = Array.from({ length: n }, (_, i) => ({
    id: `vc${i}`, name: `Person ${i}`, firm: opts.firmOf?.(i) ?? `Firm ${i}`, thesis: null, status: 'not_contacted', last_contact_date: null,
    notes: `note ${i}`, rss_url: null, last_signal_date: null, signal_summary: null, follow_up_score: null, recommended_action: null,
  }));
  const profiles = new Map(vcs.map((v, i) => [v.id, { processed: null as number | null, claimedAt: null as number | null, trust: i === 1 ? 'A' : 'B', tier: 2 }]));
  const signals: Sig[] = [];
  let run: (RunInfo & { status: string }) | null = null;
  const writes: string[] = [];
  let tick = 0;
  const clock = () => NOW.getTime() + ++tick;

  const store: Store = {
    async ensureProfiles() { return 0; },
    async acquireRun(_t, force) {
      if (!run || run.status !== 'running') run = { id: `run${Math.random()}`, started_at: new Date(clock()).toISOString(), force, failed_vc_ids: [], status: 'running' };
      return { ...run, failed_vc_ids: [...run.failed_vc_ids] };
    },
    async claimBatch(r, k) {
      const started = Date.parse(r.started_at);
      const ids = [...profiles.entries()]
        .filter(([id, p]) => (p.processed === null || p.processed < started) && !r.failed_vc_ids.includes(id) && p.claimedAt === null)
        .slice(0, k).map(([id]) => id);
      for (const id of ids) profiles.get(id)!.claimedAt = clock();
      return ids;
    },
    async loadContexts(ids) {
      return ids.map((id): VcContext => {
        const row = vcs.find((v) => v.id === id)!;
        return { id, name: row.name, firm: row.firm, aliases: [], firmAliases: [], ambiguous: false, firmRss: opts.firmRss ?? null, row,
          ...(opts.linkedinCheckedAt !== undefined ? { linkedinSlug: `person-${id}`, firmLinkedinSlug: null, linkedinCheckedAt: opts.linkedinCheckedAt } : {}) };
      });
    },
    async tavilyCreditsThisMonth() { return 0; },
    async persona() { return { targetSpace: 'logistics software', myProduct: 'TMS SaaS for shippers' }; },
    async insertSignals(rows: NewSignal[]) {
      let k = 0;
      for (const r of rows) {
        if (signals.some((s) => s.vc_id === r.vc_id && (s.url_hash === r.url_hash || s.title_norm === r.title_norm))) continue;
        signals.push({ ...r, id: signals.length + 1, subject: null, signal_type: null, about_this_vc: null, confidence: null, relevance: null, relevance_level: null,
          possible_competitor: null, competitor_evidence: null, funded_company: null, role_change_hint: null, event_key: null, summary: null, hook: null, enriched_run: null });
        k++;
      }
      return k;
    },
    async pendingSignals(ids) { return signals.filter((s) => ids.includes(s.vc_id) && s.status === 'pending'); },
    async saveLabels(updates: LabelUpdate[], unclassified: number[]) {
      for (const u of updates) Object.assign(signals.find((s) => s.id === u.id)!, u);
      for (const id of unclassified) Object.assign(signals.find((s) => s.id === id)!, { status: 'unclassified' });
    },
    async scoringSignals(vcId) { return signals.filter((s) => s.vc_id === vcId && s.status === 'accepted') as unknown as StoredSignal[]; },
    async enrichedCount(runId) { return signals.filter((s) => s.enriched_run === runId).length; },
    async enrichSignal(id, e) { Object.assign(signals.find((s) => s.id === id)!, { snippet: e.snippet, url: e.url, url_hash: e.url_hash, enriched_run: e.runId, status: 'pending' }); return true; },
    async applySignals(vcId, date, summary, score, action) {
      writes.push(vcId);
      Object.assign(vcs.find((v) => v.id === vcId)!, { last_signal_date: date, signal_summary: summary, follow_up_score: score, recommended_action: action });
    },
    async markProcessed(vcId) { profiles.get(vcId)!.processed = clock(); },
    async markLinkedinChecked(vcId) { linkedinChecked.push(vcId); },
    async releaseClaims(_runId, ids) { for (const id of ids) profiles.get(id)!.claimedAt = null; },
    async bumpRun(_id, d) { run!.failed_vc_ids = [...new Set([...run!.failed_vc_ids, ...d.failed])]; },
    async remaining(r) { return [...profiles.entries()].filter(([id, p]) => (p.processed === null || p.processed < Date.parse(r.started_at)) && !r.failed_vc_ids.includes(id)).length; },
    async planRows() {
      return vcs.map((v) => ({ id: v.id, name: v.name, firm: v.firm, thesis: v.thesis, status: v.status, score: v.follow_up_score, action: v.recommended_action,
        trust: profiles.get(v.id)!.trust, tier: profiles.get(v.id)!.tier, research: null, last_signal_date: v.last_signal_date, signal_summary: v.signal_summary }));
    },
    async openerCandidates() { return []; },
    async saveOpener() {},
    async finishRun() { run!.status = run!.failed_vc_ids.length ? 'partial' : 'done'; return run!.status as 'done' | 'partial'; },
  };
  return { store, vcs, signals, writes, linkedinChecked, getRun: () => run };
}

const newsItem = (vc: VcContext, o: Partial<CollectResult['items'][number]> = {}) => ({
  url: `https://news.example/${vc.id}`, title: `${vc.firm} backs a startup`, snippet: null, source: 'google_news' as const,
  source_name: 'X', published_at: '2026-10-10T00:00:00Z', date_approx: false, ...o,
});
const collectors = {
  googleNews: async (vc: VcContext): Promise<CollectResult> => ({ ok: true, items: [newsItem(vc), newsItem(vc, { url: `https://news.example/${vc.id}/2`, title: `${vc.name} speaks` })] }),
  tavily: async (): Promise<CollectResult> => ({ ok: true, items: [] }),
  rss: async (): Promise<CollectResult> => ({ ok: true, items: [] }),
  enrich: async () => ({ ok: true, match: null }),
};

const labeller = (o: Record<string, unknown> = {}): GenerateFn => async ({ contents }) => {
  const items = JSON.parse(contents) as { item_id: number }[];
  return JSON.stringify({ items: items.map((i) => ({ item_id: i.item_id, about_this_vc: true, confidence: 0.9, subject: 'person', signal_type: 'investment',
    relevance_level: 'core', possible_competitor: false, competitor_evidence: null, funded_company: null, role_change_hint: null, event_key: `e${i.item_id}`, summary: 'Backed a startup', hook: null, ...o })) });
};
const failingGen: GenerateFn = async () => { throw Object.assign(new Error('overloaded'), { status: 503 }); };

const deps = (store: Store, generate: GenerateFn, extra: Record<string, unknown> = {}) => ({
  store, collectors, classifyOpts: { keys: ['k'], model: 'm', generate, backoffMs: [1, 1, 1] }, tavilyKey: 't', tavilyBudget: 10, now: () => NOW, ...extra,
});

async function runAll(store: Store, generate: GenerateFn, extra: Record<string, unknown> = {}) {
  for (let i = 0; i < 20; i++) { const r = await step({ trigger: 'manual' }, deps(store, generate, extra)); if (r.done) return r; }
  throw new Error('run did not finish');
}

describe('runner', () => {
  it('writes every VC end to end and finishes done, never touching Vikram columns', async () => {
    const m = memoryStore(12);
    expect((await step({ trigger: 'manual' }, deps(m.store, labeller()))).processed).toBe(10);
    expect((await step({ trigger: 'manual' }, deps(m.store, labeller()))).processed).toBe(2);
    expect(await step({ trigger: 'manual' }, deps(m.store, labeller()))).toMatchObject({ done: true, status: 'done' });
    expect(m.vcs.every((v) => v.recommended_action === ACTIONS.reach)).toBe(true);
    expect(m.vcs.every((v, i) => v.notes === `note ${i}` && v.status === 'not_contacted')).toBe(true);
  });

  it('a Gemini failure leaves VCs unwritten and failed; the run ends partial without looping on them', async () => {
    const m = memoryStore(3);
    const r1 = await step({ trigger: 'manual' }, deps(m.store, failingGen));
    expect(r1).toMatchObject({ processed: 0, failed: 3, remaining: 0 });
    expect(m.writes).toEqual([]);
    expect(m.signals.every((s) => s.status === 'pending')).toBe(true);
    expect(m.getRun()!.failed_vc_ids.sort()).toEqual(['vc0', 'vc1', 'vc2']);
    expect(await step({ trigger: 'manual' }, deps(m.store, failingGen))).toMatchObject({ done: true, status: 'partial', processed: 0 });
  });

  it('claims are released after a step, so a new run right after can claim again', async () => {
    const m = memoryStore(3);
    await runAll(m.store, labeller());
    const r = await step({ trigger: 'manual', force: true }, deps(m.store, labeller()));
    expect(r.processed).toBe(3);
  });

  it('two concurrent steps never process the same VC', async () => {
    const m = memoryStore(20);
    const [a, b] = await Promise.all([step({ trigger: 'manual' }, deps(m.store, labeller())), step({ trigger: 'manual' }, deps(m.store, labeller()))]);
    expect(a.processed + b.processed).toBe(20);
    expect(new Set(m.writes).size).toBe(m.writes.length);
  });

  it('firm dedupe at run end: one contact action per firm; tie goes to higher trust', async () => {
    const m = memoryStore(3, { firmOf: (i) => (i < 2 ? 'Accel' : 'Blume') });
    const r = await runAll(m.store, labeller());
    expect(r.deduped).toBe(1);
    expect(m.vcs[1].recommended_action).toBe(ACTIONS.reach); // trust A wins the tie
    expect(m.vcs[0].recommended_action).toBe(sameFirm('Person 1'));
    expect(m.vcs[2].recommended_action).toBe(ACTIONS.reach);
  });

  it('a backed competitor yields the conflict action, named from funded_company', async () => {
    const m = memoryStore(1);
    await runAll(m.store, labeller({ possible_competitor: true, competitor_evidence: 'backs a startup', funded_company: 'Firm 0' }));
    expect(m.vcs[0].recommended_action).toBe('Check conflict — backed Firm 0');
    expect(m.vcs[0].signal_summary).toMatch(/^Backed Firm 0 \(10 Oct\), a likely competitor\.$/);
  });

  it('enriches snippet-less items that decide a contact action, then reclassifies them', async () => {
    const m = memoryStore(1);
    const enrich = async (title: string) => ({ ok: true, match: { snippet: `Full context for ${title}`, url: `https://canonical.example/${encodeURIComponent(title)}` } });
    await runAll(m.store, labeller(), { collectors: { ...collectors, enrich }, enrichment: true });
    const enriched = m.signals.filter((s) => s.enriched_run);
    expect(enriched.length).toBeGreaterThan(0);
    expect(enriched.every((s) => s.status === 'accepted' && s.snippet?.startsWith('Full context') && s.url.startsWith('https://canonical.example/'))).toBe(true);
  });

  it('evidence floor: a high score from press-only signals gets Warm (in-space news), not Reach out', async () => {
    const m = memoryStore(1);
    await runAll(m.store, labeller({ signal_type: 'press', relevance_level: 'core' }));
    expect(m.vcs[0].follow_up_score).toBeGreaterThanOrEqual(50);
    expect(m.vcs[0].recommended_action).toBe(ACTIONS.warm);
  });

  it('a standing research conflict at the firm flags every partner, until dismissed', async () => {
    const m = memoryStore(2, { firmOf: () => 'Pentathlon' });
    const research = { fit_reason: 'Personally associated with fresh TMS investment.' };
    const orig = m.store.loadContexts;
    m.store.loadContexts = async (ids) => (await orig(ids)).map((c) => ({ ...c, research: c.id === 'vc0' ? research : null, peerResearch: c.id === 'vc1' ? [research] : [], conflictDismissed: false }));
    await runAll(m.store, labeller());
    expect(m.vcs.map((v) => v.recommended_action)).toEqual(['Check conflict — backed a TMS company', 'Check conflict — backed a TMS company']);
    expect(m.vcs[0].signal_summary).toMatch(/^Research: ".*fresh TMS investment.*". Check for a conflict before pitching.$/);
  });

  it('firm RSS items are always subject=firm', async () => {
    const m = memoryStore(1, { firmRss: 'https://firm.example/feed' });
    const rss = async (): Promise<CollectResult> => ({ ok: true, items: [{ url: 'https://firm.example/p1', title: 'Firm 0 portfolio update', snippet: null, source: 'firm_rss', source_name: 'Firm blog', published_at: '2026-10-09T00:00:00Z', date_approx: false }] });
    await runAll(m.store, labeller({ subject: 'person' }), { collectors: { ...collectors, rss } });
    expect(m.signals.find((s) => s.source === 'firm_rss')).toMatchObject({ subject: 'firm', status: 'accepted' });
    expect(m.signals.find((s) => s.source === 'google_news')).toMatchObject({ subject: 'person' });
  });
});

describe('runner: LinkedIn posts (DECISIONS #45)', () => {
  const linkedin = async (vc: VcContext): Promise<CollectResult> => ({ ok: true, items: [{
    url: `https://www.linkedin.com/posts/person-${vc.id}_x-activity-7505582179767193600-a`, title: `LinkedIn post by ${vc.name}: freight software`,
    snippet: 'freight software', source: 'linkedin', source_name: 'LinkedIn (own post)', published_at: '2026-10-05T00:00:00Z', date_approx: false }] });

  it('collects once per VC with a handle, stores the posts and marks the VC checked', async () => {
    const m = memoryStore(2, { linkedinCheckedAt: null });
    let calls = 0;
    await runAll(m.store, labeller({ signal_type: 'authored' }), { collectors: { ...collectors, linkedin: async (vc: VcContext) => { calls++; return linkedin(vc); } } });
    expect(calls).toBe(2);
    expect(m.linkedinChecked.sort()).toEqual(['vc0', 'vc1']);
    expect(m.signals.filter((s) => s.source === 'linkedin' && s.status === 'accepted')).toHaveLength(2);
  });

  it('skips VCs checked within the week, and VCs without a handle, and respects the Tavily budget', async () => {
    let calls = 0;
    const count = { ...collectors, linkedin: async (vc: VcContext) => { calls++; return linkedin(vc); } };
    await runAll(memoryStore(2, { linkedinCheckedAt: '2026-10-10T00:00:00Z' }).store, labeller(), { collectors: count });
    await runAll(memoryStore(2).store, labeller(), { collectors: count });
    await runAll(memoryStore(2, { linkedinCheckedAt: null }).store, labeller(), { collectors: count, tavilyBudget: 0 });
    expect(calls).toBe(0);
  });
});

describe('runner: LinkedIn stress', () => {
  it('a failed LinkedIn search is not marked checked, so the next run retries it', async () => {
    const m = memoryStore(2, { linkedinCheckedAt: null });
    await runAll(m.store, labeller(), { collectors: { ...collectors, linkedin: async (): Promise<CollectResult> => ({ ok: false, items: [], error: 'linkedin search HTTP 429' }) } });
    expect(m.linkedinChecked).toEqual([]);
    expect(m.vcs.every((v) => v.recommended_action !== ACTIONS.unavailable)).toBe(true); // news still worked: not "unavailable"
  });
});
