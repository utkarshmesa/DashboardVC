import 'server-only';
import { DEFAULT_COMPANY_PROFILE, LOCK_STALE_MINUTES } from './config';
import { db } from './db';
import type { RunInfo, Store, Trigger } from './runner';
import type { FetchStatus, LabelUpdate, NewSignal, SignalRow, VcContext, VcRow } from './types';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

function must<T>(r: { data: T | null; error: { message: string; code?: string } | null }, what: string): T {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data as T;
}

const SIGNAL_COLS = 'id, vc_id, url, title, snippet, source, published_at, date_approx, status, reject_reason, subject, signal_type, about_this_vc, confidence, relevance, possible_competitor, competitor_evidence, event_key, summary';

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
    const profiles = must(await db().from('vc_profile').select('vc_id, firm_key, aliases, ambiguous_name').in('vc_id', ids), 'load profiles') as
      { vc_id: string; firm_key: string | null; aliases: string[] | null; ambiguous_name: boolean | null }[];
    const keys = [...new Set(profiles.map((p) => p.firm_key).filter((k): k is string => !!k))];
    const firms = keys.length ? must(await db().from('firms').select('firm_key, aliases').in('firm_key', keys), 'load firms') as { firm_key: string; aliases: string[] | null }[] : [];
    return rows.map((row): VcContext => {
      const p = profiles.find((x) => x.vc_id === row.id);
      const f = firms.find((x) => x.firm_key === p?.firm_key);
      return { id: row.id, name: row.name, firm: row.firm, aliases: p?.aliases ?? [], firmAliases: f?.aliases ?? [], ambiguous: !!p?.ambiguous_name, row };
    });
  },

  async tavilyCreditsThisMonth() {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const rows = must(await db().from('runs').select('tavily_credits').gte('started_at', monthStart), 'tavily credits') as { tavily_credits: number }[];
    return rows.reduce((s, r) => s + (r.tavily_credits ?? 0), 0);
  },

  async companyProfile() {
    const rows = must(await db().from('settings').select('value').eq('key', 'company_profile').limit(1), 'load persona') as { value: string }[];
    return rows[0]?.value ?? DEFAULT_COMPANY_PROFILE;
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
    return rows.map((r) => ({ ...r, relevance: r.relevance === null ? null : Number(r.relevance), thumbs_down: down.has(r.id) }));
  },

  async applySignals(vcId, lastSignalDate, summary, score, action) {
    must(await db().rpc('apply_signals', { p_id: vcId, p_last_signal_date: lastSignalDate, p_summary: summary, p_score: score, p_action: action }), 'apply_signals');
  },

  async markProcessed(vcId, fetchStatus: FetchStatus) {
    must(await db().from('vc_profile').update({ last_processed_at: new Date().toISOString(), last_fetch_status: fetchStatus }).eq('vc_id', vcId), 'mark processed');
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

  async finishRun(runId) {
    const r = must(await db().from('runs').select('failed_vc_ids').eq('id', runId).single(), 'load run') as { failed_vc_ids: string[] | null };
    const status = (r.failed_vc_ids ?? []).length ? 'partial' : 'done';
    must(await db().from('runs').update({ status, finished_at: new Date().toISOString(), heartbeat_at: new Date().toISOString() }).eq('id', runId).eq('status', 'running'), 'finish run');
    return status;
  },
};
