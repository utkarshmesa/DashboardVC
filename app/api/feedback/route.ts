// POST /api/feedback { signal_id, verdict: 'up' | 'down' | null, reason? } — Vikram's thumbs (SPEC §11.3).
// A thumbs-down removes the signal from scoring; either way the VC is rescored immediately from stored signals.
import { forbidden, ownerFromRequest } from '@/lib/auth';
import { z } from 'zod';
import { db } from '@/lib/db';
import { rescoreVc } from '@/lib/pipeline';

const Body = z.object({ signal_id: z.number().int().positive(), verdict: z.enum(['up', 'down']).nullable(), reason: z.string().max(500).optional() });

export async function POST(req: Request) {
  if (!ownerFromRequest(req)) return forbidden(); // view-only visitors can read, not write
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid body' }, { status: 400 });
  const { signal_id, verdict, reason } = parsed.data;
  const sig = await db().from('signals').select('vc_id').eq('id', signal_id).maybeSingle();
  if (sig.error) return Response.json({ error: sig.error.message }, { status: 500 });
  if (!sig.data) return Response.json({ error: 'signal not found' }, { status: 404 });
  const write = verdict
    ? await db().from('signal_feedback').upsert({ signal_id, verdict, reason: reason ?? null, created_at: new Date().toISOString() }, { onConflict: 'signal_id' })
    : await db().from('signal_feedback').delete().eq('signal_id', signal_id);
  if (write.error) return Response.json({ error: write.error.message }, { status: 500 });
  await rescoreVc(sig.data.vc_id);
  const vc = await db().from('vcs').select('follow_up_score, recommended_action, signal_summary').eq('id', sig.data.vc_id).single();
  return Response.json({ ok: true, vc: vc.data });
}
