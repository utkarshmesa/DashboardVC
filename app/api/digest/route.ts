// GET /api/digest (Bearer CRON_SECRET) — plain-text weekly digest of the plan (review item 6).
import { buildDigest } from '@/lib/digest';
import { loadDashboard } from '@/lib/dashboard';
import { bearerOk } from '@/lib/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  if (!bearerOk(req.headers.get('authorization'), process.env.CRON_SECRET ?? '')) return new Response('Unauthorized', { status: 401 });
  const { vcs } = await loadDashboard();
  const text = buildDigest(vcs.map((v) => ({ name: v.name, firm: v.firm, action: v.action, section: v.section, whyFit: v.whyFit, daysSinceContact: v.daysSinceContact, fitScore: v.fit.score, summary: v.summary })), new URL('/', req.url).toString());
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
