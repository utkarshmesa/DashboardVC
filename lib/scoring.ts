// SPEC §9.5 scoring. Pure.
import { HALF_LIFE_DAYS, SIGNAL_WINDOW_DAYS, SUBJECT_WEIGHT, TYPE_WEIGHT } from './config';
import { daysOld, isoDate } from './text';
import type { SignalType, Subject } from './types';

export type ScorableSignal = {
  id: number;
  status: string;
  signal_type: SignalType | null;
  subject: Subject | null;
  relevance: number | null;
  published_at: string | null;
  date_approx: boolean;
  possible_competitor: boolean | null;
  event_key: string | null;
  summary: string | null;
  thumbs_down?: boolean;
};

export type ScoreOptions = { windowDays?: number; halfLifeDays?: number };

export type Contribution = { signal: ScorableSignal; value: number; daysOld: number };

// An accepted signal counts if it is in the window (dated) or date_approx (scored at window age).
export function signalAge(s: ScorableSignal, now: Date, windowDays = SIGNAL_WINDOW_DAYS): number | null {
  if (s.published_at) {
    const d = Math.max(0, daysOld(s.published_at, now));
    return d <= windowDays ? d : null;
  }
  return s.date_approx ? windowDays : null;
}

export function signalValue(s: ScorableSignal, age: number, halfLifeDays = HALF_LIFE_DAYS): number {
  if (!s.signal_type || s.signal_type === 'irrelevant' || !s.subject) return 0;
  return TYPE_WEIGHT[s.signal_type] * SUBJECT_WEIGHT[s.subject] * (s.relevance ?? 0) * 0.5 ** (age / halfLifeDays);
}

export function qualifying(signals: ScorableSignal[], now: Date, opts: ScoreOptions = {}): Contribution[] {
  const out: Contribution[] = [];
  for (const s of signals) {
    if (s.status !== 'accepted' || s.possible_competitor === true || s.thumbs_down) continue;
    const age = signalAge(s, now, opts.windowDays);
    if (age === null) continue;
    out.push({ signal: s, daysOld: age, value: signalValue(s, age, opts.halfLifeDays) });
  }
  return out;
}

export type ScoreResult = { score: number; top: Contribution | null; groups: Contribution[]; counted: Contribution[] };

export function scoreSignals(signals: ScorableSignal[], now: Date, opts: ScoreOptions = {}): ScoreResult {
  const counted = qualifying(signals, now, opts);
  const best = new Map<string, Contribution>();
  for (const c of counted) {
    const key = c.signal.event_key || `__signal_${c.signal.id}`;
    const prev = best.get(key);
    if (!prev || c.value > prev.value) best.set(key, c);
  }
  const groups = [...best.values()].sort((a, b) => b.value - a.value);
  if (!groups.length) return { score: 0, top: null, groups, counted };
  const [top, ...rest] = groups;
  const score = Math.min(100, Math.round(100 * (top.value + 0.25 * rest.reduce((s, c) => s + c.value, 0))));
  return { score, top, groups, counted };
}

// Newest accepted signal ever stored (may be older than the window); undated signals carry no date.
export function lastSignalDate(signals: ScorableSignal[]): string | null {
  const dates = signals.filter((s) => s.status === 'accepted' && s.published_at).map((s) => s.published_at!).sort();
  return dates.length ? isoDate(dates[dates.length - 1]) : null;
}
