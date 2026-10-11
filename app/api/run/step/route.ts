// POST /api/run/step — one batch step (used by the optional GitHub finisher). Bearer CRON_SECRET.
import { runStep } from '@/lib/pipeline';
import { bearerOk } from '@/lib/session';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!bearerOk(req.headers.get('authorization'), process.env.CRON_SECRET ?? '')) return new Response('Unauthorized', { status: 401 });
  try {
    return Response.json(await runStep('github'));
  } catch (e) {
    console.error('step failed', e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
