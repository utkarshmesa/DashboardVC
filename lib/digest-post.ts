import 'server-only';
import { db } from './db';
import { buildDigest, shouldPostDigest } from './digest';
import { loadDashboard } from './dashboard';

// Optional digest delivery (review item 6): Slack/Discord-compatible incoming webhook, only when configured.
// Called by whichever invocation finishes a run (the cron or the GitHub finisher). Posts once per run, and only for
// runs that processed VCs, so the finisher's empty no-op runs never post. Never throws.
export async function postDigestForRun(runId: string, appUrl: string): Promise<'posted' | 'skipped'> {
  const hook = process.env.DIGEST_WEBHOOK_URL;
  if (!hook) return 'skipped';
  try {
    const run = await db().from('runs').select('stats').eq('id', runId).single();
    const stats = (run.data?.stats ?? {}) as Record<string, unknown>;
    if (!shouldPostDigest(stats)) return 'skipped';
    await db().from('runs').update({ stats: { ...stats, digest_posted_at: new Date().toISOString() } }).eq('id', runId);
    const { vcs } = await loadDashboard();
    const text = buildDigest(vcs.map((v) => ({ name: v.name, firm: v.firm, action: v.action, section: v.section, whyFit: v.whyFit, daysSinceContact: v.daysSinceContact, fitScore: v.fit.score, summary: v.summary })), appUrl);
    const r = await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text.slice(0, 1900) }), signal: AbortSignal.timeout(10_000) });
    if (!r.ok) console.error('digest webhook HTTP', r.status);
    return 'posted';
  } catch (e) {
    console.error('digest webhook failed', e);
    return 'skipped';
  }
}
