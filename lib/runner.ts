// SPEC §9.1 batch runner. The unit of correctness is one VC; each step handles one batch end to end.
import { decideAction } from './actions';
import { classify, type ClassifyInput, type ClassifyOptions } from './classifier';
import { googleNews, tavily, type CollectResult } from './collectors';
import { BATCH_SIZE, COLLECT_CONCURRENCY, SIGNAL_WINDOW_DAYS } from './config';
import { filterReason } from './filter';
import { lastSignalDate, scoreSignals, signalAge, type ScorableSignal } from './scoring';
import { summaryText } from './summary';
import { normTitle, urlHash } from './text';
import type { FetchStatus, LabelUpdate, NewSignal, SignalRow, VcContext } from './types';

export type Trigger = 'cron' | 'github' | 'manual';
export type RunInfo = { id: string; started_at: string; force: boolean; failed_vc_ids: string[] };

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
  scoringSignals(vcId: string): Promise<(ScorableSignal & { competitor_evidence: string | null })[]>;
  applySignals(vcId: string, lastSignalDate: string | null, summary: string | null, score: number | null, action: string): Promise<void>;
  markProcessed(vcId: string, fetchStatus: FetchStatus): Promise<void>;
  bumpRun(runId: string, d: { tavily: number; gemini: number; errors: string[]; failed: string[]; stats: Record<string, unknown> }): Promise<void>;
  remaining(run: RunInfo): Promise<number>;
  finishRun(runId: string): Promise<'done' | 'partial'>;
}

export type Collectors = {
  googleNews: (vc: VcContext) => Promise<CollectResult>;
  tavily: (vc: VcContext, key: string) => Promise<CollectResult>;
};

export type StepDeps = {
  store: Store;
  collectors?: Collectors;
  classifyOpts: Omit<ClassifyOptions, 'companyProfile'>;
  tavilyKey: string;
  tavilyBudget: number;
  now?: () => Date;
  windowDays?: number;
};

export type StepResult = { runId: string; done: boolean; processed: number; failed: number; remaining: number; status?: 'done' | 'partial' };

async function pool<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (next < xs.length) { const i = next++; out[i] = await fn(xs[i]); }
  }));
  return out;
}

// Dedupe within one VC by url_hash and title_norm before the DB's unique keys see it.
function toSignals(vc: VcContext, items: CollectResult['items'], windowDays: number, now: Date): NewSignal[] {
  const seen = new Set<string>();
  const out: NewSignal[] = [];
  for (const it of items) {
    const h = urlHash(it.url), t = normTitle(it.title);
    if (seen.has(h) || seen.has(`t:${t}`)) continue;
    seen.add(h); seen.add(`t:${t}`);
    const reason = filterReason(it, vc, windowDays, now);
    out.push({ ...it, vc_id: vc.id, url_hash: h, title_norm: t, status: reason ? 'rejected' : 'pending', reject_reason: reason });
  }
  return out;
}

export async function step(opts: { trigger: Trigger; force?: boolean }, deps: StepDeps): Promise<StepResult> {
  const { store } = deps;
  const now = deps.now ?? (() => new Date());
  const windowDays = deps.windowDays ?? SIGNAL_WINDOW_DAYS;
  const collectors = deps.collectors ?? { googleNews, tavily };
  const t0 = Date.now();

  await store.ensureProfiles();                                    // 0. profiles
  const run = await store.acquireRun(opts.trigger, !!opts.force);  // 1. lock
  const ids = await store.claimBatch(run, BATCH_SIZE);             // 2. claim
  if (!ids.length) {
    const status = await store.finishRun(run.id);
    return { runId: run.id, done: true, processed: 0, failed: 0, remaining: 0, status };
  }

  const contexts = await store.loadContexts(ids);
  const errors: string[] = [];
  let tavilyLeft = Math.max(0, deps.tavilyBudget - (await store.tavilyCreditsThisMonth()));
  let tavilyUsed = 0;

  // 3. collect (concurrency 3); Tavily only when Google News returned < 2 items and budget allows.
  const fetchStatus = new Map<string, FetchStatus>();
  const collected = await pool(contexts, COLLECT_CONCURRENCY, async (vc) => {
    const results: CollectResult[] = [await collectors.googleNews(vc)];
    if (results[0].items.length < 2 && tavilyLeft > 0) {
      tavilyLeft--; tavilyUsed++; // 1 credit per call, counted on attempt
      results.push(await collectors.tavily(vc, deps.tavilyKey));
    }
    for (const r of results) if (!r.ok && r.error) errors.push(`${vc.name}: ${r.error}`);
    const ok = results.filter((r) => r.ok).length;
    fetchStatus.set(vc.id, ok === results.length ? 'ok' : ok === 0 ? 'failed' : 'partial');
    return toSignals(vc, results.flatMap((r) => r.items), windowDays, now()); // 4. filter
  });
  const inserted = await store.insertSignals(collected.flat());

  // 5. classify every pending item for the batch (including ones left pending by earlier runs).
  const pending = await store.pendingSignals(ids);
  const byId = new Map(contexts.map((c) => [c.id, c]));
  const inputs: ClassifyInput[] = pending.map((s) => {
    const vc = byId.get(s.vc_id)!;
    return { item_id: s.id, vc_id: s.vc_id, vc_name: vc.name, vc_firm: vc.firm, vc_aliases: vc.aliases,
      firm_aliases: vc.firmAliases, title: s.title, snippet: s.snippet, source: s.source };
  });
  let geminiCalls = 0;
  const failed = new Set<string>();
  if (inputs.length) {
    const res = await classify(inputs, { ...deps.classifyOpts, companyProfile: await store.companyProfile() });
    geminiCalls = res.calls;
    errors.push(...res.errors);
    res.failedVcIds.forEach((id) => failed.add(id)); // 7. failed VCs: not written, items stay pending
    await store.saveLabels(res.updates, res.unclassified);
  }

  // 6. score and write each VC whose items are all classified.
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
    stats: { [`step_${new Date(t0).toISOString()}`]: { vcs: ids.length, processed, failed: failed.size, inserted, classified: inputs.length, ms: Date.now() - t0 } },
  });
  const remaining = await store.remaining({ ...run, failed_vc_ids: [...run.failed_vc_ids, ...failed] });
  return { runId: run.id, done: false, processed, failed: failed.size, remaining };
}

export async function scoreAndWrite(store: Store, vc: VcContext, fetch: FetchStatus, now: Date, windowDays = SIGNAL_WINDOW_DAYS) {
  const signals = await store.scoringSignals(vc.id);
  const result = scoreSignals(signals, now, { windowDays });
  const conflictSignal = signals.find((s) => s.status === 'accepted' && s.possible_competitor === true && !s.thumbs_down
    && signalAge(s, now, windowDays) !== null);
  const conflict = conflictSignal ? { company: conflictSignal.competitor_evidence ?? 'a likely competitor', date: conflictSignal.published_at } : null;
  const decision = decideAction({
    status: vc.row.status,
    lastContactDate: vc.row.last_contact_date,
    fetchStatus: fetch,
    score: result.score,
    topRelevance: result.top?.signal.relevance ?? null,
    conflictCompany: conflict?.company ?? null,
    now,
  });
  if (decision.keepOtherColumns) {
    // Row 3: only the action changes; the other three system columns keep their previous values.
    await store.applySignals(vc.id, vc.row.last_signal_date, vc.row.signal_summary, vc.row.follow_up_score, decision.action);
    return decision;
  }
  const last = lastSignalDate(signals);
  await store.applySignals(vc.id, last, summaryText(result, { conflict, lastSignalDate: last }), result.score, decision.action);
  return decision;
}
