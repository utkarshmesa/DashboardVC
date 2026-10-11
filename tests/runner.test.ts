import { describe, expect, it } from 'vitest';
import type { GenerateFn } from '@/lib/classifier';
import type { CollectResult } from '@/lib/collectors';
import { step, type RunInfo, type Store } from '@/lib/runner';
import type { ScorableSignal } from '@/lib/scoring';
import type { LabelUpdate, NewSignal, SignalRow, VcContext, VcRow } from '@/lib/types';

const NOW = new Date('2026-10-12T00:00:00Z');

// In-memory Store with claim_batch semantics (no re-claim of rows claimed in the last 10 minutes).
function memoryStore(n: number) {
  const vcs: VcRow[] = Array.from({ length: n }, (_, i) => ({
    id: `vc${i}`, name: `Person ${i}`, firm: `Firm ${i}`, thesis: null, status: 'not_contacted', last_contact_date: null,
    notes: `note ${i}`, rss_url: null, last_signal_date: null, signal_summary: null, follow_up_score: null, recommended_action: null,
  }));
  const profiles = new Map(vcs.map((v) => [v.id, { processed: null as number | null, claimedAt: null as number | null }]));
  const signals: (SignalRow & { title_norm: string; url_hash: string })[] = [];
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
      return ids.map((id): VcContext => { const row = vcs.find((v) => v.id === id)!; return { id, name: row.name, firm: row.firm, aliases: [], firmAliases: [], ambiguous: false, row }; });
    },
    async tavilyCreditsThisMonth() { return 0; },
    async companyProfile() { return 'persona'; },
    async insertSignals(rows: NewSignal[]) {
      let k = 0;
      for (const r of rows) {
        if (signals.some((s) => s.vc_id === r.vc_id && (s.url_hash === r.url_hash || s.title_norm === r.title_norm))) continue;
        signals.push({ ...r, id: signals.length + 1, subject: null, signal_type: null, about_this_vc: null, confidence: null, relevance: null,
          possible_competitor: null, competitor_evidence: null, event_key: null, summary: null });
        k++;
      }
      return k;
    },
    async pendingSignals(ids) { return signals.filter((s) => ids.includes(s.vc_id) && s.status === 'pending'); },
    async saveLabels(updates: LabelUpdate[], unclassified: number[]) {
      for (const u of updates) Object.assign(signals.find((s) => s.id === u.id)!, u);
      for (const id of unclassified) Object.assign(signals.find((s) => s.id === id)!, { status: 'unclassified' });
    },
    async scoringSignals(vcId) { return signals.filter((s) => s.vc_id === vcId && s.status === 'accepted') as unknown as (ScorableSignal & { competitor_evidence: string | null })[]; },
    async applySignals(vcId, date, summary, score, action) {
      writes.push(vcId);
      Object.assign(vcs.find((v) => v.id === vcId)!, { last_signal_date: date, signal_summary: summary, follow_up_score: score, recommended_action: action });
    },
    async markProcessed(vcId) { profiles.get(vcId)!.processed = clock(); },
    async bumpRun(_id, d) { run!.failed_vc_ids = [...new Set([...run!.failed_vc_ids, ...d.failed])]; },
    async remaining(r) { return [...profiles.entries()].filter(([id, p]) => (p.processed === null || p.processed < Date.parse(r.started_at)) && !r.failed_vc_ids.includes(id)).length; },
    async finishRun() { run!.status = run!.failed_vc_ids.length ? 'partial' : 'done'; return run!.status as 'done' | 'partial'; },
  };
  return { store, vcs, signals, writes, getRun: () => run };
}

const collectors = {
  googleNews: async (vc: VcContext): Promise<CollectResult> => ({
    ok: true,
    items: [{ url: `https://news.example/${vc.id}`, title: `${vc.firm} backs a startup`, snippet: null, source: 'google_news', source_name: 'X', published_at: '2026-10-10T00:00:00Z', date_approx: false }],
  }),
  tavily: async (): Promise<CollectResult> => ({ ok: true, items: [] }),
};

const okGen: GenerateFn = async ({ contents }) => {
  const items = JSON.parse(contents) as { item_id: number }[];
  return JSON.stringify({ items: items.map((i) => ({ item_id: i.item_id, about_this_vc: true, confidence: 0.9, subject: 'firm', signal_type: 'investment', relevance: 0.8, event_key: `e${i.item_id}`, summary: 'Backed a startup' })) });
};
const failingGen: GenerateFn = async () => { throw Object.assign(new Error('overloaded'), { status: 503 }); };

const deps = (store: Store, generate: GenerateFn) => ({
  store, collectors, classifyOpts: { keys: ['k'], model: 'm', generate, backoffMs: [1, 1, 1] }, tavilyKey: 't', tavilyBudget: 10, now: () => NOW,
});

describe('runner', () => {
  it('writes every VC end to end and finishes done', async () => {
    const m = memoryStore(12);
    let r = await step({ trigger: 'manual' }, deps(m.store, okGen));
    expect(r.processed).toBe(10);
    r = await step({ trigger: 'manual' }, deps(m.store, okGen));
    expect(r.processed).toBe(2);
    r = await step({ trigger: 'manual' }, deps(m.store, okGen));
    expect(r).toMatchObject({ done: true, status: 'done' });
    expect(m.vcs.every((v) => v.recommended_action === 'Reach out this week' || v.recommended_action === 'Warm — reach out if capacity')).toBe(true);
    expect(m.vcs.every((v, i) => v.notes === `note ${i}`)).toBe(true);
  });

  it('a Gemini failure leaves VCs unwritten and failed; the run ends partial without looping on them', async () => {
    const m = memoryStore(3);
    const r1 = await step({ trigger: 'manual' }, deps(m.store, failingGen));
    expect(r1).toMatchObject({ processed: 0, failed: 3, remaining: 0 });
    expect(m.writes).toEqual([]);
    expect(m.vcs.every((v) => v.recommended_action === null)).toBe(true);
    expect(m.signals.every((s) => s.status === 'pending')).toBe(true);
    expect(m.getRun()!.failed_vc_ids.sort()).toEqual(['vc0', 'vc1', 'vc2']);
    const r2 = await step({ trigger: 'manual' }, deps(m.store, failingGen));
    expect(r2).toMatchObject({ done: true, status: 'partial', processed: 0 });
  });

  it('two concurrent steps never process the same VC', async () => {
    const m = memoryStore(20);
    const [a, b] = await Promise.all([step({ trigger: 'manual' }, deps(m.store, okGen)), step({ trigger: 'manual' }, deps(m.store, okGen))]);
    expect(a.processed + b.processed).toBe(20);
    expect(new Set(m.writes).size).toBe(m.writes.length);
  });
});
