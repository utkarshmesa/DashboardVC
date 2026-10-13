// GET /api/run/estimate — numbers for the Run now confirmation.
import { forbidden, ownerFromRequest } from '@/lib/auth';
import { runEstimate } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!ownerFromRequest(req)) return forbidden(); // view-only visitors can read, not write
  return Response.json(await runEstimate());
}
