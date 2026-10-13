// SPEC §9.1 batch runner. The unit of correctness is one VC; each step handles one batch end to end.
import { decideAction, meetsEvidenceFloor, planPass, type ActionResult } from './actions';
import { classify, type ClassifyInput, type ClassifyOptions, type Persona } from './classifier';
import { competitorTerms, fitScore, researchConflict, type Fit, type Research } from './fit';
import { generateOpeners, openerHash, type OpenerInput } from './opener';
import { enrichHeadline, googleNews, rssFeed, tavily, type CollectResult, type Enrichment } from './collectors';
import { linkedinDue, linkedinPosts } from './linkedin';
import { BATCH_SIZE, COLLECT_CONCURRENCY, ENRICH_PER_RUN, SIGNAL_WINDOW_DAYS } from './config';
import { filterReason } from './filter';
import { lastSignalDate, scoreSignals, type ScoreResult, type ScorableSignal } from './scoring';
import { summaryText } from './summary';
import { normTitle, urlHash } from './text';
import type { FetchStatus, LabelUpdate, NewSignal, SignalRow, VcContext } from './types';

const ENRICH_ROWS = ['O1', 'O2', 'O3', 'O5', 'F2'];

export type Trigger = 'cron' | 'github' | 'manual';
export type RunInfo = { id: string; started_at: string; force: boolean; failed_vc_ids: string[] };
export type StoredSignal = ScorableSignal & { title: string; snippet: string | null; source: string; competitor_evidence: string | null; funded_company: string | null; enriched_run: string | null };

export interface Store {
  ensureProfiles(): Promise<number>;
  acquireRun(trigger: Trigger, force: boolean): Promise<RunInfo>;
  claimBatch(run: RunInfo, n: number): Promise<string[]>;
  loadContexts(vcIds: string[]): Promise<VcContext[]>;
  tavilyCreditsThisMonth(): Promise<number>;
  persona(): Promise<Persona>;
  insertSignals(rows: NewSignal[]): Promise<number>;
  pendingSignals(vcIds: string[]): Promise<SignalRow[]>;
  saveLabels(updates: LabelUpdate[], unclassifiedIds: number[]): Promise<void>;
  scoringSignals(vcId: string): Promise<StoredSignal[]>;
  enrichedCount(runId: string): Promise<number>;
  enrichSignal(signalId: number, e: Enrichment & { url_hash: string; runId: string }): Promise<boolean>;
  applySignals(vcId: string, lastSignalDate: string | null, summary: string | null, score: number | null, action: string): Promise<void>;
  markProcessed(vcId: string, fetchStatus: FetchStatus): Promise<void>;
  markLinkedinChecked(vcId: string): Promise<void>;
  releaseClaims(runId: string, vcIds: string[]): Promise<void>;
  bumpRun(runId: string, d: { tavily: number; gemini: number; errors: string[]; failed: string[]; stats: Record<string, unknown> }): Promise<void>;
  remaining(run: RunInfo): Promise<number>;
  planRows(): Promise<PlanSource[]>;
  openerCandidates(): Promise<(Omit<OpenerInput, 'key'> & { vc_id: string; opener_hash: string | null })[]>;
  saveOpener(vcId: string, opener: string | null, hash: string): Promise<void>;
  finishRun(runId: string): Promise<'done' | 'partial'>;
}

export type Collectors = {
  googleNews: (vc: VcContext) => Promise<CollectResult>;
  tavily: (vc: VcContext, key: string) => Promise<CollectResult>;
  rss: (url: string, source: 'person_rss' | 'firm_rss') => Promise<CollectResult>;
  enrich: (title: string, key: string) => Promise<{ ok: boolean; match: Enrichment | null; error?: string }>;
  linkedin: (vc: VcContext, key: string) => Promise<CollectResult>;
};

export type StepDeps = {
  store: Store;
  collectors?: Partial<Collectors>;
  classifyOpts: Omit<ClassifyOptions, 'persona'>;
  tavilyKey: string;
  tavilyBudget: number;
  enrichment?: boolean; // Phase 0 gate: on
  now?: () => Date;
  windowDays?: number;
};

export type PlanSource = {
  id: string; name: string; firm: string; thesis: string | null; status: VcContext['row']['status']; score: number | null; action: string | null;
  trust: string | null; tier: number | null; research: Record<string, unknown> | null; last_signal_date: string | null; signal_summary: string | null;
};

export type StepResult = { runId: string; done: boolean; processed: number; failed: number; remaining: number; status?: 'done' | 'partial'; deduped?: number; openers?: number };

const DEFAULT_COLLECTORS: Collectors = { googleNews, tavily, rss: rssFeed, enrich: enrichHeadline, linkedin: linkedinPosts };

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
    const reason = filterReason(it, vc, windowDays, now, { personRss: it.source === 'person_rss' || it.source === 'linkedin' }); // LinkedIn: author verified by handle
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
    const deduped = await applyPlanPass(store, await store.persona());
    // Openers for this week's cards (review item 5); failures never block finishing the run.
    let openers = 0;
    try { openers = (await refreshOpeners(store, deps.classifyOpts)).generated; } catch (e) { console.error('opener refresh failed', e); }
    const status = await store.finishRun(run.id);
    return { runId: run.id, done: true, processed: 0, failed: 0, remaining: 0, status, deduped, openers };
  }

  const contexts = await store.loadContexts(ids);
  const byId = new Map(contexts.map((c) => [c.id, c]));
  const errors: string[] = [];
  let tavilyLeft = Math.max(0, deps.tavilyBudget - (await store.tavilyCreditsThisMonth()));
  let tavilyUsed = 0;
  let geminiCalls = 0;
  const failed = new Set<string>();
  const persona = await store.persona();
  const classifyOpts = { ...deps.classifyOpts, persona };

  // 3. collect (concurrency 3). Firm feeds are fetched once per step and shared by that firm's VCs.
  const firmFeeds = new Map<string, Promise<CollectResult>>();
  const fetchStatus = new Map<string, FetchStatus>();
  const collected = await pool(contexts, COLLECT_CONCURRENCY, async (vc) => {
    const results: CollectResult[] = [await col.googleNews(vc)];
    if (results[0].items.length < 2 && tavilyLeft > 0) {
      tavilyLeft--; tavilyUsed++; // 1 credit per call, counted on attempt
      results.push(await col.tavily(vc, deps.tavilyKey));
    }
    // LinkedIn posts by the VC or their firm page (weekly; 1 Tavily credit). Marked checked only on success, so a
    // failed search is retried next run instead of waiting a week.
    if (linkedinDue(vc, now()) && tavilyLeft > 0) {
      tavilyLeft--; tavilyUsed++;
      const li = await col.linkedin(vc, deps.tavilyKey);
      results.push(li);
      if (li.ok) await store.markLinkedinChecked(vc.id);
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

  // 6a. enrichment (SPEC §9.2): ≤ ENRICH_PER_RUN accepted, snippet-less items that would decide a contact action
  // (Phase 5: reach out on news or fit, warm, or a nudge that references news).
  let enriched = 0;
  if (deps.enrichment !== false) {
    let budget = Math.max(0, ENRICH_PER_RUN - (await store.enrichedCount(run.id)));
    const toReclassify: ClassifyInput[] = [];
    for (const vc of contexts) {
      if (failed.has(vc.id) || budget <= 0) continue;
      const { decision, result } = await evaluate(store, vc, fetchStatus.get(vc.id) ?? 'failed', now(), windowDays, persona);
      if (!ENRICH_ROWS.includes(decision.row)) continue;
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
      await scoreAndWrite(store, vc, fetchStatus.get(vc.id) ?? 'failed', now(), windowDays, persona);
      await store.markProcessed(vc.id, fetchStatus.get(vc.id) ?? 'failed');
      processed++;
    } catch (e) {
      failed.add(vc.id);
      errors.push(`${vc.name}: write failed: ${(e as Error).message}`);
    }
  }

  // Release this step's claims: processed VCs stay excluded for the rest of the run by last_processed_at and failed
  // ones by failed_vc_ids, so a later run (even within 10 minutes) can claim them again.
  await store.releaseClaims(run.id, ids);

  // 8. heartbeat, counters, stats.
  await store.bumpRun(run.id, {
    tavily: tavilyUsed, gemini: geminiCalls, errors, failed: [...failed],
    stats: { [`step_${new Date(t0).toISOString()}`]: { vcs: ids.length, processed, failed: failed.size, inserted, classified: pending.length, enriched, ms: Date.now() - t0 } },
  });
  const remaining = await store.remaining({ ...run, failed_vc_ids: [...run.failed_vc_ids, ...failed] });
  return { runId: run.id, done: false, processed, failed: failed.size, remaining };
}

type Conflict = { company: string; date: string | null; evidence?: string };
type Evaluation = { decision: ActionResult; result: ScoreResult; signals: StoredSignal[]; conflict: Conflict | null; fit: Fit };

const DEFAULT_PERSONA: Persona = { targetSpace: '', myProduct: '' };

// Conflicts (SPEC §9.6, amended): any accepted competitor signal (any age, no thumbs-down), else a standing research
// conflict for this VC or a partner at the same firm, unless Vikram dismissed it.
export function findConflict(vc: VcContext, signals: StoredSignal[], persona: Persona): Conflict | null {
  if (vc.conflictDismissed) return null;
  const c = signals.filter((s) => s.status === 'accepted' && s.possible_competitor === true && !s.thumbs_down)
    .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))[0];
  if (c) return { company: c.funded_company ?? c.competitor_evidence ?? 'a likely competitor', date: c.published_at };
  const standing = researchConflict([(vc.research ?? null) as Research | null, ...((vc.peerResearch ?? []) as (Research | null)[])], competitorTerms(persona.myProduct));
  return standing ? { company: `a ${standing.term} company`, date: null, evidence: standing.evidence } : null;
}

export async function evaluate(store: Store, vc: VcContext, fetch: FetchStatus, now: Date, windowDays = SIGNAL_WINDOW_DAYS, persona: Persona = DEFAULT_PERSONA): Promise<Evaluation> {
  const signals = await store.scoringSignals(vc.id);
  const result = scoreSignals(signals, now, { windowDays });
  const conflict = findConflict(vc, signals, persona);
  const fit = fitScore({ tier: vc.tier ?? null, trust: vc.trust ?? null, thesis: vc.row.thesis, research: (vc.research ?? null) as Research | null }, persona.targetSpace, now);
  const decision = decideAction({
    status: vc.row.status,
    lastContactDate: vc.row.last_contact_date,
    fetchStatus: fetch,
    score: result.score,
    topRelevance: result.top?.signal.relevance ?? null,
    conflictCompany: conflict?.company ?? null,
    hasEvidence: meetsEvidenceFloor(result.counted.map((c) => c.signal)),
    active: result.counted.length > 0,
    fit,
    snoozedUntil: vc.snoozedUntil ?? null,
    ownerAdded: !!vc.ownerAdded,
    now,
  });
  return { decision, result, signals, conflict, fit };
}

export async function scoreAndWrite(store: Store, vc: VcContext, fetch: FetchStatus, now: Date, windowDays = SIGNAL_WINDOW_DAYS, persona: Persona = DEFAULT_PERSONA) {
  const { decision, result, signals, conflict } = await evaluate(store, vc, fetch, now, windowDays, persona);
  if (decision.keepOtherColumns) {
    // Row 3: only the action changes; the other three system columns keep their previous values.
    await store.applySignals(vc.id, vc.row.last_signal_date, vc.row.signal_summary, vc.row.follow_up_score, decision.action);
    return decision;
  }
  const last = lastSignalDate(signals);
  await store.applySignals(vc.id, last, summaryText(result, { conflict, lastSignalDate: last }), result.score, decision.action);
  return decision;
}

// Plan pass when a run finishes (including partial runs) and after every rescore: firm routing and weekly capacity.
export async function applyPlanPass(store: Store, persona: Persona, now = new Date()): Promise<number> {
  const src = await store.planRows();
  const rows = src.map((s) => ({
    ...s,
    priority: fitScore({ tier: s.tier, trust: s.trust, thesis: s.thesis, research: s.research as Research | null }, persona.targetSpace, now).score + 0.5 * (s.score ?? 0),
  }));
  const changes = planPass(rows);
  for (const ch of changes) {
    const row = src.find((x) => x.id === ch.id)!;
    await store.applySignals(row.id, row.last_signal_date, row.signal_summary, row.score, ch.action);
  }
  return changes.length;
}

// Recompute every VC's score and action from stored signals (no fetching, no classification), then firm dedupe.
// Used after a calibration change; Phase 3's per-VC rescore after a thumbs-down uses scoreAndWrite the same way.
export async function rescoreAll(store: Store, vcIds: string[], fetchStatusOf: (id: string) => FetchStatus, now = new Date()) {
  const persona = await store.persona();
  const contexts = await store.loadContexts(vcIds);
  for (const vc of contexts) await scoreAndWrite(store, vc, fetchStatusOf(vc.id), now, SIGNAL_WINDOW_DAYS, persona);
  return { rescored: contexts.length, deduped: await applyPlanPass(store, persona, now) };
}

// Generate (or regenerate) research-grounded openers for VCs whose research text or prompt version changed.
export async function refreshOpeners(store: Store, opts: Pick<ClassifyOptions, 'keys' | 'model' | 'generate'>) {
  const cands = await store.openerCandidates();
  const stale = cands.filter((c) => c.opener_hash !== openerHash(c)).slice(0, 50);
  if (!stale.length) return { generated: 0, calls: 0, errors: [] as string[] };
  const res = await generateOpeners(stale.map((c, i) => ({ key: i, vc_name: c.vc_name, firm: c.firm, thesis: c.thesis, fit_reason: c.fit_reason, latest_relevant_deal: c.latest_relevant_deal })), opts);
  if (res.calls && !res.openers.size) return { generated: 0, calls: res.calls, errors: res.errors }; // keep old openers if the call failed
  for (const [i, c] of stale.entries()) await store.saveOpener(c.vc_id, res.openers.get(i) ?? null, openerHash(c));
  return { generated: stale.length, calls: res.calls, errors: res.errors };
}
