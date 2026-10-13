// POST /api/run/manual — one batch step for the dashboard's Run now (session-protected). The client loops until done.
import { runStep } from '@/lib/pipeline';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    return Response.json(await runStep('manual'));
  } catch (e) {
    console.error('manual step failed', e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
