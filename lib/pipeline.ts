import 'server-only';
import { CRON_MAX_DURATION_S } from './config';
import { serverEnv } from './env';
import { db } from './db';
import { rescoreAll, step, type StepResult, type Trigger } from './runner';
import type { FetchStatus } from './types';
import { supabaseStore } from './store';

export function runStep(trigger: Trigger, force = false): Promise<StepResult> {
  const env = serverEnv(['supabase', 'gemini', 'tavily']);
  return step({ trigger, force }, {
    store: supabaseStore,
    classifyOpts: { keys: env.geminiKeys, model: env.geminiModel },
    tavilyKey: env.tavilyKey,
    tavilyBudget: env.tavilyBudget,
    enrichment: true, // Phase 0 gate (docs/DECISIONS.md)
  });
}

// Loops steps until the run is done or the next step might not fit: SPEC §9.1 stops 10 s before maxDuration;
// since one step can take over a minute (Gemini latency), we also reserve the longest step seen so far.
export async function runUntilDone(trigger: Trigger, opts: { force?: boolean; maxDurationS?: number } = {}) {
  const limitMs = (opts.maxDurationS ?? CRON_MAX_DURATION_S) * 1000;
  const t0 = Date.now();
  const steps: StepResult[] = [];
  let longest = 0;
  for (;;) {
    const s0 = Date.now();
    const r = await runStep(trigger, opts.force);
    steps.push(r);
    longest = Math.max(longest, Date.now() - s0);
    if (r.done) break;
    if (Date.now() - t0 + longest + 10_000 > limitMs) break;
  }
  return { steps, done: steps.at(-1)?.done ?? false, ms: Date.now() - t0 };
}

// SPEC §11.3 rescore(vc_id): recompute score and action from stored signals (no fetching) via apply_signals, then
// re-run firm dedupe so two partners at one firm never both show a contact action.
export async function rescoreVc(vcId: string) {
  const r = await db().from('vc_profile').select('last_fetch_status').eq('vc_id', vcId).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  const fetch = (r.data?.last_fetch_status ?? 'ok') as FetchStatus;
  return rescoreAll(supabaseStore, [vcId], () => fetch);
}

// Rescore several VCs (e.g. after loading or clearing the demo history), keeping each one's last fetch status.
export async function rescoreMany(vcIds: string[]) {
  if (!vcIds.length) return { rescored: 0, deduped: 0 };
  const r = await db().from('vc_profile').select('vc_id, last_fetch_status').in('vc_id', vcIds);
  if (r.error) throw new Error(r.error.message);
  const status = new Map((r.data ?? []).map((x) => [x.vc_id as string, (x.last_fetch_status ?? 'ok') as FetchStatus]));
  return rescoreAll(supabaseStore, vcIds, (id) => status.get(id) ?? 'ok');
}

// Estimate for the Run now confirmation: VCs due (not processed in the last 24 h) and the Tavily credits they could use.
export async function runEstimate() {
  const env = serverEnv(['supabase', 'tavily']);
  const now = new Date().toISOString();
  const due = await supabaseStore.remaining({ id: 'estimate', started_at: now, force: false, failed_vc_ids: [] });
  const left = Math.max(0, env.tavilyBudget - (await supabaseStore.tavilyCreditsThisMonth()));
  return { due, maxCredits: Math.min(due, left), budgetLeft: left };
}
