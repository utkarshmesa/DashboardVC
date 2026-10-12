// POST /api/vc/[id]/quick { action } — one-click logging from a card (Phase 5 follow-up engine).
// Status and last-contact changes go through update_my_fields (Vikram's columns); snooze and conflict dismissal live on
// vc_profile. The VC is then rescored from stored signals, which also re-runs firm routing and the weekly cap.
import { z } from 'zod';
import { db } from '@/lib/db';
import { logEvent } from '@/lib/outcomes';
import { rescoreVc } from '@/lib/pipeline';

const Body = z.object({ action: z.enum(['emailed', 'replied', 'meeting', 'passed', 'snooze', 'unsnooze', 'dismiss_conflict', 'restore_conflict']) });
const SNOOZE_DAYS = 14;
const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ error: 'invalid id' }, { status: 400 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const cur = await db().from('vcs').select('status, last_contact_date, notes').eq('id', id).maybeSingle();
  if (cur.error) return Response.json({ error: cur.error.message }, { status: 500 });
  if (!cur.data) return Response.json({ error: 'not found' }, { status: 404 });
  const today = istToday();
  const mine = (status: string, date: string | null, notes: string | null) =>
    db().rpc('update_my_fields', { p_id: id, p_status: status, p_last_contact_date: date, p_notes: notes });
  const profile = (patch: Record<string, unknown>) => db().from('vc_profile').update(patch).eq('vc_id', id);

  const a = parsed.data.action;
  const res =
    a === 'emailed' ? await mine('awaiting_response', today, cur.data.notes)
    : a === 'replied' ? await mine('in_conversation', today, cur.data.notes)
    : a === 'meeting' ? await mine('in_conversation', today, [cur.data.notes, `Meeting booked ${today}`].filter(Boolean).join('\n'))
    : a === 'passed' ? await mine('passed', cur.data.last_contact_date, cur.data.notes)
    : a === 'snooze' ? await profile({ snoozed_until: new Date(Date.now() + SNOOZE_DAYS * 86_400_000).toISOString().slice(0, 10) })
    : a === 'unsnooze' ? await profile({ snoozed_until: null })
    : a === 'dismiss_conflict' ? await profile({ conflict_dismissed_at: new Date().toISOString() })
    : await profile({ conflict_dismissed_at: null });
  if (res.error) return Response.json({ error: res.error.message }, { status: 500 });
  const before = cur.data.status;
  const event = a === 'emailed' ? (before === 'not_contacted' ? 'emailed' : 'nudged') : a === 'replied' ? 'replied' : a === 'meeting' ? 'meeting'
    : a === 'passed' ? 'passed' : a === 'snooze' ? 'snoozed' : a === 'unsnooze' ? 'unsnoozed' : null;
  if (event) await logEvent(id, event, before, a === 'emailed' ? 'awaiting_response' : a === 'replied' || a === 'meeting' ? 'in_conversation' : a === 'passed' ? 'passed' : before);
  await rescoreVc(id);
  const vc = await db().from('vcs').select('status, last_contact_date, follow_up_score, recommended_action').eq('id', id).single();
  return Response.json({ ok: true, vc: vc.data });
}
