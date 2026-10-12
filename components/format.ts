// Display helpers shared by server and client components. No data access here.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function day(iso: string | null, withYear = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const s = `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${s} ${d.getUTCFullYear()}` : s;
}

export const ist = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) + ' IST' : '—';

export const LEVEL_LABEL: Record<string, string> = {
  core: 'core', logistics_non_software: 'logistics (non-software)', adjacent: 'adjacent', unrelated: 'unrelated',
};

export const REASON_LABEL: Record<string, string> = {
  out_of_window: 'older than 30 days',
  no_name_or_firm: 'names neither the VC nor the firm',
  ambiguous_no_firm: 'common name without the firm',
  llm_not_about_vc: 'AI: not about this VC',
  llm_irrelevant: 'AI: not a usable signal',
  llm_low_confidence: 'AI: low confidence',
  llm_low_relevance: 'AI: outside the target space',
  llm_missing_or_invalid: 'AI returned no label',
};
