// GET /api/run/estimate — numbers for the Run now confirmation.
import { runEstimate } from '@/lib/pipeline';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(await runEstimate());
}
