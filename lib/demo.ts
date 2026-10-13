import 'server-only';
// Labelled demo history (Plan V2, DECISIONS #55). The problem's Vikram is two months into his raise and waiting on
// replies, but he is fictional, so that history can never come from real use. Without it, follow-ups, the notes
// guarantee and progress tracking can't be seen. This writes a small, clearly labelled example history:
//   - Vikram's columns (status, last contact, notes) go through update_my_fields, the human write path; every note
//     starts with "[demo]" and says it is not a real interaction, and the dashboard badges those rows;
//   - outreach events are flagged demo = true;
//   - a row whose notes Vikram wrote himself is never touched; one call clears everything.
import { db } from './db';
import { DEMO_PREFIX, isDemoNote } from './demo-label';
import { rescoreMany } from './pipeline';

export { DEMO_PREFIX, isDemoNote };

type Event = { event: 'emailed' | 'nudged' | 'replied' | 'meeting' | 'passed'; daysAgo: number };
type Entry = { name: string; status: 'awaiting_response' | 'in_conversation' | 'passed'; lastContact: number; events: Event[]; story: string };

// Spread over two months so every follow-up rule shows up: close the loop (21+ days), nudge due (8–20), wait (< 8),
// next step due (in conversation, 10+ days), a booked meeting, and two passes.
const DEMO: Entry[] = [
  { name: 'Venkatesh Peddi', status: 'awaiting_response', lastContact: 34, events: [{ event: 'emailed', daysAgo: 34 }], story: 'cold email, no reply yet' },
  { name: 'Shekhar Kirani', status: 'awaiting_response', lastContact: 24, events: [{ event: 'emailed', daysAgo: 24 }], story: 'cold email, no reply yet' },
  { name: 'Vishesh Rajaram', status: 'awaiting_response', lastContact: 15, events: [{ event: 'emailed', daysAgo: 15 }], story: 'pitch form submitted, no reply yet' },
  { name: 'Poorvi Vijay', status: 'awaiting_response', lastContact: 12, events: [{ event: 'emailed', daysAgo: 12 }], story: 'cold email, no reply yet' },
  { name: 'Sunil Goyal', status: 'awaiting_response', lastContact: 9, events: [{ event: 'emailed', daysAgo: 9 }], story: 'LinkedIn message, no reply yet' },
  { name: 'Sateesh Andra', status: 'awaiting_response', lastContact: 3, events: [{ event: 'emailed', daysAgo: 3 }], story: 'cold email sent' },
  { name: 'Nishit Garg', status: 'awaiting_response', lastContact: 1, events: [{ event: 'emailed', daysAgo: 1 }], story: 'cold email sent' },
  { name: 'Mark Kahn', status: 'in_conversation', lastContact: 13, events: [{ event: 'emailed', daysAgo: 40 }, { event: 'replied', daysAgo: 30 }], story: 'replied asking for the deck; deck sent' },
  { name: 'Rohit Bansal', status: 'in_conversation', lastContact: 6, events: [{ event: 'emailed', daysAgo: 20 }, { event: 'replied', daysAgo: 12 }, { event: 'meeting', daysAgo: 6 }], story: 'intro call held; follow-up materials requested' },
  { name: 'Anand Lunia', status: 'passed', lastContact: 30, events: [{ event: 'emailed', daysAgo: 45 }, { event: 'passed', daysAgo: 30 }], story: 'passed: too early for them' },
  { name: 'Mitesh Shah', status: 'passed', lastContact: 25, events: [{ event: 'emailed', daysAgo: 38 }, { event: 'passed', daysAgo: 25 }], story: 'passed: outside their current focus' },
];

const dayIso = (now: Date, daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString().slice(0, 10);
const fmt = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });

export async function loadDemoHistory(now = new Date()): Promise<{ loaded: number; skipped: string[] }> {
  const vcs = await db().from('vcs').select('id, name, notes');
  if (vcs.error) throw new Error(vcs.error.message);
  const ids: string[] = [], skipped: string[] = [];
  for (const d of DEMO) {
    const vc = (vcs.data ?? []).find((v) => v.name === d.name);
    // Never touch a row Vikram has written notes on himself.
    if (!vc || (vc.notes && !isDemoNote(vc.notes))) { skipped.push(d.name); continue; }
    const last = dayIso(now, d.lastContact);
    const note = `${DEMO_PREFIX} Example history for the walkthrough, not a real interaction: ${d.story} (${fmt(last)}).`;
    const w = await db().rpc('update_my_fields', { p_id: vc.id, p_status: d.status, p_last_contact_date: last, p_notes: note });
    if (w.error) throw new Error(w.error.message);
    await db().from('outreach_events').delete().eq('vc_id', vc.id).eq('demo', true); // reloading never duplicates
    const statusAfter = (e: Event['event']) => (e === 'emailed' || e === 'nudged' ? 'awaiting_response' : e === 'passed' ? 'passed' : 'in_conversation');
    const ev = await db().from('outreach_events').insert(d.events.map((e) => ({
      vc_id: vc.id, event: e.event, status_after: statusAfter(e.event), at: new Date(now.getTime() - e.daysAgo * 86_400_000).toISOString(), demo: true,
    })));
    if (ev.error) throw new Error(ev.error.message);
    ids.push(vc.id);
  }
  await rescoreMany(ids);
  return { loaded: ids.length, skipped };
}

export async function clearDemoHistory(): Promise<number> {
  const rows = await db().from('vcs').select('id').like('notes', `${DEMO_PREFIX}%`);
  if (rows.error) throw new Error(rows.error.message);
  const ids = (rows.data ?? []).map((r) => r.id as string);
  for (const id of ids) {
    const w = await db().rpc('update_my_fields', { p_id: id, p_status: 'not_contacted', p_last_contact_date: null, p_notes: null });
    if (w.error) throw new Error(w.error.message);
  }
  const del = await db().from('outreach_events').delete().eq('demo', true);
  if (del.error) throw new Error(del.error.message);
  await rescoreMany(ids);
  return ids.length;
}

export async function demoActive(): Promise<boolean> {
  const r = await db().from('vcs').select('id', { count: 'exact', head: true }).like('notes', `${DEMO_PREFIX}%`);
  return (r.count ?? 0) > 0;
}
