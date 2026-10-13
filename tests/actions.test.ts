import { describe, expect, it } from 'vitest';
import { ACTIONS, decideAction, meetsEvidenceFloor, OUTREACH_ACTIONS, planPass, sameFirm, type ActionInput, type PlanRow } from '@/lib/actions';

const NOW = new Date('2026-10-12T05:00:00Z');
const base: ActionInput = {
  status: 'not_contacted', lastContactDate: null, fetchStatus: 'ok', score: 0, topRelevance: null, conflictCompany: null,
  hasEvidence: false, fit: { label: 'weak' }, now: NOW, reach: 50, warm: 25, // thresholds pinned so tests don't move with calibration
};
const act = (o: Partial<ActionInput>) => decideAction({ ...base, ...o });
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString().slice(0, 10);

describe('action table (SPEC §9.6, amended in Phase 5)', () => {
  it('passed wins over everything; snooze before the rest', () => {
    expect(act({ status: 'passed', score: 90, conflictCompany: 'X', snoozedUntil: daysAgo(-5) }).action).toBe(ACTIONS.passed);
    expect(act({ snoozedUntil: daysAgo(-5), score: 90, fit: { label: 'strong' } }).action).toBe('Snoozed until 17 Oct');
    expect(act({ snoozedUntil: daysAgo(1), fit: { label: 'strong' } }).action).toBe(ACTIONS.quietFit); // expired snooze ignored
  });
  it('contacted within 7 days → Wait, before fetch failure and conflicts', () => {
    expect(act({ lastContactDate: daysAgo(7), fetchStatus: 'failed', conflictCompany: 'X' }).action).toBe(ACTIONS.wait);
  });
  it('fetch failed keeps the other columns', () => {
    expect(act({ fetchStatus: 'failed', score: 90 })).toMatchObject({ action: ACTIONS.unavailable, keepOtherColumns: true });
  });
  it('a conflict (signal or standing research) beats every outreach action', () => {
    expect(act({ conflictCompany: 'a TMS company', fit: { label: 'strong' }, score: 90 }).action).toBe('Check conflict — backed a TMS company');
  });

  describe('follow-up engine (independent of news)', () => {
    it('awaiting a reply: nudge from day 8, close the loop from day 21', () => {
      expect(act({ status: 'awaiting_response', lastContactDate: daysAgo(8) }).action).toBe(ACTIONS.nudgeDue);
      expect(act({ status: 'awaiting_response', lastContactDate: daysAgo(20) }).action).toBe(ACTIONS.nudgeDue);
      expect(act({ status: 'awaiting_response', lastContactDate: daysAgo(21) }).action).toBe(ACTIONS.closeLoop);
      expect(act({ status: 'awaiting_response', lastContactDate: null }).action).toBe(ACTIONS.nudgeDue);
    });
    it('a nudge with strong recent news references it', () => {
      expect(act({ status: 'awaiting_response', lastContactDate: daysAgo(10), score: 60, hasEvidence: true }).action).toBe(ACTIONS.nudge);
      expect(act({ status: 'awaiting_response', lastContactDate: daysAgo(10), score: 60, hasEvidence: false }).action).toBe(ACTIONS.nudgeDue);
    });
    it('in conversation: next step due after 10 days, otherwise nothing due (or mention news)', () => {
      expect(act({ status: 'in_conversation', lastContactDate: daysAgo(10) }).action).toBe(ACTIONS.nextStep);
      expect(act({ status: 'in_conversation', lastContactDate: daysAgo(9) }).action).toBe(ACTIONS.inConversation);
      expect(act({ status: 'in_conversation', lastContactDate: daysAgo(9), score: 30 }).action).toBe(ACTIONS.mention);
    });
  });

  describe('not contacted: an observable in-space signal decides ("not a hunch", Plan V2)', () => {
    it('any in-space signal in the window → Reach out, whatever the score or fit', () => {
      expect(act({ score: 5, hasEvidence: true }).action).toBe(ACTIONS.reach);
      expect(act({ score: 90, hasEvidence: true, fit: { label: 'weak' } }).action).toBe(ACTIONS.reach);
    });
    it('fit alone never makes a VC a "reach out"', () => {
      for (const label of ['strong', 'good', 'weak'] as const)
        expect(act({ hasEvidence: false, fit: { label }, score: 0, active: false }).action).not.toBe(ACTIONS.reach);
    });
    it('good or strong fit: capacity list if active elsewhere, quiet (revisit) if not active', () => {
      expect(act({ hasEvidence: false, fit: { label: 'strong' }, active: true }).action).toBe(ACTIONS.capacity);
      expect(act({ hasEvidence: false, fit: { label: 'good' }, active: true }).action).toBe(ACTIONS.capacity);
      expect(act({ hasEvidence: false, fit: { label: 'strong' }, active: false }).action).toBe(ACTIONS.quietFit);
    });
    it('weak fit: active outside the space is Low; nothing in the window is Quiet', () => {
      expect(act({ hasEvidence: false, active: true }).action).toBe(ACTIONS.lowOutside);
      expect(act({ hasEvidence: false, active: false }).action).toBe(ACTIONS.quiet);
      expect(act({ hasEvidence: false, score: 0 }).action).toBe(ACTIONS.quiet); // activity defaults to score >= 1
    });
    it('a good fit with a deal-breaker is treated as weak (never the capacity list)', () => {
      expect(act({ hasEvidence: false, active: true, fit: { label: 'good', flags: ['usually invests after seed'] } }).action).toBe(ACTIONS.lowOutside);
    });
  });

  it('evidence floor = wrote, said (press), invested or appeared, in the space (relevance >= 0.6)', () => {
    expect(meetsEvidenceFloor([{ signal_type: 'investment', relevance: 0.8 }])).toBe(true);
    expect(meetsEvidenceFloor([{ signal_type: 'press', relevance: 1 }])).toBe(true);
    expect(meetsEvidenceFloor([{ signal_type: 'authored', relevance: 0.15 }])).toBe(false);
    expect(meetsEvidenceFloor([{ signal_type: 'other', relevance: 1 }])).toBe(false);
  });
});

describe('plan pass: firm routing and weekly capacity', () => {
  const row = (o: Partial<PlanRow>): PlanRow => ({ id: 'x', name: 'X', firm: 'F', status: 'not_contacted', action: ACTIONS.reach, priority: 50, trust: 'B', tier: 2, ...o });

  it('only the best partner per firm keeps an outreach action (ties: trust, then tier)', () => {
    expect(planPass([row({ id: 'a', name: 'A', priority: 70 }), row({ id: 'b', name: 'B', priority: 60, action: ACTIONS.capacity })])).toEqual([{ id: 'b', action: sameFirm('A') }]);
    expect(planPass([row({ id: 'a', name: 'A', trust: 'B' }), row({ id: 'b', name: 'B', trust: 'A' })])).toEqual([{ id: 'a', action: sameFirm('B') }]);
  });
  it('a firm already engaged routes its other partners via the engaged partner', () => {
    const ch = planPass([row({ id: 'a', name: 'A', status: 'awaiting_response', action: ACTIONS.nudgeDue }), row({ id: 'b', name: 'B', priority: 99 })]);
    expect(ch).toEqual([{ id: 'b', action: sameFirm('A') }]);
  });
  it('never caps the signal tier: every VC with a real in-space signal stays "Reach out"', () => {
    const rows = Array.from({ length: 12 }, (_, i) => row({ id: `v${i}`, name: `V${i}`, firm: `F${i}`, priority: 100 - i }));
    expect(planPass(rows)).toEqual([]);
  });
  it('leaves follow-ups, conflicts and quiet rows alone', () => {
    expect(planPass([row({ id: 'a', action: ACTIONS.closeLoop, status: 'awaiting_response' }), row({ id: 'b', action: 'Check conflict — backed X', firm: 'G' }), row({ id: 'c', action: ACTIONS.quiet, firm: 'H' })])).toEqual([]);
  });
});

describe('O6: investors Vikram added himself (DECISIONS #47)', () => {
  const weak = { label: 'weak' as const, flags: [] };
  it('weak fit, no news: queued because he chose them; otherwise Quiet as before', () => {
    expect(act({ fit: weak, score: 0, ownerAdded: true, hasEvidence: false })).toMatchObject({ row: 'O6', action: ACTIONS.ownerAdded });
    expect(act({ fit: weak, score: 0, hasEvidence: false })).toMatchObject({ row: 'Q' });
  });
  it('never past a deal-breaker or a conflict, and fit/news rows still win', () => {
    expect(act({ fit: { label: 'weak', flags: ['usually invests after seed'] }, score: 0, ownerAdded: true, hasEvidence: false }).row).toBe('Q');
    expect(act({ fit: weak, score: 0, ownerAdded: true, conflictCompany: 'a TMS company' }).row).toBe('5');
    expect(act({ fit: { label: 'strong', flags: [] }, score: 0, ownerAdded: true, hasEvidence: false }).row).toBe('O3');
  });
  it('is an outreach action, so firm routing applies to it', () => {
    expect(OUTREACH_ACTIONS).toContain(ACTIONS.ownerAdded);
  });
});
