// Progress and to-do bookkeeping (Plan V2, owner request): what Vikram has done this week, how the raise is moving,
// and which week of the raise this is. Pure: the page passes in the event log and the VC list.
import { OUTREACH_PER_WEEK } from './config';

export type ProgressEvent = { vc_id: string; event: string; at: string; demo?: boolean | null };
export type ProgressVc = { id: string; name: string; firm: string; status: string };

const IST_MS = 5.5 * 3_600_000;
// Monday 00:00 IST of the week containing `d`, as a UTC timestamp.
export function weekStartIst(d: Date): number {
  const ist = new Date(d.getTime() + IST_MS);
  const day = (ist.getUTCDay() + 6) % 7; // Monday = 0
  return Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - day) - IST_MS;
}

const DONE_EVENTS = ['emailed', 'nudged', 'replied', 'meeting', 'passed'] as const;
export const DONE_LABEL: Record<string, string> = { emailed: 'Sent first email to', nudged: 'Followed up with', replied: 'Got a reply from', meeting: 'Booked a meeting with', passed: 'Closed out' };

export type Progress = {
  funnel: { toContact: number; awaiting: number; conversation: number; passed: number; contacted: number; replied: number; meetings: number };
  thisWeek: { sent: number; nudged: number; replies: number; meetings: number };
  lastWeek: { sent: number; nudged: number; replies: number; meetings: number };
  target: number;
  weekOfRaise: number | null; // 1-based, from the first logged email
  done: { vcId: string; name: string; firm: string; event: string; at: string; demo: boolean }[]; // this week, newest first
};

export function computeProgress(events: ProgressEvent[], vcs: ProgressVc[], now = new Date()): Progress {
  const start = weekStartIst(now), prev = start - 7 * 86_400_000;
  const tally = (from: number, to: number) => {
    const xs = events.filter((e) => { const t = Date.parse(e.at); return t >= from && t < to; });
    const n = (k: string) => xs.filter((e) => e.event === k).length;
    return { sent: n('emailed'), nudged: n('nudged'), replies: n('replied'), meetings: n('meeting') };
  };
  const byVc = new Map(vcs.map((v) => [v.id, v]));
  const first = events.filter((e) => e.event === 'emailed').map((e) => Date.parse(e.at)).sort((a, b) => a - b)[0];
  const repliedVcs = new Set(events.filter((e) => e.event === 'replied' || e.event === 'meeting').map((e) => e.vc_id));
  const contactedVcs = new Set(events.filter((e) => e.event === 'emailed').map((e) => e.vc_id));
  for (const v of vcs) if (v.status !== 'not_contacted') contactedVcs.add(v.id);
  const count = (s: string) => vcs.filter((v) => v.status === s).length;
  return {
    funnel: {
      toContact: count('not_contacted'), awaiting: count('awaiting_response'), conversation: count('in_conversation'), passed: count('passed'),
      contacted: contactedVcs.size, replied: repliedVcs.size, meetings: new Set(events.filter((e) => e.event === 'meeting').map((e) => e.vc_id)).size,
    },
    thisWeek: tally(start, Infinity),
    lastWeek: tally(prev, start),
    target: OUTREACH_PER_WEEK,
    weekOfRaise: first === undefined ? null : Math.floor((start - weekStartIst(new Date(first))) / (7 * 86_400_000)) + 1,
    done: events
      .filter((e) => Date.parse(e.at) >= start && (DONE_EVENTS as readonly string[]).includes(e.event) && byVc.has(e.vc_id))
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((e) => ({ vcId: e.vc_id, name: byVc.get(e.vc_id)!.name, firm: byVc.get(e.vc_id)!.firm, event: e.event, at: e.at, demo: !!e.demo })),
  };
}
