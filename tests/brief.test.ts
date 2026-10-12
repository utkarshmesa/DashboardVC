import { describe, expect, it } from 'vitest';
import { buildBrief, chequeMaxUsd, chequeNoteFrom, dealFromUrl, fundStatus, headline } from '@/lib/brief';

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

describe('stress: fund notes with several clauses (real notes)', () => {
  const s = (n: string) => fundStatus(n, NOW)?.label ?? null;
  it('a later fund that is only a target reads as raising, not fresh', () => {
    expect(s('Fund III INR 500 crore closed in 2023. Fund IV INR 1,100 crore launched January 2026 is a target, not a verified close.')).toBe('Raising a new fund · Jan 2026');
    expect(s('Fund III launch in February 2026 targets INR 400 crore including INR 150 crore greenshoe')).toBe('Raising a new fund · Feb 2026');
    expect(s('Fund IV closed USD 200 million May 2023. IFC September 2026 disclosure: Fund V target USD 225 million')).toBe('Raising a new fund · Sep 2026');
  });
  it('a recent close wins over a newer target; second closes and ISO dates are read', () => {
    expect(s('December 2025 reporting describes an approximately INR 700 crore debut-fund close; current site reports INR 723 crore. Fund II announced July 2026 targeting INR 1,500 crore')).toBe('Fresh fund · Dec 2025');
    expect(s('USD 150M second close of Fund V reported September 2025; not verified final fund total.')).toBe('Fresh fund · Sep 2025 (second close)');
    expect(s('Fund V first close USD 175M announced 2025-10-29; target USD 250–275M, not verified final close.')).toBe('Fresh fund · Oct 2025 (first close)');
  });
  it('follow-on-only funds warn; a dated portfolio deal is not fund news; missing spaces are tolerated', () => {
    expect(fundStatus('Titan Capital Winners Fund final close INR 333 crore October 21, 2024; follow-on-only mandate for existing portfolio', NOW)).toEqual({ label: 'Follow-on-only fund · Oct 2024', tone: 'warn' });
    expect(s("Fund III is described as USD 75 million. Exact vintage and final close not independently established. Fund I winding up does not mean firm inactivity; CargoFL's 2025 seed qualifies.")).toBeNull();
    expect(s('Fund III anchor commitment INR1,000 crore approved May2025; USD180–200M target reported June2025, not verified final close')).toBe('Raising a new fund · Jun 2025');
  });
});

describe('stress: deal noise and duplicates (real headlines)', () => {
  it('rejects fund raises, LP investments, weekly roundups, criteria pages and generic pieces', () => {
    for (const u of [
      'https://www.accel.com/noteworthies/accel-raises-650m-for-ninth-india-fund-doubles-down-on-ai',
      'https://yourstory.com/2023/06/yara-growth-ventures-invests-in-omnivores-third-fund',
      'https://inc42.com/buzz/from-emotorad-to-phicommerce-indian-startups-raised-this-week/',
      'https://blume.vc/blume-s-investment-criteria-be604cba9ebd4d8ea1d9334f9eb2deef',
      'https://example.com/venture-capital-firm-speciale-invest-back-indian-startups-with-rs-100-cr-by-2025',
    ]) expect(dealFromUrl(u)).toBeNull();
  });
  it('merges the same company across differently worded headlines within one investor', () => {
    const b = buildBrief({ research: { source_urls: [
      'https://a.com/quick-commerce-enabler-inamo-secures-seed-funding-to-expand-dark-store-network',
      'https://b.com/q-com-start-up-inamo-raises-series-a-round-led-by-prime-venture-partners',
      'https://c.com/trupeerai-raises-seed-round', 'https://d.com/trupeer-ai-raises-seed-round-led-by-rtp-global',
      'https://e.com/wootzwork-raises-6-6m-to-bring-predictability', 'https://f.com/wootz-work-raises-3-5m-led-by-matrix',
      'https://g.com/zango-raises-4-8-million-nexus-south-park', 'https://h.com/bengaluru-ai-regulatory-compliance-startup-zango-funding-nexus',
      'https://i.com/superprocure-a-unified-tms-platform-secures-investment-led-by-pentathlon',
    ].join('; ') }, thesis: null, trust: null, linkedinSlug: null, firmFund: null, fitFlags: [], verifiedDeals: [{ company: 'SuperProcure', round: 'investment', date: '2026-02', url: null }] }, NOW);
    expect(b.dealCount).toBe(5); // Inamo, Trupeer, Wootzwork, Zango, SuperProcure
    expect(b.deals.find((d) => /inamo/i.test(d.label))?.round).toBe('Seed, Series A');
  });
  it('in-space from research prose is clause-bounded; cross-border trade counts', () => {
    const b = buildBrief({ research: { fit_reason: 'Official partnerships include Wootzwork and Zango; industrial procurement seed exposure.', source_urls: 'https://g.com/zango-raises-4-8-million-nexus-south-park' }, thesis: null, trust: null, linkedinSlug: null, firmFund: null, fitFlags: [], verifiedDeals: [] }, NOW);
    expect(b.deals[0].inSpace).toBe(false);
    expect(dealFromUrl('https://x.com/saas-startup-trezix-bags-rs-10-cr-to-streamline-import-and-export-solutions')?.inSpace).toBe(true);
  });
});

describe('stress: cheque size against a USD 1–3M round', () => {
  it('reads the top of USD and INR-crore ranges', () => {
    expect(chequeMaxUsd('USD 250,000–600,000 initial investment')).toBe(600_000);
    expect(chequeMaxUsd('Seed USD 0.5–3M; Series A USD 3.5–10M.')).toBe(10_000_000);
    expect(chequeMaxUsd('USD500k–5M average')).toBe(5_000_000);
    expect(Math.round(chequeMaxUsd('Average Rs 4-8 Cr (~USD 0.5-1M)')!)).toBe(1_000_000);
    expect(Math.round(chequeMaxUsd('INR 6–8 crore for announced Fund III')! / 1000)).toBe(964);
    expect(chequeMaxUsd('Typical seed cheque not public')).toBeNull();
  });
  it('notes "likely a co-investor" only when the cheque tops out below USD 1M', () => {
    expect(chequeNoteFrom('USD 250,000–600,000 initial investment')).toBe('Cheques up to about $600K: likely a co-investor, not your lead');
    expect(chequeNoteFrom('USD 500k–1M; firm prefers to lead or co-lead.')).toBeNull();
    expect(chequeNoteFrom('USD 1–2 million initial investment')).toBeNull();
    expect(chequeNoteFrom(null)).toBeNull();
  });
});
