// SPEC §9.6 action table. Pure, evaluated top-down. Firm dedupe arrives in Phase 2.
import { EVIDENCE_MIN_RELEVANCE, EVIDENCE_TYPES, LOW_RELEVANCE, REACH, WARM } from './config';
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
  hasEvidence: boolean;           // evidence floor for rows 5–7 (see meetsEvidenceFloor)
  now: Date;
  reach?: number;
  warm?: number;
};

export type ActionResult = { action: string; row: string; keepOtherColumns: boolean };

// Evidence floor (SPEC §9.6): rows 5–7 need ≥ 1 counted signal (accepted, in-window, not a competitor, no thumbs-down)
// of type investment / authored / speaking with relevance ≥ 0.6, whatever the score.
export function meetsEvidenceFloor(counted: { signal_type: string | null; relevance: number | null }[]): boolean {
  return counted.some((s) => !!s.signal_type && (EVIDENCE_TYPES as readonly string[]).includes(s.signal_type) && (s.relevance ?? 0) >= EVIDENCE_MIN_RELEVANCE);
}

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
  if (i.score >= reach && i.hasEvidence) {
    if (i.status === 'not_contacted') return r('5', ACTIONS.reach);
    if (i.status === 'awaiting_response') return r('6', ACTIONS.nudge);
    return r('7', ACTIONS.mention);
  }
  if (i.score >= warm) return r('8', ACTIONS.warm);
  if (i.score >= 1) return (i.topRelevance ?? 0) < LOW_RELEVANCE ? r('9a', ACTIONS.lowOutside) : r('9b', ACTIONS.lowWeak);
  return r('10', ACTIONS.quiet);
}

// ---- Firm dedupe (SPEC §9.6, final pass when a run finishes) ----

export const CONTACT_ACTIONS: readonly string[] = [ACTIONS.reach, ACTIONS.nudge, ACTIONS.mention, ACTIONS.warm]; // rows 5–8
export const sameFirm = (name: string) => `Same firm — go via ${name}`;

export type DedupeRow = {
  id: string;
  name: string;
  firm: string;
  score: number | null;
  action: string | null;
  trust: string | null; // A > A- > B > C
  tier: number | null;  // lower is better
};

const TRUST_RANK: Record<string, number> = { A: 0, 'A-': 1, B: 2, C: 3 };
const trustRank = (t: string | null) => (t && t in TRUST_RANK ? TRUST_RANK[t] : 9);

// Within one firm only the highest-scoring VC keeps a row 5–8 action; ties go to higher trust, then better tier
// (then name, for determinism). Returns only the rows whose action must change.
export function firmDedupe(rows: DedupeRow[]): { id: string; action: string }[] {
  const byFirm = new Map<string, DedupeRow[]>();
  for (const r of rows) {
    if (!r.action || !CONTACT_ACTIONS.includes(r.action)) continue;
    const key = r.firm.trim().toLowerCase();
    byFirm.set(key, [...(byFirm.get(key) ?? []), r]);
  }
  const changes: { id: string; action: string }[] = [];
  for (const group of byFirm.values()) {
    if (group.length < 2) continue;
    const [top, ...rest] = [...group].sort((a, b) =>
      (b.score ?? 0) - (a.score ?? 0) || trustRank(a.trust) - trustRank(b.trust) || (a.tier ?? 99) - (b.tier ?? 99) || a.name.localeCompare(b.name));
    for (const r of rest) changes.push({ id: r.id, action: sameFirm(top.name) });
  }
  return changes;
}
