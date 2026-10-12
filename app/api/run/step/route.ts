// POST /api/run/step — one batch step (used by the optional GitHub finisher). Bearer CRON_SECRET.
import { postDigestForRun } from '@/lib/digest-post';
import { runStep } from '@/lib/pipeline';
import { bearerOk } from '@/lib/session';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!bearerOk(req.headers.get('authorization'), process.env.CRON_SECRET ?? '')) return new Response('Unauthorized', { status: 401 });
  try {
    const r = await runStep('github');
    // The finisher may complete an overflowing cron run; post the digest then (once per run, never for empty runs).
    if (r.done) await postDigestForRun(r.runId, new URL('/', req.url).toString());
    return Response.json(r);
  } catch (e) {
    console.error('step failed', e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
