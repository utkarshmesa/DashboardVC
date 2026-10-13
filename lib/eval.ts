// SPEC §12.2/§12.3 evaluation maths. Pure; used by scripts/eval.ts and scripts/calibrate.ts.
import { acceptance, type Thresholds } from './classifier';
import { MIN_CALIBRATED_REACH, MIN_CONFIDENCE, MIN_RELEVANCE } from './config';
import { ACTIONS as A, decideAction as decide, planPass as plan } from './actions';
import { FIT_GOOD as FG, FIT_STRONG as FS, HALF_LIFE_DAYS as HL, REACH as RC, WARM as WM } from './config';
import type { Labels } from './types';

export type GoldLabel = {
  item_id: number;
  about_this_vc: boolean;
  subject: 'person' | 'firm';
  signal_type: Labels['signal_type'];
  relevance_level: Labels['relevance_level']; // judged against target_space
  competitor: boolean;                        // judged against my_product
};

// An item "should be accepted" when it is about this VC and is a real signal (not irrelevant).
export const goldAccept = (g: GoldLabel) => g.about_this_vc && g.signal_type !== 'irrelevant';

const ratio = (n: number, d: number) => (d ? n / d : null);

export type EvalMetrics = {
  n: number;
  acceptance: { precision: number | null; recall: number | null; tp: number; fp: number; fn: number };
  about: { precision: number | null; recall: number | null };
  typeAccuracy: number | null;           // on items gold-about and predicted-accepted
  relevanceLevelAccuracy: number | null; // on items gold-about (relevance only matters for real signals)
};

export function evaluateLabels(gold: GoldLabel[], pred: Map<number, Labels>, t: Thresholds): EvalMetrics {
  let tp = 0, fp = 0, fn = 0, aboutTp = 0, aboutPredPos = 0, aboutGoldPos = 0, typeHit = 0, typeN = 0, relHit = 0, relN = 0;
  for (const g of gold) {
    const p = pred.get(g.item_id);
    if (!p) continue;
    const predAccept = acceptance(p, t).status === 'accepted';
    if (predAccept && goldAccept(g)) tp++;
    else if (predAccept) fp++;
    else if (goldAccept(g)) fn++;
    if (p.about_this_vc) aboutPredPos++;
    if (g.about_this_vc) aboutGoldPos++;
    if (p.about_this_vc && g.about_this_vc) aboutTp++;
    if (predAccept && g.about_this_vc) { typeN++; if (p.signal_type === g.signal_type) typeHit++; }
    if (g.about_this_vc) { relN++; if (p.relevance_level === g.relevance_level) relHit++; }
  }
  return {
    n: gold.filter((g) => pred.has(g.item_id)).length,
    acceptance: { precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn), tp, fp, fn },
    about: { precision: ratio(aboutTp, aboutPredPos), recall: ratio(aboutTp, aboutGoldPos) },
    typeAccuracy: ratio(typeHit, typeN),
    relevanceLevelAccuracy: ratio(relHit, relN),
  };
}

export const GATE = { acceptancePrecision: 0.8, aboutPrecision: 0.9 };

// Grid-search thresholds on the tune split: maximise acceptance recall subject to the gate's precision bars;
// if no setting meets the bars, maximise acceptance precision. Ties prefer the current constants (closest first), so a
// threshold only moves when the data shows a gain.
export function tuneThresholds(gold: GoldLabel[], pred: Map<number, Labels>) {
  const grid: Thresholds[] = [];
  // Relevance is one of four fixed values (0.1 / 0.4 / 0.7 / 1.0); floors between them select which levels are accepted.
  for (let c = 50; c <= 95; c += 5) for (const r of [0, 0.25, 0.55, 0.85]) grid.push({ minConfidence: c / 100, minRelevance: r });
  const scored = grid.map((t) => ({ t, m: evaluateLabels(gold, pred, t) }));
  const meets = scored.filter((s) => (s.m.acceptance.precision ?? 0) >= GATE.acceptancePrecision && (s.m.about.precision ?? 0) >= GATE.aboutPrecision);
  const pool = meets.length ? meets : scored;
  const key = (s: (typeof scored)[number]) => (meets.length ? (s.m.acceptance.recall ?? 0) : (s.m.acceptance.precision ?? 0));
  const dist = (t: Thresholds) => Math.abs(t.minConfidence - MIN_CONFIDENCE) + Math.abs(t.minRelevance - MIN_RELEVANCE);
  pool.sort((a, b) => key(b) - key(a) || dist(a.t) - dist(b.t) || a.t.minConfidence - b.t.minConfidence);
  return { best: pool[0], metGate: meets.length > 0 };
}

// Deterministic 50/50 split, made once and persisted by the caller.
export function splitIds(ids: number[], seed = 20261012): { tune: number[]; test: number[] } {
  let s = seed >>> 0;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const a = [...ids].sort((x, y) => x - y);
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  const half = Math.ceil(a.length / 2);
  return { tune: a.slice(0, half).sort((x, y) => x - y), test: a.slice(half).sort((x, y) => x - y) };
}

// §12.3 calibration: agreement between "would contact this week" and score ≥ REACH, over a grid.
export type ReviewRow = { vc_id: string; would_contact: boolean; scores: Record<number, number> }; // half-life → score

export function calibrate(rows: ReviewRow[], halfLives = [10, 15, 20, 30]) {
  let best: { halfLife: number; reach: number; agreement: number } | null = null;
  for (const hl of halfLives) {
    for (let reach = MIN_CALIBRATED_REACH; reach <= 100; reach += 5) { // never below 25 (SPEC §12.3)
      const agree = rows.filter((r) => (r.scores[hl] >= reach) === r.would_contact).length / (rows.length || 1);
      if (!best || agree > best.agreement + 1e-9 || (Math.abs(agree - best.agreement) < 1e-9 && hl === 20 && best.halfLife !== 20)) best = { halfLife: hl, reach, agreement: agree };
    }
  }
  if (!best) throw new Error('no review rows');
  // WARM: the highest threshold below REACH that still catches every "would contact" VC (so none fall to Low/Quiet);
  // if that is impossible, the threshold below REACH with the best agreement.
  const hl = best.halfLife;
  const yes = rows.filter((r) => r.would_contact).map((r) => r.scores[hl]);
  let warm = 5;
  for (let w = best.reach - 5; w >= 5; w -= 5) { if (yes.every((s) => s >= w || s >= best!.reach)) { warm = w; break; } }
  return { ...best, warm: Math.min(warm, best.reach - 5) };
}

// Recall window per golden event: days from the event's approx_date (first of that month) to the fixture's capture
// time, plus 30. Golden events carry month-only dates and coverage trails the announcement, so a fixed window either
// excludes older real deals (FreightFox, Oct 2023) or admits far more than one event's coverage; anchoring on the
// event keeps every event's own articles in range and adds the normal 30-day signal window on top.
export function recallWindowDays(approxDate: string, capturedAt: string): number {
  const [y, m] = approxDate.split('-').map(Number);
  const start = Date.UTC(y, (m || 1) - 1, 1);
  return Math.ceil((Date.parse(capturedAt) - start) / 86_400_000) + 30;
}

// ---- §12.3 calibration v2 (Phase 5): agreement between "would contact this week" and the full decision ----
// For every grid point, simulate decideAction + planPass and count a VC as "contact" when its final action is a
// outreach action (Reach out — signal this week, If you have capacity). Ties prefer the current constants.

export type PlanReviewRow = {
  id: string; name: string; firm: string; trust: string | null; tier: number | null; fitScore: number; fitFlags?: string[]; conflict: boolean; would_contact: boolean;
  byHalfLife: Record<number, { score: number; topRelevance: number | null; hasEvidence: boolean }>;
};
export type PlanGrid = { halfLife: number; reach: number; warm: number; fitStrong: number; fitGood: number };

export function simulatePlan(rows: PlanReviewRow[], g: PlanGrid, now = new Date()): Map<string, string> {
  const label = (s: number) => (s >= g.fitStrong ? 'strong' : s >= g.fitGood ? 'good' : 'weak') as 'strong' | 'good' | 'weak';
  const computed = rows.map((r) => {
    const h = r.byHalfLife[g.halfLife];
    const action = decide({ status: 'not_contacted', lastContactDate: null, fetchStatus: 'ok', score: h.score, topRelevance: h.topRelevance,
      conflictCompany: r.conflict ? 'x' : null, hasEvidence: h.hasEvidence, fit: { label: label(r.fitScore), flags: r.fitFlags }, now, reach: g.reach, warm: g.warm }).action;
    return { id: r.id, name: r.name, firm: r.firm, status: 'not_contacted' as const, action, priority: r.fitScore + 0.5 * h.score, trust: r.trust, tier: r.tier };
  });
  const final = new Map(computed.map((c) => [c.id, c.action]));
  for (const ch of plan(computed)) final.set(ch.id, ch.action);
  return final;
}

const CONTACT = new Set<string>([A.reach, A.capacity]); // shown as outreach (signal tier or capacity list)

export function calibratePlan(rows: PlanReviewRow[], now = new Date()) {
  const current: PlanGrid = { halfLife: HL, reach: RC, warm: WM, fitStrong: FS, fitGood: FG };
  const dist = (g: PlanGrid) => Math.abs(g.halfLife - current.halfLife) / 5 + Math.abs(g.reach - current.reach) / 5 + Math.abs(g.warm - current.warm) / 5
    + Math.abs(g.fitStrong - current.fitStrong) / 5 + Math.abs(g.fitGood - current.fitGood) / 5;
  let best: { g: PlanGrid; agreement: number; tp: number; fp: number; fn: number } | null = null;
  for (const halfLife of [10, 15, 20, 30]) for (let reach = MIN_CALIBRATED_REACH; reach <= 60; reach += 5)
    for (let warm = 10; warm < reach; warm += 5) for (let fitStrong = 55; fitStrong <= 85; fitStrong += 5)
      for (let fitGood = fitStrong - 25; fitGood <= fitStrong - 10; fitGood += 5) {
        const g = { halfLife, reach, warm, fitStrong, fitGood };
        const final = simulatePlan(rows, g, now);
        let tp = 0, fp = 0, fn = 0, agree = 0;
        for (const r of rows) {
          const yes = CONTACT.has(final.get(r.id) ?? '');
          if (yes === r.would_contact) agree++;
          if (yes && r.would_contact) tp++; else if (yes) fp++; else if (r.would_contact) fn++;
        }
        const agreement = agree / (rows.length || 1);
        if (!best || agreement > best.agreement + 1e-9 || (Math.abs(agreement - best.agreement) < 1e-9 && dist(g) < dist(best.g))) best = { g, agreement, tp, fp, fn };
      }
  return { ...best!, current };
}
