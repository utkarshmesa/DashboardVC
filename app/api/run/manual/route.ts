// POST /api/run/manual — one batch step for the dashboard's Run now (session-protected). The client loops until done.
import { forbidden, ownerFromRequest } from '@/lib/auth';
import { runStep } from '@/lib/pipeline';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!ownerFromRequest(req)) return forbidden(); // view-only visitors can read, not write
  try {
    return Response.json(await runStep('manual'));
  } catch (e) {
    console.error('manual step failed', e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
