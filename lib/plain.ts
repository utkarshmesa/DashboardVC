// Plain-language wording for Vikram (stress test from his point of view, 2026-10-13): research notes are written for
// analysts ("Investor on official biography; Partner in July 2025 deal press", "stage conflict prevents using it as a
// recent seed proof"). These turn structured fields into one plain line. Pure and client-safe.

const ROLES = ['Managing Partner', 'General Partner', 'Founding Partner', 'Co-founder', 'Founder', 'Partner', 'Principal', 'Vice President', 'VP', 'Director', 'Investor', 'Associate', 'Analyst'];

// A clean job title. Research titles that are really verification notes (several sources, semicolons, "official",
// "press") become the most senior role they mention; a plain title is kept as written.
export function roleTitle(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!/;|official|press|biography|deal|according|reported|verified|listed/i.test(s)) return s;
  const found = ROLES.find((r) => new RegExp(`\\b${r}\\b`, 'i').test(s));
  return found ?? null;
}

const STAGE_WORDS: [RegExp, string][] = [[/pre-?seed/i, 'pre-seed'], [/\bseed\b/i, 'Seed'], [/series a/i, 'Series A']];

// Why a good-fit investor is worth a note even without fresh activity, from the fit reasons and stage (code, not AI).
export function plainFitReason(fit: { reasons: string[] }, stage: string | null): string {
  const r = fit.reasons.join(' | ');
  const parts: string[] = [];
  if (/relevant deal in the last 12 months/.test(r)) parts.push('backed a logistics company in the last year');
  else if (/relevant deal in the last 24 months/.test(r)) parts.push('backed a logistics company in the last two years');
  else if (/relevant deals:/.test(r)) parts.push('has backed logistics companies before');
  const thesis = r.match(/thesis mentions ([^|]+)/)?.[1]?.trim();
  if (thesis) parts.push(`their thesis covers ${thesis}`);
  const stages = STAGE_WORDS.filter(([re]) => re.test(stage ?? '')).map(([, w]) => w);
  if (stages.length) parts.push(`invests at ${stages.join(' and ')}`);
  if (!parts.length) parts.push('good fit from research');
  const s = parts.join('; ');
  return `${s.charAt(0).toUpperCase()}${s.slice(1)}.`;
}

// Join sentences with exactly one full stop between them.
export const sentence = (s: string) => { const t = s.trim(); return !t ? '' : /[.!?]$/.test(t) ? t : `${t}.`; };
