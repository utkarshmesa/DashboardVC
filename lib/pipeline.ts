import 'server-only';
import { CRON_MAX_DURATION_S } from './config';
import { serverEnv } from './env';
import { step, type StepResult, type Trigger } from './runner';
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
