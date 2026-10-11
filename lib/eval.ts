// SPEC §12.2/§12.3 evaluation maths. Pure; used by scripts/eval.ts and scripts/calibrate.ts.
import { acceptance, type Thresholds } from './classifier';
import { MIN_CALIBRATED_REACH } from './config';
import type { Labels } from './types';

export type GoldLabel = {
  item_id: number;
  about_this_vc: boolean;
  subject: 'person' | 'firm';
  signal_type: Labels['signal_type'];
  relevant: boolean;
  competitor: boolean;
};

// An item "should be accepted" when it is about this VC and is a real signal (not irrelevant).
export const goldAccept = (g: GoldLabel) => g.about_this_vc && g.signal_type !== 'irrelevant';

const ratio = (n: number, d: number) => (d ? n / d : null);

export type EvalMetrics = {
  n: number;
  acceptance: { precision: number | null; recall: number | null; tp: number; fp: number; fn: number };
  about: { precision: number | null; recall: number | null };
  typeAccuracy: number | null; // on items gold-about and predicted-accepted
};

export function evaluateLabels(gold: GoldLabel[], pred: Map<number, Labels>, t: Thresholds): EvalMetrics {
  let tp = 0, fp = 0, fn = 0, aboutTp = 0, aboutPredPos = 0, aboutGoldPos = 0, typeHit = 0, typeN = 0;
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
  }
  return {
    n: gold.filter((g) => pred.has(g.item_id)).length,
    acceptance: { precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn), tp, fp, fn },
    about: { precision: ratio(aboutTp, aboutPredPos), recall: ratio(aboutTp, aboutGoldPos) },
    typeAccuracy: ratio(typeHit, typeN),
  };
}

export const GATE = { acceptancePrecision: 0.8, aboutPrecision: 0.9 };

// Grid-search thresholds on the tune split: maximise acceptance recall subject to the gate's precision bars;
// if no setting meets the bars, maximise acceptance precision. Ties prefer lower thresholds (more recall), then defaults.
export function tuneThresholds(gold: GoldLabel[], pred: Map<number, Labels>) {
  const grid: Thresholds[] = [];
  for (let c = 50; c <= 95; c += 5) for (let r = 0; r <= 50; r += 5) grid.push({ minConfidence: c / 100, minRelevance: r / 100 });
  const scored = grid.map((t) => ({ t, m: evaluateLabels(gold, pred, t) }));
  const meets = scored.filter((s) => (s.m.acceptance.precision ?? 0) >= GATE.acceptancePrecision && (s.m.about.precision ?? 0) >= GATE.aboutPrecision);
  const pool = meets.length ? meets : scored;
  const key = (s: (typeof scored)[number]) => (meets.length ? (s.m.acceptance.recall ?? 0) : (s.m.acceptance.precision ?? 0));
  pool.sort((a, b) => key(b) - key(a) || a.t.minConfidence - b.t.minConfidence || a.t.minRelevance - b.t.minRelevance);
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
