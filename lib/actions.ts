// SPEC §9.6 action table (amended in Phase 5 and again in Plan V2, DECISIONS #55: signal first, honestly labelled). Pure, top-down.
import {
  CLOSE_LOOP_DAYS, EVIDENCE_MIN_RELEVANCE, EVIDENCE_TYPES, NEXT_STEP_DAYS, NUDGE_AFTER_DAYS, REACH, WARM,
} from './config';
import type { Fit } from './fit';
import type { FetchStatus, VcStatus } from './types';

export const ACTIONS = {
  passed: 'Passed — no action',
  snoozed: (until: string) => `Snoozed until ${until}`,
  wait: 'Wait — contacted recently',
  unavailable: 'Data unavailable — retry',
  conflict: (company: string) => `Check conflict — backed ${company}`,
  closeLoop: 'Close the loop — no reply in 3 weeks',
  nudgeDue: 'Nudge due — follow up on your email',
  nextStep: 'Next step due — keep the conversation moving',
  inConversation: 'In conversation — nothing due',
  reach: 'Reach out — signal this week',
  nudge: 'Nudge — reference their recent activity',
  mention: 'Mention in next touchpoint',
  capacity: 'If you have capacity — good fit, active elsewhere',
  ownerAdded: 'Added by you — queue for outreach',
  quietFit: 'Quiet — good fit, revisit when active',
  lowOutside: 'Low — active outside your space',
  quiet: 'Quiet — hold',
} as const;

export type ActionInput = {
  status: VcStatus;
  lastContactDate: string | null; // YYYY-MM-DD
  fetchStatus: FetchStatus;
  score: number;                  // recent-signal score (timing)
  topRelevance: number | null;
  active?: boolean;               // any dated, accepted activity in the window (any topic); defaults to score ≥ 1
  conflictCompany: string | null; // accepted competitor signal or standing research conflict, not dismissed
  hasEvidence: boolean;           // evidence floor (meetsEvidenceFloor)
  fit: Pick<Fit, 'label'> & { flags?: string[] }; // research-based fit (lib/fit.ts) and its deal-breaker flags
  snoozedUntil?: string | null;   // YYYY-MM-DD
  ownerAdded?: boolean;           // Vikram added this investor himself (Add investors page)
  now: Date;
  reach?: number;
  warm?: number;
};

export type ActionResult = { action: string; row: string; keepOtherColumns: boolean };

// Evidence floor = the problem's "observable signal": ≥ 1 counted signal (accepted, dated in the window, not a
// competitor, no thumbs-down) they wrote, said, invested in or appeared at, in the space (core or logistics, ≥ 0.6).
export function meetsEvidenceFloor(counted: { signal_type: string | null; relevance: number | null }[]): boolean {
  return counted.some((s) => !!s.signal_type && (EVIDENCE_TYPES as readonly string[]).includes(s.signal_type) && (s.relevance ?? 0) >= EVIDENCE_MIN_RELEVANCE);
}

const todayUtc = (now: Date) => Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
export function daysSince(date: string | null, now: Date): number | null {
  if (!date) return null;
  return Math.floor((todayUtc(now) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
}
export function contactedWithinDays(lastContactDate: string | null, now: Date, days: number): boolean {
  const d = daysSince(lastContactDate, now);
  return d !== null && d >= 0 && d <= days;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayLabel = (iso: string) => { const d = new Date(`${iso}T00:00:00Z`); return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`; };

export function decideAction(i: ActionInput): ActionResult {
  void (i.reach ?? REACH); // kept in the input for calibration tooling; the signal tier is gated by evidence, not score
  const warm = i.warm ?? WARM;
  const r = (row: string, action: string, keepOtherColumns = false): ActionResult => ({ action, row, keepOtherColumns });
  const since = daysSince(i.lastContactDate, i.now);
  const signal = i.hasEvidence;
  const active = i.active ?? i.score >= 1;

  if (i.status === 'passed') return r('1', ACTIONS.passed);
  if (i.snoozedUntil && Date.parse(`${i.snoozedUntil}T00:00:00Z`) > todayUtc(i.now)) return r('2', ACTIONS.snoozed(dayLabel(i.snoozedUntil)));
  if (contactedWithinDays(i.lastContactDate, i.now, 7)) return r('3', ACTIONS.wait);
  if (i.fetchStatus === 'failed') return r('4', ACTIONS.unavailable, true);
  if (i.conflictCompany) return r('5', ACTIONS.conflict(i.conflictCompany));

  // Follow-up engine: driven by Vikram's own status and last-contact date, not by news.
  if (i.status === 'awaiting_response') {
    if (since !== null && since >= CLOSE_LOOP_DAYS) return r('F1', ACTIONS.closeLoop);
    if (since === null || since >= NUDGE_AFTER_DAYS) return signal ? r('F2', ACTIONS.nudge) : r('F2', ACTIONS.nudgeDue);
    return r('F0', ACTIONS.wait);
  }
  if (i.status === 'in_conversation') {
    if (since === null || since >= NEXT_STEP_DAYS) return r('F3', ACTIONS.nextStep);
    return i.score >= warm ? r('F4', ACTIONS.mention) : r('F4', ACTIONS.inConversation);
  }

  // Not contacted yet. The problem's rule: reach out on an observable in-space signal from the past 30 days, "not a
  // hunch". Fit never makes a VC a "reach out"; it only decides whether an active or quiet VC is worth keeping warm.
  if (signal) return r('O1', ACTIONS.reach);
  const goodFit = (i.fit.label === 'strong' || i.fit.label === 'good') && !(i.fit.flags?.length);
  if (goodFit) return active ? r('O2', ACTIONS.capacity) : r('O3', ACTIONS.quietFit);
  // Weak fit but Vikram chose to add them: his judgement queues them (never past a deal-breaker).
  if (i.ownerAdded && !(i.fit.flags?.length)) return r('O6', ACTIONS.ownerAdded);
  if (active) return r('L', ACTIONS.lowOutside);
  return r('Q', ACTIONS.quiet);
}

// ---- Plan pass: firm routing and weekly capacity (end of every run and after every rescore) ----

export const OUTREACH_ACTIONS: readonly string[] = [ACTIONS.reach, ACTIONS.capacity, ACTIONS.ownerAdded];
export const sameFirm = (name: string) => `Same firm — go via ${name}`;

export type PlanRow = {
  id: string;
  name: string;
  firm: string;
  status: VcStatus;
  action: string | null;
  priority: number; // fit score + 0.5 × recent-signal score
  trust: string | null;
  tier: number | null;
};

const TRUST_RANK: Record<string, number> = { A: 0, 'A-': 1, B: 2, C: 3 };
const trustRank = (t: string | null) => (t && t in TRUST_RANK ? TRUST_RANK[t] : 9);
const better = (a: PlanRow, b: PlanRow) =>
  b.priority - a.priority || trustRank(a.trust) - trustRank(b.trust) || (a.tier ?? 99) - (b.tier ?? 99) || a.name.localeCompare(b.name);

// 1. A firm already engaged (a partner awaiting a reply or in conversation) routes its other partners via that partner.
// 2. Otherwise only the best partner per firm keeps an outreach action; the others go via them.
// The signal tier is never capped: every VC with a real in-space signal is worth contacting (OUTREACH_PER_WEEK is the
// weekly target shown on the dashboard, not a quota that hides signals).
// Returns only the rows whose action must change.
export function planPass(rows: PlanRow[]): { id: string; action: string }[] {
  const next = new Map(rows.map((r) => [r.id, r.action ?? '']));
  const byFirm = new Map<string, PlanRow[]>();
  for (const r of rows) { const k = r.firm.trim().toLowerCase(); byFirm.set(k, [...(byFirm.get(k) ?? []), r]); }
  for (const group of byFirm.values()) {
    const engaged = group.filter((r) => r.status === 'awaiting_response' || r.status === 'in_conversation').sort(better)[0];
    const outreach = group.filter((r) => r.status === 'not_contacted' && OUTREACH_ACTIONS.includes(next.get(r.id)!));
    if (engaged) { for (const r of outreach) next.set(r.id, sameFirm(engaged.name)); continue; }
    if (outreach.length < 2) continue;
    const [top, ...rest] = [...outreach].sort(better);
    for (const r of rest) next.set(r.id, sameFirm(top.name));
  }
  return rows.filter((r) => next.get(r.id) !== (r.action ?? '')).map((r) => ({ id: r.id, action: next.get(r.id)! }));
}
