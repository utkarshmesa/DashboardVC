// GET /api/cron — Vercel Cron (30 0 * * 1,4 = 06:00 IST Mon/Thu). Vercel sends `Authorization: Bearer $CRON_SECRET`.
import { CRON_MAX_DURATION_S } from '@/lib/config';
import { buildDigest } from '@/lib/digest';
import { loadDashboard } from '@/lib/dashboard';
import { runUntilDone } from '@/lib/pipeline';
import { bearerOk } from '@/lib/session';

export const maxDuration = 300; // = CRON_MAX_DURATION_S (Hobby maximum); must be a literal for Next.js
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!bearerOk(req.headers.get('authorization'), process.env.CRON_SECRET ?? '')) return new Response('Unauthorized', { status: 401 });
  try {
    const r = await runUntilDone('cron', { maxDurationS: CRON_MAX_DURATION_S });
    // Optional digest delivery (review item 6): Slack/Discord-compatible incoming webhook, only when configured.
    const hook = process.env.DIGEST_WEBHOOK_URL;
    if (hook && r.done) {
      try {
        const { vcs } = await loadDashboard();
        const text = buildDigest(vcs.map((v) => ({ name: v.name, firm: v.firm, action: v.action, section: v.section, whyFit: v.whyFit, daysSinceContact: v.daysSinceContact, fitScore: v.fit.score })), new URL('/', req.url).toString());
        await fetch(hook, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, content: text.slice(0, 1900) }), signal: AbortSignal.timeout(10_000) });
      } catch (e) { console.error('digest webhook failed', e); }
    }
    return Response.json(r);
  } catch (e) {
    console.error('cron failed', e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
