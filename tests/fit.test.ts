import { describe, expect, it } from 'vitest';
import { competitorTerms, fitScore, monthsAgo, researchConflict, targetTerms } from '@/lib/fit';
import { DEFAULT_MY_PRODUCT, DEFAULT_TARGET_SPACE } from '@/lib/config';

const NOW = new Date('2026-10-12T00:00:00Z');

describe('fit score (research-based, code only)', () => {
  it('rewards tier, thesis and deal relevance to the target space, recency and trust', () => {
    const strong = fitScore({ tier: 1, trust: 'A', thesis: 'Early-stage thematic fund: Distribution & Supply Chain', research: {
      fit_reason: 'Supply-chain sector lead; firm backed Enmovil logistics SaaS', latest_relevant_deal: '2026-08' } }, DEFAULT_TARGET_SPACE, NOW);
    expect(strong.label).toBe('strong');
    expect(strong.reasons.join(' ')).toMatch(/tier 1.*thesis mentions supply.*relevant deals.*12 months.*trust A/);
    const weak = fitScore({ tier: 2, trust: 'B', thesis: 'Consumer brands and D2C', research: { fit_reason: 'Backs consumer apps' } }, DEFAULT_TARGET_SPACE, NOW);
    expect(weak.label).toBe('weak');
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('flags deal-breakers for a USD 1–3M seed and costs points', () => {
    const base = { tier: 2, trust: 'B', thesis: 'logistics', research: { fit_reason: 'logistics syndicate' } };
    const small = fitScore({ ...base, research: { fit_reason: 'Most logistics-active syndicate; cheques too small to anchor a USD 1-3M seed' } }, DEFAULT_TARGET_SPACE, NOW);
    expect(small.flags).toContain('cheques too small to lead this round');
    expect(small.score).toBeLessThan(fitScore(base, DEFAULT_TARGET_SPACE, NOW).score);
    expect(fitScore({ ...base, research: { stage_focus: 'Seed (post-PMF)' } }, DEFAULT_TARGET_SPACE, NOW).flags).toContain('wants product-market fit first');
  });

  it('parses deal dates in ISO-month and month-name forms', () => {
    expect(monthsAgo('2026-08', NOW)).toBe(2);
    expect(monthsAgo('FreightFox seed, Oct 2023 (2026 round led by HighLeaf)', NOW)).toBe(36);
    expect(monthsAgo('not dated', NOW)).toBeNull();
  });

  it('derives target terms from the target space setting', () => {
    expect(targetTerms(DEFAULT_TARGET_SPACE)).toEqual(expect.arrayContaining(['logistics', 'freight', 'procurement', 'warehouse', 'telematics']));
  });
});

describe('standing conflicts', () => {
  it('competitor terms come from the founder product; empty product means none', () => {
    expect(competitorTerms(DEFAULT_MY_PRODUCT)).toEqual(expect.arrayContaining(['TMS', 'freight procurement']));
    expect(competitorTerms('')).toEqual([]);
    expect(competitorTerms('Warehouse management (WMS) for 3PLs')).toEqual(expect.arrayContaining(['WMS', 'warehouse management']));
  });

  it('finds a research note that the VC or a firm partner backed a company in the founder category', () => {
    const terms = competitorTerms(DEFAULT_MY_PRODUCT);
    const c = researchConflict([{ fit_reason: 'Firm co-led an EXIM SaaS seed' }, { fit_reason: 'Personally associated with fresh TMS investment and logistics mandate.' }], terms);
    expect(c).toMatchObject({ term: 'TMS' });
    expect(c!.evidence).toContain('fresh TMS investment');
    expect(researchConflict([{ fit_reason: 'Backed a warehouse robotics company', conflicts: 'TMS naming caveat' }], terms)).toBeNull(); // caveats field ignored
    expect(researchConflict([{ fit_reason: 'fresh TMS investment' }], [])).toBeNull();
  });
});
