// SPEC §9.1 batch runner. The unit of correctness is one VC; each step handles one batch end to end.
import { decideAction, firmDedupe, meetsEvidenceFloor, type ActionResult, type DedupeRow } from './actions';
import { classify, type ClassifyInput, type ClassifyOptions } from './classifier';
import { enrichHeadline, googleNews, rssFeed, tavily, type CollectResult, type Enrichment } from './collectors';
import { BATCH_SIZE, COLLECT_CONCURRENCY, ENRICH_PER_RUN, SIGNAL_WINDOW_DAYS } from './config';
import { filterReason } from './filter';
import { lastSignalDate, scoreSignals, signalAge, type ScoreResult, type ScorableSignal } from './scoring';
import { summaryText } from './summary';
import { normTitle, urlHash } from './text';
import type { FetchStatus, LabelUpdate, NewSignal, SignalRow, VcContext } from './types';

export type Trigger = 'cron' | 'github' | 'manual';
export type RunInfo = { id: string; started_at: string; force: boolean; failed_vc_ids: string[] };
export type StoredSignal = ScorableSignal & { title: string; snippet: string | null; source: string; competitor_evidence: string | null; funded_company: string | null; enriched_run: string | null };

export interface Store {
  ensureProfiles(): Promise<number>;
  acquireRun(trigger: Trigger, force: boolean): Promise<RunInfo>;
  claimBatch(run: RunInfo, n: number): Promise<string[]>;
  loadContexts(vcIds: string[]): Promise<VcContext[]>;
  tavilyCreditsThisMonth(): Promise<number>;
  companyProfile(): Promise<string>;
  insertSignals(rows: NewSignal[]): Promise<number>;
  pendingSignals(vcIds: string[]): Promise<SignalRow[]>;
  saveLabels(updates: LabelUpdate[], unclassifiedIds: number[]): Promise<void>;
  scoringSignals(vcId: string): Promise<StoredSignal[]>;
  enrichedCount(runId: string): Promise<number>;
  enrichSignal(signalId: number, e: Enrichment & { url_hash: string; runId: string }): Promise<boolean>;
  applySignals(vcId: string, lastSignalDate: string | null, summary: string | null, score: number | null, action: string): Promise<void>;
  markProcessed(vcId: string, fetchStatus: FetchStatus): Promise<void>;
  bumpRun(runId: string, d: { tavily: number; gemini: number; errors: string[]; failed: string[]; stats: Record<string, unknown> }): Promise<void>;
  remaining(run: RunInfo): Promise<number>;
  dedupeRows(): Promise<(DedupeRow & { last_signal_date: string | null; signal_summary: string | null })[]>;
  finishRun(runId: string): Promise<'done' | 'partial'>;
}

export type Collectors = {
  googleNews: (vc: VcContext) => Promise<CollectResult>;
  tavily: (vc: VcContext, key: string) => Promise<CollectResult>;
  rss: (url: string, source: 'person_rss' | 'firm_rss') => Promise<CollectResult>;
  enrich: (title: string, key: string) => Promise<{ ok: boolean; match: Enrichment | null; error?: string }>;
};

export type StepDeps = {
  store: Store;
  collectors?: Partial<Collectors>;
  classifyOpts: Omit<ClassifyOptions, 'companyProfile'>;
  tavilyKey: string;
  tavilyBudget: number;
  enrichment?: boolean; // Phase 0 gate: on
  now?: () => Date;
  windowDays?: number;
};

export type StepResult = { runId: string; done: boolean; processed: number; failed: number; remaining: number; status?: 'done' | 'partial'; deduped?: number };

const DEFAULT_COLLECTORS: Collectors = { googleNews, tavily, rss: rssFeed, enrich: enrichHeadline };

async function pool<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (next < xs.length) { const i = next++; out[i] = await fn(xs[i]); }
  }));
  return out;
}

// Dedupe within one VC by url_hash and title_norm before the DB's unique keys see it, then filter (SPEC §9.3).
function toSignals(vc: VcContext, items: CollectResult['items'], windowDays: number, now: Date): NewSignal[] {
  const seen = new Set<string>();
  const out: NewSignal[] = [];
  for (const it of items) {
    const h = urlHash(it.url), t = normTitle(it.title);
    if (seen.has(h) || seen.has(`t:${t}`)) continue;
    seen.add(h); seen.add(`t:${t}`);
    const reason = filterReason(it, vc, windowDays, now, { personRss: it.source === 'person_rss' });
    out.push({ ...it, vc_id: vc.id, url_hash: h, title_norm: t, status: reason ? 'rejected' : 'pending', reject_reason: reason });
  }
  return out;
}

const toInput = (s: SignalRow | StoredSignal & { vc_id?: string }, vc: VcContext): ClassifyInput => ({
  item_id: s.id, vc_id: vc.id, vc_name: vc.name, vc_firm: vc.firm, vc_aliases: vc.aliases,
  firm_aliases: vc.firmAliases, title: s.title, snippet: s.snippet, source: s.source,
});

// firm_rss items are always subject=firm (SPEC §9.5).
function forceFirmSubject(updates: LabelUpdate[], sourceOf: Map<number, string>): LabelUpdate[] {
  return updates.map((u) => (sourceOf.get(u.id) === 'firm_rss' ? { ...u, subject: 'firm' } : u));
}

export async function step(opts: { trigger: Trigger; force?: boolean }, deps: StepDeps): Promise<StepResult> {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  const windowDays = deps.windowDays ?? SIGNAL_WINDOW_DAYS;
  const col: Collectors = { ...DEFAULT_COLLECTORS, ...deps.collectors };
  const t0 = Date.now();

  await store.ensureProfiles();                                    // 0. profiles
  const run = await store.acquireRun(opts.trigger, !!opts.force);  // 1. lock
  const ids = await store.claimBatch(run, BATCH_SIZE);             // 2. claim
  if (!ids.length) {
    const deduped = await applyFirmDedupe(store);
    const status = await store.finishRun(run.id);
    return { runId: run.id, done: true, processed: 0, failed: 0, remaining: 0, status, deduped };
  }

  const contexts = await store.loadContexts(ids);
  const byId = new Map(contexts.map((c) => [c.id, c]));
  const errors: string[] = [];
  let tavilyLeft = Math.max(0, deps.tavilyBudget - (await store.tavilyCreditsThisMonth()));
  let tavilyUsed = 0;
  let geminiCalls = 0;
  const failed = new Set<string>();
  const persona = await store.companyProfile();
  const classifyOpts = { ...deps.classifyOpts, companyProfile: persona };

  // 3. collect (concurrency 3). Firm feeds are fetched once per step and shared by that firm's VCs.
  const firmFeeds = new Map<string, Promise<CollectResult>>();
  const fetchStatus = new Map<string, FetchStatus>();
  const collected = await pool(contexts, COLLECT_CONCURRENCY, async (vc) => {
    const results: CollectResult[] = [await col.googleNews(vc)];
    if (results[0].items.length < 2 && tavilyLeft > 0) {
      tavilyLeft--; tavilyUsed++; // 1 credit per call, counted on attempt
      results.push(await col.tavily(vc, deps.tavilyKey));
    }
    if (vc.row.rss_url) results.push(await col.rss(vc.row.rss_url, 'person_rss'));
    if (vc.firmRss) {
      if (!firmFeeds.has(vc.firmRss)) firmFeeds.set(vc.firmRss, col.rss(vc.firmRss, 'firm_rss'));
      results.push(await firmFeeds.get(vc.firmRss)!);
    }
    for (const r of results) if (!r.ok && r.error) errors.push(`${vc.name}: ${r.error}`);
    const ok = results.filter((r) => r.ok).length;
    fetchStatus.set(vc.id, ok === results.length ? 'ok' : ok === 0 ? 'failed' : 'partial');
    return toSignals(vc, results.flatMap((r) => r.items), windowDays, now()); // 4. filter
  });
  const inserted = await store.insertSignals(collected.flat());

  // 5. classify every pending item for the batch (including ones left pending by earlier runs or a persona change).
  const pending = await store.pendingSignals(ids);
  const runClassify = async (inputs: ClassifyInput[]) => {
    if (!inputs.length) return;
    const res = await classify(inputs, classifyOpts);
    geminiCalls += res.calls;
    errors.push(...res.errors);
    res.failedVcIds.forEach((id) => failed.add(id)); // 7. failed VCs: not written, items stay pending
    const sourceOf = new Map(inputs.map((i) => [i.item_id, i.source]));
    await store.saveLabels(forceFirmSubject(res.updates, sourceOf), res.unclassified);
  };
  await runClassify(pending.map((s) => toInput(s, byId.get(s.vc_id)!)));

  // 6a. enrichment (SPEC §9.2): ≤ ENRICH_PER_RUN accepted, snippet-less items that would decide a contact action.
  let enriched = 0;
  if (deps.enrichment !== false) {
    let budget = Math.max(0, ENRICH_PER_RUN - (await store.enrichedCount(run.id)));
    const toReclassify: ClassifyInput[] = [];
    for (const vc of contexts) {
      if (failed.has(vc.id) || budget <= 0) continue;
      const { decision, result } = await evaluate(store, vc, fetchStatus.get(vc.id) ?? 'failed', now(), windowDays);
      if (!['5', '6', '7'].includes(decision.row)) continue;
      for (const g of result.groups) {
        const s = g.signal as StoredSignal;
        if (budget <= 0 || tavilyLeft <= 0 || s.snippet || s.enriched_run) continue;
        budget--; tavilyLeft--; tavilyUsed++;
        const e = await col.enrich(s.title, deps.tavilyKey);
        if (!e.ok && e.error) errors.push(`${vc.name}: ${e.error}`);
        if (!e.match) continue;
        if (await store.enrichSignal(s.id, { ...e.match, url_hash: urlHash(e.match.url), runId: run.id })) {
          enriched++;
          toReclassify.push(toInput({ ...s, snippet: e.match.snippet }, vc));
        }
      }
    }
    await runClassify(toReclassify);
  }

  // 6b. score and write each VC whose items are all classified.
  let processed = 0;
  for (const vc of contexts) {
    if (failed.has(vc.id)) continue;
    try {
      await scoreAndWrite(store, vc, fetchStatus.get(vc.id) ?? 'failed', now(), windowDays);
      await store.markProcessed(vc.id, fetchStatus.get(vc.id) ?? 'failed');
      processed++;
    } catch (e) {
      failed.add(vc.id);
      errors.push(`${vc.name}: write failed: ${(e as Error).message}`);
    }
  }

  // 8. heartbeat, counters, stats.
  await store.bumpRun(run.id, {
    tavily: tavilyUsed, gemini: geminiCalls, errors, failed: [...failed],
    stats: { [`step_${new Date(t0).toISOString()}`]: { vcs: ids.length, processed, failed: failed.size, inserted, classified: pending.length, enriched, ms: Date.now() - t0 } },
  });
  const remaining = await store.remaining({ ...run, failed_vc_ids: [...run.failed_vc_ids, ...failed] });
  return { runId: run.id, done: false, processed, failed: failed.size, remaining };
}

type Evaluation = { decision: ActionResult; result: ScoreResult; signals: StoredSignal[]; conflict: { company: string; date: string | null } | null };

export async function evaluate(store: Store, vc: VcContext, fetch: FetchStatus, now: Date, windowDays = SIGNAL_WINDOW_DAYS): Promise<Evaluation> {
  const signals = await store.scoringSignals(vc.id);
  const result = scoreSignals(signals, now, { windowDays });
  const c = signals
    .filter((s) => s.status === 'accepted' && s.possible_competitor === true && !s.thumbs_down && signalAge(s, now, windowDays) !== null)
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0];
  const conflict = c ? { company: c.funded_company ?? c.competitor_evidence ?? 'a likely competitor', date: c.published_at } : null;
  const decision = decideAction({
    status: vc.row.status,
    lastContactDate: vc.row.last_contact_date,
    fetchStatus: fetch,
    score: result.score,
    topRelevance: result.top?.signal.relevance ?? null,
    conflictCompany: conflict?.company ?? null,
    hasEvidence: meetsEvidenceFloor(result.counted.map((c) => c.signal)),
    now,
  });
  return { decision, result, signals, conflict };
}

export async function scoreAndWrite(store: Store, vc: VcContext, fetch: FetchStatus, now: Date, windowDays = SIGNAL_WINDOW_DAYS) {
  const { decision, result, signals, conflict } = await evaluate(store, vc, fetch, now, windowDays);
  if (decision.keepOtherColumns) {
    // Row 3: only the action changes; the other three system columns keep their previous values.
    await store.applySignals(vc.id, vc.row.last_signal_date, vc.row.signal_summary, vc.row.follow_up_score, decision.action);
    return decision;
  }
  const last = lastSignalDate(signals);
  await store.applySignals(vc.id, last, summaryText(result, { conflict, lastSignalDate: last }), result.score, decision.action);
  return decision;
}

// Final pass when a run finishes (including partial runs): one contact action per firm.
export async function applyFirmDedupe(store: Store): Promise<number> {
  const rows = await store.dedupeRows();
  const changes = firmDedupe(rows);
  for (const ch of changes) {
    const r = rows.find((x) => x.id === ch.id)!;
    await store.applySignals(r.id, r.last_signal_date, r.signal_summary, r.score, ch.action);
  }
  return changes.length;
}
