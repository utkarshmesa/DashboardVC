import { describe, expect, it } from 'vitest';
import { calibrate, evaluateLabels, splitIds, tuneThresholds, type GoldLabel } from '@/lib/eval';
import type { Labels } from '@/lib/types';

const g = (item_id: number, about: boolean, type: GoldLabel['signal_type'] = 'investment'): GoldLabel =>
  ({ item_id, about_this_vc: about, subject: 'firm', signal_type: type, relevant: true, competitor: false });
const p = (o: Partial<Labels> = {}): Labels => ({ about_this_vc: true, confidence: 0.9, subject: 'firm', signal_type: 'investment', relevance: 0.5,
  possible_competitor: false, competitor_evidence: null, funded_company: null, role_change_hint: null, event_key: 'e', summary: 's', ...o });

describe('eval maths', () => {
  it('computes acceptance and about precision/recall and type accuracy', () => {
    const gold = [g(1, true), g(2, true, 'press'), g(3, false), g(4, true)];
    const pred = new Map<number, Labels>([[1, p()], [2, p({ signal_type: 'other' })], [3, p()], [4, p({ confidence: 0.5 })]]);
    const m = evaluateLabels(gold, pred, { minConfidence: 0.7, minRelevance: 0 });
    expect(m.acceptance).toMatchObject({ tp: 2, fp: 1, fn: 1 });
    expect(m.acceptance.precision).toBeCloseTo(2 / 3);
    expect(m.about.precision).toBeCloseTo(3 / 4);
    expect(m.typeAccuracy).toBeCloseTo(1 / 2);
  });

  it('tunes toward the gate: a higher confidence bar removes the false positive', () => {
    const gold = [g(1, true), g(2, true), g(3, false)];
    const pred = new Map<number, Labels>([[1, p({ confidence: 0.95 })], [2, p({ confidence: 0.9 })], [3, p({ about_this_vc: true, confidence: 0.75 })]]);
    const { best } = tuneThresholds(gold, pred);
    expect(best.t.minConfidence).toBeGreaterThan(0.75);
    expect(best.m.acceptance.precision).toBe(1);
  });

  it('splits deterministically into halves', () => {
    const ids = Array.from({ length: 60 }, (_, i) => i + 1);
    const a = splitIds(ids), b = splitIds([...ids].reverse());
    expect(a).toEqual(b);
    expect(a.tune).toHaveLength(30);
    expect(new Set([...a.tune, ...a.test]).size).toBe(60);
  });

  it('calibration picks the REACH that best separates would-contact VCs', () => {
    const row = (would: boolean, s: number) => ({ vc_id: String(s), would_contact: would, scores: { 10: s, 15: s, 20: s, 30: s } });
    const r = calibrate([row(true, 40), row(true, 35), row(false, 20), row(false, 5), row(false, 0)]);
    expect(r.agreement).toBe(1);
    expect(r.reach).toBeGreaterThan(20);
    expect(r.reach).toBeLessThanOrEqual(35);
    expect(r.warm).toBeLessThan(r.reach);
  });

  it('calibration never chooses REACH below 25', () => {
    const row = (would: boolean, s: number) => ({ vc_id: String(s), would_contact: would, scores: { 10: s, 15: s, 20: s, 30: s } });
    const r = calibrate([row(true, 12), row(true, 11), row(false, 3), row(false, 0)]);
    expect(r.reach).toBeGreaterThanOrEqual(25);
  });
});
