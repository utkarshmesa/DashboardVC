import { describe, expect, it } from 'vitest';
import { plainFitReason, roleTitle, sentence } from '@/lib/plain';

describe('plain wording', () => {
  it('turns verification notes into a clean title and keeps plain titles', () => {
    expect(roleTitle('Investor on official biography; Partner in July 2025 deal press')).toBe('Partner');
    expect(roleTitle('Co-founder and Managing Partner')).toBe('Co-founder and Managing Partner');
    expect(roleTitle('Listed on the team page; role unclear')).toBeNull();
    expect(roleTitle(null)).toBeNull();
  });
  it('builds a plain fit reason from fit reasons and stage', () => {
    expect(plainFitReason({ reasons: ['research tier 1', 'thesis mentions supply, logistics', 'relevant deals: freight', 'relevant deal in the last 12 months'] }, 'Seed and Series A'))
      .toBe('Backed a logistics company in the last year; their thesis covers supply, logistics; invests at Seed and Series A.');
    expect(plainFitReason({ reasons: ['research tier 2'] }, null)).toBe('Good fit from research.');
  });
  it('ends sentences with exactly one full stop', () => {
    expect(sentence('quoted investor')).toBe('quoted investor.');
    expect(sentence('Done.')).toBe('Done.');
  });
});
