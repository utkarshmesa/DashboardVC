import { describe, expect, it } from 'vitest';
import { ACTIONS, decideAction, firmDedupe, meetsEvidenceFloor, sameFirm, type ActionInput, type DedupeRow } from '@/lib/actions';

const NOW = new Date('2026-10-12T05:00:00Z');
const base: ActionInput = { status: 'not_contacted', lastContactDate: null, fetchStatus: 'ok', score: 0, topRelevance: null, conflictCompany: null, hasEvidence: true, now: NOW };
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

describe('evidence floor (rows 5–7)', () => {
  it('without strong evidence a high score falls through to Warm, not a contact action', () => {
    expect(act({ score: 90, hasEvidence: false }).action).toBe(ACTIONS.warm);
    expect(act({ score: 90, hasEvidence: false, status: 'awaiting_response' }).action).toBe(ACTIONS.warm);
    expect(act({ score: 90, hasEvidence: false, status: 'in_conversation' }).action).toBe(ACTIONS.warm);
  });
  it('falls through to Low/Quiet when the score is below WARM anyway', () => {
    expect(act({ score: 10, hasEvidence: false, topRelevance: 0.1 }).action).toBe(ACTIONS.lowOutside);
    expect(act({ score: 0, hasEvidence: false }).action).toBe(ACTIONS.quiet);
  });
  it('does not override earlier rows', () => {
    expect(act({ score: 90, hasEvidence: false, conflictCompany: 'X' }).action).toBe('Check conflict — backed X');
    expect(act({ score: 90, hasEvidence: false, status: 'passed' }).action).toBe(ACTIONS.passed);
  });
  it('needs investment/authored/speaking with relevance ≥ 0.6', () => {
    expect(meetsEvidenceFloor([{ signal_type: 'investment', relevance: 0.6 }])).toBe(true);
    expect(meetsEvidenceFloor([{ signal_type: 'speaking', relevance: 0.9 }, { signal_type: 'press', relevance: 1 }])).toBe(true);
    expect(meetsEvidenceFloor([{ signal_type: 'authored', relevance: 0.59 }])).toBe(false);
    expect(meetsEvidenceFloor([{ signal_type: 'press', relevance: 1 }, { signal_type: 'other', relevance: 1 }])).toBe(false);
    expect(meetsEvidenceFloor([])).toBe(false);
  });
});

describe('firm dedupe', () => {
  const row = (o: Partial<DedupeRow>): DedupeRow => ({ id: 'x', name: 'X', firm: 'Accel', score: 60, action: ACTIONS.reach, trust: 'B', tier: 2, ...o });
  it('only the highest scorer at a firm keeps a row 5–8 action', () => {
    const ch = firmDedupe([row({ id: 'a', name: 'A', score: 70 }), row({ id: 'b', name: 'B', score: 55, action: ACTIONS.warm }), row({ id: 'c', firm: 'Blume', name: 'C' })]);
    expect(ch).toEqual([{ id: 'b', action: sameFirm('A') }]);
  });
  it('ties go to higher trust, then better tier', () => {
    expect(firmDedupe([row({ id: 'a', name: 'A', trust: 'B' }), row({ id: 'b', name: 'B', trust: 'A' })])).toEqual([{ id: 'a', action: sameFirm('B') }]);
    expect(firmDedupe([row({ id: 'a', name: 'A', tier: 3 }), row({ id: 'b', name: 'B', tier: 1 })])).toEqual([{ id: 'a', action: sameFirm('B') }]);
  });
  it('ignores non-contact actions and single-VC firms', () => {
    expect(firmDedupe([row({ id: 'a', name: 'A' }), row({ id: 'b', name: 'B', action: ACTIONS.quiet }), row({ id: 'c', name: 'C', action: 'Check conflict — backed X' })])).toEqual([]);
  });
});
