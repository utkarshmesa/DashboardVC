import { describe, expect, it } from 'vitest';
import { lastSignalDate, scoreSignals, signalValue, type ScorableSignal } from '@/lib/scoring';

const NOW = new Date('2026-10-12T00:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
let nextId = 1;
const sig = (o: Partial<ScorableSignal> = {}): ScorableSignal => ({
  id: nextId++, status: 'accepted', signal_type: 'investment', subject: 'person', relevance: 1,
  published_at: daysAgo(0), date_approx: false, possible_competitor: false, event_key: null, summary: 's', ...o,
});

describe('scoring', () => {
  it('decays with a 20-day half-life at 0/20/30 days', () => {
    expect(signalValue(sig(), 0)).toBeCloseTo(1);
    expect(signalValue(sig(), 20)).toBeCloseTo(0.5);
    expect(signalValue(sig(), 30)).toBeCloseTo(0.5 ** 1.5);
    expect(scoreSignals([sig({ published_at: daysAgo(20) })], NOW).score).toBe(50);
  });

  it('keeps only the max per event_key and adds 0.25 × other groups', () => {
    const a = sig({ event_key: 'deal-x', relevance: 0.8 });
    const b = sig({ event_key: 'deal-x', relevance: 0.6 });
    const c = sig({ event_key: 'talk-y', signal_type: 'speaking', relevance: 0.4 });
    const r = scoreSignals([a, b, c], NOW);
    expect(r.groups).toHaveLength(2);
    expect(r.score).toBe(Math.round(100 * (0.8 + 0.25 * 0.7 * 0.4)));
  });

  it('applies the subject multiplier; the same deal differs only by subject weight', () => {
    const person = scoreSignals([sig({ subject: 'person', relevance: 0.5 })], NOW).score;
    const firm = scoreSignals([sig({ subject: 'firm', relevance: 0.5 })], NOW).score;
    expect(person).toBe(50);
    expect(firm).toBe(35);
  });

  it('excludes competitor flags and thumbs-down signals', () => {
    expect(scoreSignals([sig({ possible_competitor: true })], NOW).score).toBe(0);
    expect(scoreSignals([sig({ thumbs_down: true })], NOW).score).toBe(0);
  });

  it('scores date_approx items as if SIGNAL_WINDOW_DAYS old', () => {
    const r = scoreSignals([sig({ published_at: null, date_approx: true })], NOW);
    expect(r.score).toBe(Math.round(100 * 0.5 ** 1.5));
  });

  it('caps at 100', () => {
    const many = Array.from({ length: 10 }, (_, i) => sig({ event_key: `e${i}` }));
    expect(scoreSignals(many, NOW).score).toBe(100);
  });

  it('ignores undated (not approx), out-of-window and non-accepted signals', () => {
    expect(scoreSignals([sig({ published_at: null, date_approx: false })], NOW).score).toBe(0);
    expect(scoreSignals([sig({ published_at: daysAgo(31) })], NOW).score).toBe(0);
    expect(scoreSignals([sig({ status: 'rejected' })], NOW).score).toBe(0);
  });

  it('last_signal_date is the newest accepted dated signal, even outside the window', () => {
    expect(lastSignalDate([sig({ published_at: daysAgo(90) }), sig({ published_at: daysAgo(45) }), sig({ status: 'rejected', published_at: daysAgo(1) })]))
      .toBe('2026-08-28');
    expect(lastSignalDate([sig({ published_at: null, date_approx: true })])).toBeNull();
  });
});
