import { describe, expect, it } from 'vitest';
import { ACTIONS, decideAction, type ActionInput } from '@/lib/actions';

const NOW = new Date('2026-10-12T05:00:00Z');
const base: ActionInput = { status: 'not_contacted', lastContactDate: null, fetchStatus: 'ok', score: 0, topRelevance: null, conflictCompany: null, now: NOW };
const act = (o: Partial<ActionInput>) => decideAction({ ...base, ...o });

describe('action table (SPEC §9.6)', () => {
  it('row 1: passed wins over everything', () => {
    expect(act({ status: 'passed', score: 90, lastContactDate: '2026-10-11', fetchStatus: 'failed' }).action).toBe(ACTIONS.passed);
  });
  it('row 2: contacted within 7 days (inclusive), before fetch failure', () => {
    expect(act({ lastContactDate: '2026-10-05', fetchStatus: 'failed', score: 90 }).action).toBe(ACTIONS.wait);
    expect(act({ lastContactDate: '2026-10-04', score: 90 }).action).toBe(ACTIONS.reach);
  });
  it('row 3: fetch failed keeps the other columns', () => {
    const r = act({ fetchStatus: 'failed', score: 90 });
    expect(r.action).toBe(ACTIONS.unavailable);
    expect(r.keepOtherColumns).toBe(true);
  });
  it('row 4: conflict before contact actions', () => {
    expect(act({ conflictCompany: 'FreightCo', score: 90 }).action).toBe('Check conflict — backed FreightCo');
  });
  it('rows 5–7 by status at score ≥ REACH', () => {
    expect(act({ score: 50 }).action).toBe(ACTIONS.reach);
    expect(act({ score: 50, status: 'awaiting_response' }).action).toBe(ACTIONS.nudge);
    expect(act({ score: 50, status: 'in_conversation' }).action).toBe(ACTIONS.mention);
  });
  it('row 8: WARM ≤ score < REACH', () => {
    expect(act({ score: 25 }).action).toBe(ACTIONS.warm);
    expect(act({ score: 49 }).action).toBe(ACTIONS.warm);
  });
  it('rows 9a/9b split on top-signal relevance', () => {
    expect(act({ score: 10, topRelevance: 0.39 }).action).toBe(ACTIONS.lowOutside);
    expect(act({ score: 10, topRelevance: 0.4 }).action).toBe(ACTIONS.lowWeak);
  });
  it('row 10: no qualifying signal', () => {
    expect(act({ score: 0 }).action).toBe(ACTIONS.quiet);
  });
});
