// Phase 5 (docs/REVIEW.md): investor fit and standing conflicts, computed in code from the verified research in
// vc_profile and the founder's settings. Pure and explainable: every point and flag carries a human-readable reason.
import { FIT_GOOD, FIT_STRONG } from './config';

export type Research = {
  fit_reason?: string; latest_relevant_deal?: string; conflicts?: string; approach?: string; first_cheque?: string; stage_focus?: string;
  title?: string; [k: string]: unknown;
};

export type FitInput = { tier: number | null; trust: string | null; thesis: string | null; research: Research | null };
export type Fit = { score: number; label: 'strong' | 'good' | 'weak'; reasons: string[]; flags: string[] };

const STOP = new Set(['software', 'management', 'analytics', 'business', 'platforms', 'platform', 'solutions', 'services', 'technology', 'including']);
const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// Significant words of the target space ("freight", "procurement", "warehouse", "telematics", …).
export function targetTerms(targetSpace: string): string[] {
  const words = targetSpace.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 5 && !STOP.has(w));
  return [...new Set(words)];
}

const matches = (text: string, terms: string[]) => terms.filter((t) => new RegExp(`\\b${t}`, 'i').test(text));

// "2026-08", "Oct 2023", "FreightFox seed, Oct 2023 (…)" → months before `now`, or null.
export function monthsAgo(deal: string | undefined, now: Date): number | null {
  if (!deal) return null;
  let y: number | null = null, m: number | null = null;
  const iso = deal.match(/(\d{4})-(\d{2})/);
  const named = deal.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{4})/i);
  if (iso) { y = Number(iso[1]); m = Number(iso[2]); } else if (named) { y = Number(named[2]); m = MONTHS[named[1].toLowerCase()]; }
  if (!y || !m) return null;
  return (now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() + 1 - m);
}

export function fitScore(i: FitInput, targetSpace: string, now = new Date()): Fit {
  const r = i.research ?? {};
  const reasons: string[] = [], flags: string[] = [];
  let score = i.tier === 1 ? 50 : i.tier === 2 ? 30 : 15;
  reasons.push(i.tier ? `research tier ${i.tier}` : 'no research tier');
  const terms = targetTerms(targetSpace);
  const inThesis = matches(i.thesis ?? '', terms), inFit = matches(r.fit_reason ?? '', terms);
  if (inThesis.length) { score += inThesis.length >= 2 ? 15 : 10; reasons.push(`thesis mentions ${inThesis.slice(0, 3).join(', ')}`); }
  if (inFit.length) { score += inFit.length >= 2 ? 12 : 8; reasons.push(`relevant deals: ${inFit.slice(0, 3).join(', ')}`); }
  const ago = monthsAgo(r.latest_relevant_deal, now);
  if (ago !== null && ago <= 12) { score += 10; reasons.push('relevant deal in the last 12 months'); }
  else if (ago !== null && ago <= 24) { score += 5; reasons.push('relevant deal in the last 24 months'); }
  if (i.trust === 'A') { score += 5; reasons.push('research trust A'); } else if (i.trust === 'A-') score += 3; else if (i.trust === 'C') score -= 5;

  // Deal-breakers for a Seed round, from the research text (each costs points and is shown on the card). The round size
  // isn't known (the problem only says Seed), so cheque-size judgements live in the brief, against Settings → Round size.
  const text = `${i.thesis ?? ''} ${r.fit_reason ?? ''} ${r.conflicts ?? ''} ${r.stage_focus ?? ''} ${r.first_cheque ?? ''}`;
  const flag = (re: RegExp, msg: string, cost: number) => { if (re.test(text)) { flags.push(msg); score -= cost; } };
  flag(/post-PMF|wants PMF|product-market fit established/i, 'wants product-market fit first', 8);
  flag(/(typical entry skews|usually) pre-Series A|Usually pre-Series A and Series A/i, 'usually invests after seed', 8);
  flag(/hard-science mandate|deep-tech remit|scope is specialised|do not assume appetite/i, 'thesis may not cover workflow SaaS', 5);
  flag(/above seed size/i, 'past deals were larger than a typical seed', 5);
  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, label: score >= FIT_STRONG ? 'strong' : score >= FIT_GOOD ? 'good' : 'weak', reasons, flags };
}

// Competitor categories named in the founder's product text (e.g. "TMS", "freight procurement"); empty product → none.
const CATEGORY_TERMS = ['TMS', 'transport management', 'freight procurement', 'freight-procurement', 'freight auction', 'WMS', 'warehouse management', 'fleet management', 'telematics'];
export function competitorTerms(myProduct: string): string[] {
  if (!myProduct.trim()) return [];
  return CATEGORY_TERMS.filter((t) => new RegExp(`\\b${t.replace(/-/g, '[- ]')}\\b`, 'i').test(myProduct));
}

export type StandingConflict = { term: string; evidence: string };

// A research note says the VC (or a partner at the same firm) backed a company in the founder's own category.
// Only fit_reason and latest_relevant_deal are read: the research `conflicts` field holds data caveats, not portfolio.
export function researchConflict(researches: (Research | null)[], terms: string[]): StandingConflict | null {
  for (const r of researches) {
    const text = `${r?.fit_reason ?? ''} ${r?.latest_relevant_deal ?? ''}`;
    for (const t of terms) {
      const m = text.match(new RegExp(`[^.;]*\\b${t.replace(/-/g, '[- ]')}\\b[^.;]*`, 'i'));
      if (m) return { term: t, evidence: m[0].trim().slice(0, 140) };
    }
  }
  return null;
}
