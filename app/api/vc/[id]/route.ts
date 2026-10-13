// PATCH /api/vc/[id] { status, last_contact_date, notes } — inline edit of Vikram's columns via update_my_fields
// (SPEC §11.5). The action depends on status and last contact, so the VC is rescored from stored signals afterwards.
import { forbidden, ownerFromRequest } from '@/lib/auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { statusEvent } from '@/lib/funnel';
import { logEvent } from '@/lib/outcomes';
import { rescoreVc } from '@/lib/pipeline';

const Body = z.object({
  status: z.enum(['not_contacted', 'awaiting_response', 'in_conversation', 'passed']),
  last_contact_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  notes: z.string().max(4000).nullable(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!ownerFromRequest(req)) return forbidden(); // view-only visitors can read, not write
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'invalid id' }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const b = parsed.data;
  const before = await db().from('vcs').select('status').eq('id', id).maybeSingle();
  const r = await db().rpc('update_my_fields', { p_id: id, p_status: b.status, p_last_contact_date: b.last_contact_date, p_notes: b.notes?.trim() || null });
  if (r.error) return Response.json({ error: r.error.message }, { status: 500 });
  const ev = before.data ? statusEvent(before.data.status, b.status) : null;
  if (ev) await logEvent(id, ev, before.data!.status, b.status);
  await rescoreVc(id);
  const vc = await db().from('vcs').select('*').eq('id', id).single();
  return Response.json({ ok: true, vc: vc.data });
}
