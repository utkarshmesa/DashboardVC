// GET /api/vc/[id]/others — rejected and undated items for one VC, loaded only when the card's collapsed list opens
// (kept out of the dashboard payload, where they were ~40% of the page). Session-protected by proxy.ts like all /api/vc.
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'invalid id' }, { status: 400 });
  const r = await db().from('signals').select('id, title, url, status, reject_reason, published_at, date_approx')
    .eq('vc_id', id).or('status.neq.accepted,and(published_at.is.null,date_approx.eq.false)')
    .order('published_at', { ascending: false, nullsFirst: false }).limit(25);
  if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
  return Response.json({ items: (r.data ?? []).map((s) => ({ id: s.id, title: s.title, url: s.url, status: s.status, rejectReason: s.reject_reason })) });
}
