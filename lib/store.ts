import 'server-only';
import { DEFAULT_MY_PRODUCT, DEFAULT_TARGET_SPACE, LOCK_STALE_MINUTES } from './config';
import { db } from './db';
import type { RunInfo, Store, StoredSignal, Trigger } from './runner';
import type { FetchStatus, LabelUpdate, NewSignal, SignalRow, VcContext, VcRow } from './types';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function must<T>(r: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
}

const SIGNAL_COLS = 'id, vc_id, url, title, snippet, source, published_at, date_approx, status, reject_reason, subject, signal_type, about_this_vc, confidence, relevance, relevance_level, possible_competitor, competitor_evidence, funded_company, role_change_hint, event_key, summary, enriched_run';

export const supabaseStore: Store = {
  // SPEC §9.1 step 0: default vc_profile for any vcs row without one; firm_key matched by firm name or alias.
  async ensureProfiles() {
    const vcs = must(await db().from('vcs').select('id, firm'), 'load vcs') as { id: string; firm: string }[];
    const have = new Set((must(await db().from('vc_profile').select('vc_id'), 'load profiles') as { vc_id: string }[]).map((p) => p.vc_id));
    const missing = vcs.filter((v) => !have.has(v.id));
    if (!missing.length) return 0;
    const firms = must(await db().from('firms').select('firm_key, display_name, aliases'), 'load firms') as { firm_key: string; display_name: string; aliases: string[] }[];
    const keyFor = (firm: string) => firms.find((f) => norm(f.display_name) === norm(firm) || (f.aliases ?? []).some((a) => norm(a) === norm(firm)))?.firm_key ?? null;
    must(await db().from('vc_profile').insert(missing.map((v) => ({ vc_id: v.id, firm_key: keyFor(v.firm) }))), 'insert profiles');
    return missing.length;
  },

  // SPEC §9.1 step 1: reuse a live running run, fail a stale one, else create one (unique index stops a second).
  async acquireRun(trigger: Trigger, force: boolean) {
    const toInfo = (r: { id: string; started_at: string; force: boolean; failed_vc_ids: string[] | null }): RunInfo =>
      ({ id: r.id, started_at: r.started_at, force: r.force, failed_vc_ids: r.failed_vc_ids ?? [] });
    for (let attempt = 0; attempt < 3; attempt++) {
      const running = must(await db().from('runs').select('id, started_at, force, failed_vc_ids, heartbeat_at').eq('status', 'running').limit(1), 'load running run') as
        { id: string; started_at: string; force: boolean; failed_vc_ids: string[]; heartbeat_at: string }[];
      if (running.length) {
        const r = running[0];
        if (Date.now() - Date.parse(r.heartbeat_at) < LOCK_STALE_MINUTES * 60_000) return toInfo(r);
        must(await db().from('runs').update({ status: 'failed', finished_at: new Date().toISOString() }).eq('id', r.id).eq('status', 'running'), 'fail stale run');
      }
      const ins = await db().from('runs').insert({ trigger, force }).select('id, started_at, force, failed_vc_ids').single();
      if (!ins.error) return toInfo(ins.data);
      if (ins.error.code !== '23505') throw new Error(`create run: ${ins.error.message}`); // lost a race: re-read
    }
    throw new Error('could not acquire run lock');
  },

  async claimBatch(run, n) {
    const data = must(await db().rpc('claim_batch', { p_run: run.id, p_started: run.started_at, p_force: run.force, p_failed: run.failed_vc_ids, p_n: n }), 'claim_batch') as unknown[];
    return (data ?? []).map((x) => (typeof x === 'string' ? x : (x as { claim_batch: string }).claim_batch));
  },

  async loadContexts(ids) {
    const rows = must(await db().from('vcs').select('*').in('id', ids), 'load vcs') as VcRow[];
    const profiles = must(await db().from('vc_profile').select('vc_id, firm_key, aliases, ambiguous_name, tier, trust, research, snoozed_until, conflict_dismissed_at').in('vc_id', ids), 'load profiles') as
      { vc_id: string; firm_key: string | null; aliases: string[] | null; ambiguous_name: boolean | null; tier: number | null; trust: string | null;
        research: Record<string, unknown> | null; snoozed_until: string | null; conflict_dismissed_at: string | null }[];
    // Partners at the same firm (by firm name) for firm-level standing conflicts.
    const firmNames = [...new Set(rows.map((r) => r.firm))];
    const peers = firmNames.length ? must(await db().from('vcs').select('id, firm').in('firm', firmNames), 'load firm peers') as { id: string; firm: string }[] : [];
    const peerProf = peers.length ? must(await db().from('vc_profile').select('vc_id, research').in('vc_id', peers.map((p) => p.id)), 'load peer research') as { vc_id: string; research: Record<string, unknown> | null }[] : [];
    const keys = [...new Set(profiles.map((p) => p.firm_key).filter((k): k is string => !!k))];
    const firms = keys.length ? must(await db().from('firms').select('firm_key, aliases, firm_rss').in('firm_key', keys), 'load firms') as { firm_key: string; aliases: string[] | null; firm_rss: string | null }[] : [];
    return rows.map((row): VcContext => {
      const p = profiles.find((x) => x.vc_id === row.id);
      const f = firms.find((x) => x.firm_key === p?.firm_key);
      const peerResearch = peers.filter((x) => x.firm === row.firm && x.id !== row.id).map((x) => peerProf.find((y) => y.vc_id === x.id)?.research ?? null);
      return { id: row.id, name: row.name, firm: row.firm, aliases: p?.aliases ?? [], firmAliases: f?.aliases ?? [], ambiguous: !!p?.ambiguous_name, firmRss: f?.firm_rss ?? null, row,
        tier: p?.tier ?? null, trust: p?.trust ?? null, research: p?.research ?? null, peerResearch, snoozedUntil: p?.snoozed_until ?? null, conflictDismissed: !!p?.conflict_dismissed_at };
    });
  },

  async tavilyCreditsThisMonth() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const rows = must(await db().from('runs').select('tavily_credits').gte('started_at', monthStart), 'tavily credits') as { tavily_credits: number }[];
    return rows.reduce((s, r) => s + (r.tavily_credits ?? 0), 0);
  },

  async persona() {
    return loadPersona();
  },

  async insertSignals(rows: NewSignal[]) {
    if (!rows.length) return 0;
    return must(await db().rpc('insert_signals', { p_rows: rows }), 'insert_signals') as number;
  },

  async pendingSignals(vcIds) {
    return must(await db().from('signals').select(SIGNAL_COLS).in('vc_id', vcIds).eq('status', 'pending').order('id'), 'pending signals') as SignalRow[];
  },

  async saveLabels(updates: LabelUpdate[], unclassifiedIds: number[]) {
    for (let i = 0; i < updates.length; i += 10) {
      await Promise.all(updates.slice(i, i + 10).map(async ({ id, ...u }) => {
        must(await db().from('signals').update(u).eq('id', id), `save labels ${id}`);
      }));
    }
    if (unclassifiedIds.length) {
      must(await db().from('signals').update({ status: 'unclassified', reject_reason: 'llm_missing_or_invalid' }).in('id', unclassifiedIds), 'mark unclassified');
    }
  },

  async scoringSignals(vcId) {
    const rows = must(await db().from('signals').select(SIGNAL_COLS).eq('vc_id', vcId).eq('status', 'accepted'), 'scoring signals') as SignalRow[];
    if (!rows.length) return [];
    const downs = must(await db().from('signal_feedback').select('signal_id').eq('verdict', 'down').in('signal_id', rows.map((r) => r.id)), 'feedback') as { signal_id: number }[];
    const down = new Set(downs.map((d) => d.signal_id));
    return rows.map((r): StoredSignal => ({ ...r, relevance: r.relevance === null ? null : Number(r.relevance), thumbs_down: down.has(r.id) }));
  },

  async enrichedCount(runId) {
    const r = await db().from('signals').select('id', { count: 'exact', head: true }).eq('enriched_run', runId);
    if (r.error) throw new Error(`enriched count: ${r.error.message}`);
    return r.count ?? 0;
  },

  // Adds the enrichment snippet and canonical URL, and sends the item back to the classifier.
  // If the canonical URL already exists for this VC, keep the original URL (unique key) but still add the snippet.
  async enrichSignal(id, e) {
    const base = { snippet: e.snippet, enriched_run: e.runId, status: 'pending', reject_reason: null };
    const r = await db().from('signals').update({ ...base, url: e.url, url_hash: e.url_hash }).eq('id', id);
    if (!r.error) return true;
    if (r.error.code !== '23505') throw new Error(`enrich signal: ${r.error.message}`);
    must(await db().from('signals').update(base).eq('id', id), 'enrich signal');
    return true;
  },

  async planRows() {
    const vcs = must(await db().from('vcs').select('id, name, firm, thesis, status, follow_up_score, recommended_action, last_signal_date, signal_summary'), 'load vcs') as
      { id: string; name: string; firm: string; thesis: string | null; status: VcRow['status']; follow_up_score: number | null; recommended_action: string | null; last_signal_date: string | null; signal_summary: string | null }[];
    const prof = must(await db().from('vc_profile').select('vc_id, trust, tier, research'), 'load profiles') as { vc_id: string; trust: string | null; tier: number | null; research: Record<string, unknown> | null }[];
    return vcs.map((v) => {
      const p = prof.find((x) => x.vc_id === v.id);
      return { id: v.id, name: v.name, firm: v.firm, thesis: v.thesis, status: v.status, score: v.follow_up_score, action: v.recommended_action,
        trust: p?.trust ?? null, tier: p?.tier ?? null, research: p?.research ?? null, last_signal_date: v.last_signal_date, signal_summary: v.signal_summary };
    });
  },

  async applySignals(vcId, lastSignalDate, summary, score, action) {
    must(await db().rpc('apply_signals', { p_id: vcId, p_last_signal_date: lastSignalDate, p_summary: summary, p_score: score, p_action: action }), 'apply_signals');
  },

  async markProcessed(vcId, fetchStatus: FetchStatus) {
    must(await db().from('vc_profile').update({ last_processed_at: new Date().toISOString(), last_fetch_status: fetchStatus }).eq('vc_id', vcId), 'mark processed');
  },

  async releaseClaims(runId, vcIds) {
    if (!vcIds.length) return;
    must(await db().from('vc_profile').update({ claimed_run: null, claimed_at: null }).in('vc_id', vcIds).eq('claimed_run', runId), 'release claims');
  },

  async bumpRun(runId, d) {
    must(await db().rpc('bump_run', { p_run: runId, p_tavily: d.tavily, p_gemini: d.gemini, p_errors: d.errors, p_failed: d.failed, p_stats: d.stats }), 'bump_run');
  },

  // Mirrors claim_batch's eligibility: not processed since the run started (or in the last 24 h unless forced), not failed.
  async remaining(run) {
    const cutoff = run.force ? run.started_at : new Date(Math.min(Date.parse(run.started_at), Date.now() - 86_400_000)).toISOString();
    let q = db().from('vc_profile').select('vc_id', { count: 'exact', head: true }).or(`last_processed_at.is.null,last_processed_at.lt.${cutoff}`);
    if (run.failed_vc_ids.length) q = q.not('vc_id', 'in', `(${run.failed_vc_ids.join(',')})`);
    const r = await q;
    if (r.error) throw new Error(`remaining: ${r.error.message}`);
    return r.count ?? 0;
  },

  // Openers (review item 5): VCs that may get a draft this week, with the research the opener is grounded in.
  async openerCandidates() {
    const vcs = must(await db().from('vcs').select('id, name, firm, thesis, recommended_action'), 'load vcs') as { id: string; name: string; firm: string; thesis: string | null; recommended_action: string | null }[];
    const keep = vcs.filter((v) => /^(Reach out|Warm|Good fit|Nudge|Close the loop|Next step|Check conflict)/.test(v.recommended_action ?? ''));
    if (!keep.length) return [];
    const prof = must(await db().from('vc_profile').select('vc_id, research, opener_hash').in('vc_id', keep.map((v) => v.id)), 'load profiles') as { vc_id: string; research: Record<string, unknown> | null; opener_hash: string | null }[];
    return keep.map((v) => {
      const p = prof.find((x) => x.vc_id === v.id);
      return { vc_id: v.id, vc_name: v.name, firm: v.firm, thesis: v.thesis, fit_reason: (p?.research?.fit_reason as string) ?? null,
        latest_relevant_deal: (p?.research?.latest_relevant_deal as string) ?? null, opener_hash: p?.opener_hash ?? null };
    });
  },

  async saveOpener(vcId, opener, hash) {
    must(await db().from('vc_profile').update({ opener, opener_hash: hash, opener_at: new Date().toISOString() }).eq('vc_id', vcId), 'save opener');
  },

  async finishRun(runId) {
    const r = must(await db().from('runs').select('failed_vc_ids').eq('id', runId).single(), 'load run') as { failed_vc_ids: string[] | null };
    const status = (r.failed_vc_ids ?? []).length ? 'partial' : 'done';
    must(await db().from('runs').update({ status, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq('id', runId).eq('status', 'running'), 'finish run');
    return status;
  },
};

// SPEC §2 settings: target_space drives relevance, my_product drives possible_competitor (empty = never a competitor).
export async function loadPersona(): Promise<{ targetSpace: string; myProduct: string }> {
  const rows = must(await db().from('settings').select('key, value').in('key', ['target_space', 'my_product']), 'load settings') as { key: string; value: string }[];
  const get = (k: string) => rows.find((r) => r.key === k)?.value;
  return { targetSpace: get('target_space') ?? DEFAULT_TARGET_SPACE, myProduct: get('my_product') ?? DEFAULT_MY_PRODUCT };
}

// Persona text goes into every Gemini prompt; cap it so a paste accident cannot blow the token budget.
const PERSONA_MAX = 2000;

// Saving either setting resets every in-window signal that reached the classifier to pending, so the next run
// reclassifies it against the new settings. my_product may be empty; target_space may not.
export async function setSettings(next: { targetSpace?: string; myProduct?: string }, windowDays: number): Promise<number> {
  const rows: { key: string; value: string; updated_at: string }[] = [];
  const now = new Date().toISOString();
  if (next.targetSpace !== undefined) {
    if (!next.targetSpace.trim()) throw new Error('target space cannot be empty');
    rows.push({ key: 'target_space', value: next.targetSpace.trim().slice(0, PERSONA_MAX), updated_at: now });
  }
  if (next.myProduct !== undefined) rows.push({ key: 'my_product', value: next.myProduct.trim().slice(0, PERSONA_MAX), updated_at: now });
  if (!rows.length) return 0;
  must(await db().from('settings').upsert(rows, { onConflict: 'key' }), 'save settings');
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString();
  const r = await db().from('signals')
    .update({ status: 'pending', reject_reason: null }, { count: 'exact' })
    .in('status', ['accepted', 'rejected', 'unclassified'])
    .or('about_this_vc.not.is.null,status.eq.unclassified')
    .or(`published_at.gte.${since},published_at.is.null`);
  if (r.error) throw new Error(`reset signals: ${r.error.message}`);
  return r.count ?? 0;
}

// Draft settings (review item 5): Vikram's own pitch line, sender name and ask. Changing them never reclassifies signals.
export async function loadDraftSettings(): Promise<{ pitch: string; senderName: string; ask: string }> {
  const rows = must(await db().from('settings').select('key, value').in('key', ['my_pitch', 'sender_name', 'outreach_ask']), 'load draft settings') as { key: string; value: string }[];
  const get = (k: string) => rows.find((r) => r.key === k)?.value ?? '';
  return { pitch: get('my_pitch'), senderName: get('sender_name'), ask: get('outreach_ask') };
}

export async function saveDraftSettings(d: { pitch: string; senderName: string; ask: string }) {
  const now = new Date().toISOString();
  must(await db().from('settings').upsert([
    { key: 'my_pitch', value: d.pitch.trim().slice(0, 600), updated_at: now }, { key: 'sender_name', value: d.senderName.trim().slice(0, 80), updated_at: now }, { key: 'outreach_ask', value: d.ask.trim().slice(0, 300), updated_at: now },
  ], { onConflict: 'key' }), 'save draft settings');
}
