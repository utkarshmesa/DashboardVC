// SPEC §9.6 action table. Pure, evaluated top-down. Firm dedupe arrives in Phase 2.
import { LOW_RELEVANCE, REACH, WARM } from './config';
import type { FetchStatus, VcStatus } from './types';

export const ACTIONS = {
  passed: 'Passed — no action',
  wait: 'Wait — contacted recently',
  unavailable: 'Data unavailable — retry',
  conflict: (company: string) => `Check conflict — backed ${company}`,
  reach: 'Reach out this week',
  nudge: 'Nudge — reference recent activity',
  mention: 'Mention in next touchpoint',
  warm: 'Warm — reach out if capacity',
  lowOutside: 'Low — activity outside your space',
  lowWeak: 'Low — weak or fading signal',
  quiet: 'Quiet — hold',
} as const;

export type ActionInput = {
  status: VcStatus;
  lastContactDate: string | null; // YYYY-MM-DD
  fetchStatus: FetchStatus;
  score: number;
  topRelevance: number | null;
  conflictCompany: string | null; // set when an accepted in-window signal is a possible competitor
  now: Date;
  reach?: number;
  warm?: number;
};

export type ActionResult = { action: string; row: string; keepOtherColumns: boolean };

export function contactedWithinDays(lastContactDate: string | null, now: Date, days: number): boolean {
  if (!lastContactDate) return false;
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = (today - Date.parse(`${lastContactDate}T00:00:00Z`)) / 86_400_000;
  return diff >= 0 && diff <= days;
}

export function decideAction(i: ActionInput): ActionResult {
  const reach = i.reach ?? REACH, warm = i.warm ?? WARM;
  const r = (row: string, action: string, keepOtherColumns = false): ActionResult => ({ action, row, keepOtherColumns });
  if (i.status === 'passed') return r('1', ACTIONS.passed);
  if (contactedWithinDays(i.lastContactDate, i.now, 7)) return r('2', ACTIONS.wait);
  if (i.fetchStatus === 'failed') return r('3', ACTIONS.unavailable, true);
  if (i.conflictCompany) return r('4', ACTIONS.conflict(i.conflictCompany));
  if (i.score >= reach) {
    if (i.status === 'not_contacted') return r('5', ACTIONS.reach);
    if (i.status === 'awaiting_response') return r('6', ACTIONS.nudge);
    return r('7', ACTIONS.mention);
  }
  if (i.score >= warm) return r('8', ACTIONS.warm);
  if (i.score >= 1) return (i.topRelevance ?? 0) < LOW_RELEVANCE ? r('9a', ACTIONS.lowOutside) : r('9b', ACTIONS.lowWeak);
  return r('10', ACTIONS.quiet);
}
