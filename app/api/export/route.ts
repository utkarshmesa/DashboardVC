// Download the whole pipeline as a CSV (his columns and the four the pipeline writes).
import { exportCsv } from '@/lib/import';

export const dynamic = 'force-dynamic';

export async function GET() {
  const csv = await exportCsv();
  const day = new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);
  return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="vc-pipeline-${day}.csv"`, 'Cache-Control': 'no-store' } });
}
