import { describe, expect, it } from 'vitest';
import { computeProgress, weekStartIst } from '@/lib/progress';

const NOW = new Date('2026-10-13T06:00:00Z'); // Tuesday 11:30 IST
const vcs = [
  { id: 'a', name: 'A', firm: 'FA', status: 'awaiting_response' },
  { id: 'b', name: 'B', firm: 'FB', status: 'in_conversation' },
  { id: 'c', name: 'C', firm: 'FC', status: 'not_contacted' },
  { id: 'd', name: 'D', firm: 'FD', status: 'passed' },
];
const at = (iso: string) => new Date(iso).toISOString();

describe('progress', () => {
  it('weeks start Monday 00:00 IST', () => {
    expect(new Date(weekStartIst(NOW)).toISOString()).toBe('2026-10-11T18:30:00.000Z');
    expect(new Date(weekStartIst(new Date('2026-10-11T18:29:00Z'))).toISOString()).toBe('2026-10-04T18:30:00.000Z'); // Sunday 23:59 IST
  });
  it('counts this week vs last week, the funnel, week of the raise and what was done this week', () => {
    const p = computeProgress([
      { vc_id: 'b', event: 'emailed', at: at('2026-09-20T05:00:00Z') },
      { vc_id: 'b', event: 'replied', at: at('2026-10-08T05:00:00Z') },
      { vc_id: 'd', event: 'emailed', at: at('2026-09-25T05:00:00Z') },
      { vc_id: 'd', event: 'passed', at: at('2026-10-12T04:00:00Z') },
      { vc_id: 'a', event: 'emailed', at: at('2026-10-12T05:00:00Z'), demo: true },
      { vc_id: 'b', event: 'meeting', at: at('2026-10-13T05:00:00Z') },
    ], vcs, NOW);
    expect(p.thisWeek).toEqual({ sent: 1, nudged: 0, replies: 0, meetings: 1 });
    expect(p.lastWeek).toEqual({ sent: 0, nudged: 0, replies: 1, meetings: 0 });
    expect(p.funnel).toMatchObject({ toContact: 1, awaiting: 1, conversation: 1, passed: 1, contacted: 3, replied: 1, meetings: 1 });
    expect(p.weekOfRaise).toBe(5); // first email Sun 20 Sep = week of 14 Sep; 12 Oct is week 5
    expect(p.done.map((d) => [d.name, d.event, d.demo])).toEqual([['B', 'meeting', false], ['A', 'emailed', true], ['D', 'passed', false]]);
  });
  it('no history: zeros and no week of the raise', () => {
    const p = computeProgress([], vcs.map((v) => ({ ...v, status: 'not_contacted' })), NOW);
    expect(p.weekOfRaise).toBeNull();
    expect(p.funnel.contacted).toBe(0);
    expect(p.done).toEqual([]);
  });
});
