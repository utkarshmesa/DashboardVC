import { describe, expect, it } from 'vitest';
import { buildBrief, dealFromUrl, fundStatus, headline } from '@/lib/brief';

const NOW = new Date('2026-10-12T00:00:00Z');

describe('deal headlines from source URLs', () => {
  it('drops amounts (slugs garble decimals), tidies symbols, title-cases, restores acronyms', () => {
    expect(headline('b2b manufacturing platform magma raises 3 3 million in seed funding')).toBe('B2B Manufacturing Platform Magma Raises Seed Funding');
    expect(headline('logistics tech startup lobb raises $2.9 m')).toBe('Logistics Tech Startup Lobb Raises');
    expect(headline('wootzwork raises 66 million in series a led by z47')).toBe('Wootzwork Raises Series A Led by Z47');
    expect(headline('h2loop raises seed for ai native saas')).toBe('H2loop Raises Seed for AI Native SaaS');
  });
  it('recognises deals, including LinkedIn posts and firm blog posts; rejects lists, roundups and fund news', () => {
    expect(dealFromUrl('https://www.moneycontrol.com/news/business/yantra-packs-raises-seed-funding-from-caret-capital-to-expand-reusable-packaging-network-14010610.html')).toMatchObject({ label: 'Yantra Packs Raises Seed Funding from Caret Capital to Expand Reusable Packaging Network', round: 'Seed', inSpace: true });
    expect(dealFromUrl('https://www.linkedin.com/posts/caretcapital_caret-capital-invests-in-enmovil-a-saas-based-activity-7199258468799635456-Domt')?.label).toBe('Caret Capital Invests in Enmovil a SaaS Based');
    expect(dealFromUrl('https://entrackr.com/2023/07/blitz-raises-3-mn-in-seed-round-led-by-india-quotient')).toMatchObject({ year: '2023', round: 'Seed' });
    expect(dealFromUrl('https://inc42.com/features/meet-the-top-10-indian-startup-investors-of-2025/')).toBeNull();
    expect(dealFromUrl('https://yourstory.com/2026/01/funding-roundup-dwija-foods-webnyay-razor-club-early-stage-deals')).toBeNull();
    expect(dealFromUrl('https://www.livemint.com/companies/stellaris-venture-launches-its-largest-ever-300-million-fund-seed-series-a')).toBeNull();
    expect(dealFromUrl('https://www.caretcapital.in/')).toBeNull();
    expect(dealFromUrl('not a url')).toBeNull();
  });
});

describe('fund status (never upgrades a target to a close)', () => {
  it('fresh when raised/closed/announced in the last 24 months', () => {
    expect(fundStatus('Fund V USD 129 million announced October 22, 2025', NOW)).toEqual({ label: 'Fresh fund · Oct 2025', tone: 'accent' });
    expect(fundStatus('Fund II: INR 160 crore first close June 2025; INR 400 crore target', NOW)?.label).toBe('Fresh fund · Jun 2025 (first close)');
  });
  it('a target, or a negated close, reads as raising', () => {
    expect(fundStatus('September 2026 reporting: targeting USD 250M India Fund V, about 80% committed; not verified as a final close.', NOW)).toEqual({ label: 'Raising a new fund · Sep 2026', tone: 'info' });
  });
  it('old funds and undated notes get no badge', () => {
    expect(fundStatus('Fund IV closed USD 200 million May 2023.', NOW)).toBeNull();
    expect(fundStatus('Large multi-stage fund', NOW)).toBeNull();
    expect(fundStatus(null, NOW)).toBeNull();
  });
});

describe('buildBrief', () => {
  const research = {
    title: 'Co-founder and Managing Partner', title_verified: '2026-10-11 (live official page)', city: 'Not independently verified',
    first_cheque: 'Up to INR 15 crore / USD 2M', stage_focus: 'Seed to Series A', approach: 'Public contact form', latest_relevant_deal: '2026-08',
    conflicts: 'Do not label the target as raised.', fit_reason: 'Firm backed Yantra Packs seed in 2026 and Enmovil logistics SaaS pre-Series A.',
    source_urls: [
      'https://www.moneycontrol.com/news/business/yantra-packs-raises-seed-funding-from-caret-capital-14010610.html',
      'https://indianstartupnews.com/funding/logistics-and-supply-chain-startup-yantra-packs-raises-rs-12-crore-in-seed-funding-from-caret-capital-12398243',
      'https://www.linkedin.com/posts/caretcapital_caret-capital-invests-in-enmovil-a-saas-based-activity-7199258468799635456-Domt',
      'https://news.ventureintelligence.com/private-equity/logistics-s-ware-maker-superprocure-raises-funding-from-carat-capital',
      'https://www.caretcapital.in/',
    ].join('; '),
  };
  const b = buildBrief({
    research, thesis: 'Distribution & Supply Chain', trust: 'A', linkedinSlug: 'prajaktraut', firmName: 'Caret Capital',
    firmFund: 'Fund II: INR 160 crore first close June 2025', fitFlags: ['cheques too small to lead this round'], competitors: ['SuperProcure', 'TMS'],
    verifiedDeals: [{ company: 'Yantra Packs', round: 'seed', date: '2026-08', url: 'https://example.com/yantra' }],
  }, NOW);
  it('person and fund facts; unverified placeholders hidden', () => {
    expect(b).toMatchObject({ title: 'Co-founder and Managing Partner', titleVerified: '2026-10-11', city: null, linkedin: 'https://www.linkedin.com/in/prajaktraut', trust: 'A', sourceCount: 5 });
    expect(b.fundStatus?.label).toBe('Fresh fund · Jun 2025 (first close)');
    expect(b.chequeNote).toBe('Cheques too small to lead this round');
    expect(b.caveats).toMatch(/Do not label/);
  });
  it('merges the same company across sources, keeps the verified one, no "seed, Seed" duplicates', () => {
    const yantra = b.deals.filter((d) => /yantra/i.test(d.label));
    expect(yantra).toHaveLength(1);
    expect(yantra[0]).toMatchObject({ label: 'Yantra Packs', verified: true, round: 'seed' });
  });
  it('tags in-space from the research prose, and flags a known competitor first', () => {
    expect(b.deals.find((d) => /enmovil/i.test(d.label))?.inSpace).toBe(true);
    expect(b.deals[0]).toMatchObject({ competitor: true });
    expect(b.competitorDeals[0]).toMatch(/Superprocure/);
  });
  it('an investor with no research still gets an empty, safe brief', () => {
    const e = buildBrief({ research: null, thesis: null, trust: null, linkedinSlug: null, firmFund: null, fitFlags: [], verifiedDeals: [] }, NOW);
    expect(e).toMatchObject({ deals: [], dealCount: 0, fund: null, fundStatus: null, competitorDeals: [], sourceCount: 0 });
  });
});
