import { appearanceQuery, googleNews, goldenQuery, hashUrl, newsQuery, tavily, type CollectResult, type RawItem } from './collectors.js';
import { classifyItems, GeminiFailed, newGeminiStats, type GeminiStats } from './classifier.js';
import { BATCH_SIZE, COLLECT_CONCURRENCY, SIGNAL_WINDOW_DAYS } from './config.js';
import type { Env } from './config.js';
import { filterReason, nameHit } from './filter.js';
import { containsPhrase, daysOld, normTitle } from './text.js';
import type { GoldenEvent, Item, SpikeVc } from './types.js';

type Log = (msg: string) => void;

export type RequestLog = { vc_id: string; kind: string; ok: boolean; status?: number; error?: string; count: number; ms: number };

async function pool<T, R>(xs: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(xs.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, xs.length) }, async () => {
    while (next < xs.length) { const i = next++; out[i] = await fn(xs[i]); }
  }));
  return out;
}

class ItemBuilder {
  private nextId: number;
  constructor(start = 1) { this.nextId = start; }
  // Dedupe within one VC by url_hash and title_norm, merging the query kinds that found the item.
  build(vcId: string, raws: RawItem[]): Item[] {
    const items: Item[] = [];
    const byHash = new Map<string, Item>(), byTitle = new Map<string, Item>();
    for (const r of raws) {
      const url_hash = hashUrl(r.url), title_norm = normTitle(r.title);
      const existing = byHash.get(url_hash) ?? byTitle.get(title_norm);
      if (existing) {
        if (!existing.sources.includes(r.kind)) existing.sources.push(r.kind);
        if (!existing.snippet && r.snippet) existing.snippet = r.snippet;
        if (!existing.published_at && r.published_at) { existing.published_at = r.published_at; existing.date_approx = false; }
        continue;
      }
      const it: Item = {
        item_id: this.nextId++, vc_id: vcId, url: r.url, url_hash, title: r.title, title_norm,
        snippet: r.snippet, source_name: r.source_name,
        published_at: r.published_at, date_approx: r.date_approx, sources: [r.kind],
        status: 'pending', reject_reason: null, labels: null, hook_dropped: false, competitor_cleared: false,
      };
      byHash.set(url_hash, it); byTitle.set(title_norm, it); items.push(it);
    }
    return items;
  }
}

export type SpikeOptions = {
  vcs: SpikeVc[];
  env: Env;
  tavilyCap: number;
  windowDays?: number;
  now?: Date;
  log?: Log;
  deadlineMs?: number; // stop starting new batches after this many ms
};

export type VcOutcome = { vc_id: string; fetch_status: 'ok' | 'partial' | 'failed'; gemini_failed: boolean; tavily: 'used' | 'not_needed' | 'skipped_cap' };

export async function runSpike(opts: SpikeOptions) {
  const t0 = Date.now();
  const now = opts.now ?? new Date();
  const windowDays = opts.windowDays ?? SIGNAL_WINDOW_DAYS;
  const log = opts.log ?? (() => {});
  const vcById = new Map(opts.vcs.map((v) => [v.id, v]));
  const gemini: GeminiStats = newGeminiStats();
  const ctx = { keys: opts.env.geminiKeys, model: opts.env.geminiModel, stats: gemini };
  const builder = new ItemBuilder();
  const items: Item[] = [];
  const requests: RequestLog[] = [];
  const outcomes: VcOutcome[] = [];
  const batchTimings: Array<{ batch: number; vcs: number; collectMs: number; classifyMs: number; totalMs: number; geminiCalls: number }> = [];
  const errors: string[] = [];
  let tavilyCredits = 0;

  for (let b = 0; b * BATCH_SIZE < opts.vcs.length; b++) {
    if (opts.deadlineMs && Date.now() - t0 > opts.deadlineMs) { errors.push(`deadline reached before batch ${b + 1}`); break; }
    const batch = opts.vcs.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);
    const bt0 = Date.now();
    const callsBefore = gemini.calls;

    const collected = await pool(batch, COLLECT_CONCURRENCY, async (vc) => {
      const record = (kind: string, r: CollectResult) => {
        requests.push({ vc_id: vc.id, kind, ok: r.ok, status: r.httpStatus, error: r.error, count: r.items.length, ms: r.ms });
        if (!r.ok) errors.push(`${kind} ${vc.name}: ${r.error}`);
      };
      const gn = await googleNews(newsQuery(vc), 'google_news'); record('google_news', gn);
      const ap = await googleNews(appearanceQuery(vc), 'google_news_appearance'); record('google_news_appearance', ap);
      const results = [gn, ap];
      const gnUnique = new ItemBuilder().build(vc.id, [...gn.items, ...ap.items]).length;
      let tav: VcOutcome['tavily'] = 'not_needed';
      if (gnUnique < 2) {
        if (tavilyCredits < opts.tavilyCap) {
          tavilyCredits++; // 1 credit per call, counted on attempt
          const tv = await tavily(`"${vc.name}" ${vc.firm}`, opts.env.tavilyKey); record('tavily', tv);
          results.push(tv); tav = 'used';
        } else tav = 'skipped_cap';
      }
      const okCount = results.filter((r) => r.ok).length;
      const fetch_status: VcOutcome['fetch_status'] = okCount === results.length ? 'ok' : okCount === 0 ? 'failed' : 'partial';
      return { vc, raws: results.flatMap((r) => r.items), fetch_status, tav };
    });
    const collectMs = Date.now() - bt0;

    const batchItems: Item[] = [];
    for (const c of collected) {
      const its = builder.build(c.vc.id, c.raws);
      for (const it of its) {
        const reason = filterReason(it, c.vc, windowDays, now);
        if (reason) { it.status = 'rejected'; it.reject_reason = reason; }
      }
      batchItems.push(...its);
    }
    items.push(...batchItems);

    const ct0 = Date.now();
    let geminiFailed = false;
    const pending = batchItems.filter((i) => i.status === 'pending');
    try {
      if (pending.length) await classifyItems(pending, vcById, ctx);
    } catch (e) {
      if (!(e instanceof GeminiFailed)) throw e;
      geminiFailed = true;
      errors.push(`batch ${b + 1}: ${e.message}; items left pending`);
    }
    for (const c of collected) outcomes.push({ vc_id: c.vc.id, fetch_status: c.fetch_status, gemini_failed: geminiFailed, tavily: c.tav });
    const classifyMs = Date.now() - ct0;
    batchTimings.push({ batch: b + 1, vcs: batch.length, collectMs, classifyMs, totalMs: Date.now() - bt0, geminiCalls: gemini.calls - callsBefore });
    log(`batch ${b + 1}: ${batch.length} VCs, ${batchItems.length} items, ${pending.length} to Gemini, ${batchItems.filter((i) => i.status === 'accepted').length} accepted, ${Date.now() - bt0} ms`);
  }

  const totalMs = Date.now() - t0;
  return {
    meta: { started_at: new Date(t0).toISOString(), window_days: windowDays, model: opts.env.geminiModel, tavily_cap: opts.tavilyCap, vcs: opts.vcs.map((v) => v.id) },
    metrics: computeMetrics({ vcs: opts.vcs, items, requests, outcomes, gemini, tavilyCredits, totalMs, windowDays, now }),
    batchTimings,
    gemini: { calls: gemini.calls, http429: gemini.http429, keyRotations: gemini.keyRotations, invalidJson: gemini.invalidJson, latenciesMs: gemini.latenciesMs },
    errors: [...errors, ...gemini.errors],
    outcomes,
    requests,
    items,
  };
}

function computeMetrics(a: {
  vcs: SpikeVc[]; items: Item[]; requests: RequestLog[]; outcomes: VcOutcome[]; gemini: GeminiStats;
  tavilyCredits: number; totalMs: number; windowDays: number; now: Date;
}) {
  const { items, vcs } = a;
  const vcById = new Map(vcs.map((v) => [v.id, v]));
  const inWindow = (i: Item) => !!i.published_at && daysOld(i.published_at, a.now) <= a.windowDays;
  const accepted = items.filter((i) => i.status === 'accepted');
  const acceptedScorable = accepted.filter((i) => inWindow(i) || i.date_approx);
  const tavilyItems = items.filter((i) => i.sources.includes('tavily'));
  const gnReqs = a.requests.filter((r) => r.kind.startsWith('google_news'));
  const pct = (n: number, d: number) => (d ? Math.round((1000 * n) / d) / 10 : 0);
  const bySource = (pred: (i: Item) => boolean) => Object.fromEntries(
    (['google_news', 'google_news_appearance', 'tavily'] as const).map((s) => {
      const xs = items.filter((i) => i.sources.includes(s));
      return [s, { items: xs.length, matching: xs.filter(pred).length }];
    }));
  const snippetBeyond = items.filter((i) => !!i.snippet);
  const appearanceOnly = accepted.filter((i) => i.sources.every((s) => s === 'google_news_appearance'));
  const appearanceAny = accepted.filter((i) => i.sources.includes('google_news_appearance'));
  const vcsWithItem = new Set(items.map((i) => i.vc_id));
  const vcsWithAccepted = new Set(acceptedScorable.map((i) => i.vc_id));
  const rejectReasons: Record<string, number> = {};
  for (const i of items) if (i.reject_reason) rejectReasons[i.reject_reason] = (rejectReasons[i.reject_reason] ?? 0) + 1;
  const types: Record<string, number> = {};
  for (const i of accepted) types[i.labels!.signal_type] = (types[i.labels!.signal_type] ?? 0) + 1;

  return {
    vcs: vcs.length,
    vcs_with_candidate_item: vcsWithItem.size,
    vcs_with_candidate_item_pct: pct(vcsWithItem.size, vcs.length),
    items_total_deduped: items.length,
    items_in_window_dated: items.filter(inWindow).length,
    items_undated: items.filter((i) => !i.published_at).length,
    items_passed_filter: items.filter((i) => !['out_of_window', 'no_name_or_firm', 'ambiguous_no_firm'].includes(i.reject_reason ?? '')).length,
    items_sent_to_gemini: items.filter((i) => i.labels || i.status === 'unclassified').length,
    items_accepted: accepted.length,
    items_accepted_scorable: acceptedScorable.length,
    vcs_with_inwindow_accepted: vcsWithAccepted.size,
    vcs_with_inwindow_accepted_pct: pct(vcsWithAccepted.size, vcs.length),
    accepted_by_type: types,
    appearance_only_accepted: appearanceOnly.length,
    appearance_any_accepted: appearanceAny.length,
    appearance_only_accepted_pct: pct(appearanceOnly.length, accepted.length),
    gemini_calls: a.gemini.calls,
    gemini_429s: a.gemini.http429,
    gemini_key_rotations: a.gemini.keyRotations,
    gemini_invalid_json: a.gemini.invalidJson,
    vcs_gemini_failed: a.outcomes.filter((o) => o.gemini_failed).length,
    items_unclassified: items.filter((i) => i.status === 'unclassified').length,
    items_left_pending: items.filter((i) => i.status === 'pending').length,
    tavily_credits: a.tavilyCredits,
    tavily_wanted: a.outcomes.filter((o) => o.tavily !== 'not_needed').length,
    tavily_skipped_cap: a.outcomes.filter((o) => o.tavily === 'skipped_cap').length,
    tavily_http_errors: a.requests.filter((r) => r.kind === 'tavily' && !r.ok).length,
    total_run_ms: a.totalMs,
    google_news_requests: gnReqs.length,
    google_news_http_errors: gnReqs.filter((r) => !r.ok).length,
    google_news_error_detail: gnReqs.filter((r) => !r.ok).map((r) => `${r.status ?? ''} ${r.error ?? ''}`.trim()),
    items_snippet_beyond_headline: snippetBeyond.length,
    items_snippet_beyond_headline_pct: pct(snippetBeyond.length, items.length),
    snippet_beyond_by_source: bySource((i) => !!i.snippet),
    accepted_naming_partner: accepted.filter((i) => nameHit(`${i.title} ${i.snippet ?? ''}`, vcById.get(i.vc_id)!)).length,
    tavily_items: tavilyItems.length,
    tavily_items_no_date: tavilyItems.filter((i) => !i.published_at).length,
    tavily_items_no_date_pct: pct(tavilyItems.filter((i) => !i.published_at).length, tavilyItems.length),
    fetch_status: {
      ok: a.outcomes.filter((o) => o.fetch_status === 'ok').length,
      partial: a.outcomes.filter((o) => o.fetch_status === 'partial').length,
      failed: a.outcomes.filter((o) => o.fetch_status === 'failed').length,
    },
    reject_reasons: rejectReasons,
    hooks_dropped_by_guard: items.filter((i) => i.hook_dropped).length,
    competitor_flags_accepted: accepted.filter((i) => i.labels!.possible_competitor).length,
    competitor_flags_cleared_by_guard: items.filter((i) => i.competitor_cleared).length,
  };
}

// ---------- Golden events (SPEC §13 Phase 0) ----------

export const GOLDEN_WINDOW_DAYS = 700;
const GOLDEN_MAX_CLASSIFY_PER_EVENT = 10;

export async function runGolden(events: GoldenEvent[], vcs: SpikeVc[], env: Env, opts: { now?: Date; log?: Log } = {}) {
  const t0 = Date.now();
  const now = opts.now ?? new Date();
  const log = opts.log ?? (() => {});
  const gemini = newGeminiStats();
  const builder = new ItemBuilder(100_000);
  const perEvent: Array<{
    event: GoldenEvent; query: string; ok: boolean; status?: number; error?: string;
    raw: RawItem[]; items: Item[]; candidates: Item[];
  }> = [];

  for (const ev of events) {
    const vc = vcs.find((v) => v.name === ev.tracked_vc && v.firm === ev.firm);
    if (!vc) throw new Error(`golden ${ev.id}: tracked VC not in seed`);
    const query = goldenQuery(ev.company, ev.firm);
    const r = await googleNews(query, 'golden');
    const its = builder.build(vc.id, r.items);
    // Classify only items that mention the company, newest first, capped per event.
    const candidates = its
      .filter((i) => containsPhrase(`${i.title} ${i.snippet ?? ''}`, ev.company))
      .sort((x, y) => (y.published_at ?? '').localeCompare(x.published_at ?? ''))
      .slice(0, GOLDEN_MAX_CLASSIFY_PER_EVENT);
    for (const it of candidates) {
      const reason = filterReason(it, vc, GOLDEN_WINDOW_DAYS, now);
      if (reason) { it.status = 'rejected'; it.reject_reason = reason; }
    }
    perEvent.push({ event: ev, query, ok: r.ok, status: r.httpStatus, error: r.error, raw: r.items, items: its, candidates });
    log(`golden ${ev.id}: ${r.ok ? 'ok' : r.error} raw=${r.items.length} mentioning=${candidates.length}`);
  }

  const vcById = new Map(vcs.map((v) => [v.id, v]));
  const pending = perEvent.flatMap((p) => p.candidates.filter((i) => i.status === 'pending'));
  let geminiError: string | null = null;
  try {
    if (pending.length) await classifyItems(pending, vcById, { keys: env.geminiKeys, model: env.geminiModel, stats: gemini });
  } catch (e) {
    if (!(e instanceof GeminiFailed)) throw e;
    geminiError = e.message;
  }

  const results = perEvent.map((p) => {
    const acc = p.candidates.filter((i) => i.status === 'accepted');
    const typed = acc.filter((i) => p.event.expected_types.includes(i.labels!.signal_type));
    const competitorOk = p.event.competitor_under_default_persona ? typed.some((i) => i.labels!.possible_competitor) : true;
    return {
      id: p.event.id, query: p.query, http_ok: p.ok, http_status: p.status, error: p.error,
      raw_items: p.raw.length, company_mentions: p.candidates.length,
      retrieved: p.candidates.length > 0,
      accepted_expected_type: typed.length > 0,
      competitor_expected: p.event.competitor_under_default_persona,
      competitor_ok: competitorOk,
      found: typed.length > 0 && competitorOk,
      best: typed[0] ?? acc[0] ?? p.candidates[0] ?? null,
      candidate_outcomes: p.candidates.map((i) => ({
        item_id: i.item_id, title: i.title, published_at: i.published_at, status: i.status, reject_reason: i.reject_reason,
        signal_type: i.labels?.signal_type ?? null, about_this_vc: i.labels?.about_this_vc ?? null,
        confidence: i.labels?.confidence ?? null, possible_competitor: i.labels?.possible_competitor ?? null,
        competitor_evidence: i.labels?.competitor_evidence ?? null,
      })),
    };
  });

  return {
    meta: { started_at: new Date(t0).toISOString(), window_days: GOLDEN_WINDOW_DAYS, model: env.geminiModel },
    summary: {
      events: results.length,
      retrieved: results.filter((r) => r.retrieved).length,
      found: results.filter((r) => r.found).length,
      gemini_calls: gemini.calls, gemini_429s: gemini.http429, gemini_error: geminiError,
      google_news_http_errors: perEvent.filter((p) => !p.ok).length,
      total_run_ms: Date.now() - t0,
    },
    results,
    gemini_errors: gemini.errors,
    perEvent, // raw items for fixtures; callers decide whether to persist
  };
}
