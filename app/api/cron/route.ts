// GET /api/cron — Vercel Cron (30 0 * * 1,4 = 06:00 IST Mon/Thu). Vercel sends `Authorization: Bearer $CRON_SECRET`.
import { CRON_MAX_DURATION_S } from '@/lib/config';
import { postDigestForRun } from '@/lib/digest-post';
import { runUntilDone } from '@/lib/pipeline';
import { bearerOk } from '@/lib/session';

export const maxDuration = 300; // = CRON_MAX_DURATION_S (Hobby maximum); must be a literal for Next.js
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!bearerOk(req.headers.get('authorization'), process.env.CRON_SECRET ?? '')) return new Response('Unauthorized', { status: 401 });
  try {
    const r = await runUntilDone('cron', { maxDurationS: CRON_MAX_DURATION_S });
    // Optional digest (review item 6); if this run overflows, the GitHub finisher posts it instead.
    const last = r.steps.at(-1);
    if (r.done && last) await postDigestForRun(last.runId, new URL('/', req.url).toString());
    return Response.json(r);
  } catch (e) {
    console.error('cron failed', e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
