// SPEC §9.3: code filter before the LLM. Returns a reject reason, or null to send the item to the classifier.
import { containsPhrase, daysOld } from './text';
import type { VcContext } from './types';

export const mentionsName = (text: string, vc: Pick<VcContext, 'name' | 'aliases'>) =>
  [vc.name, ...vc.aliases].some((n) => containsPhrase(text, n));
export const mentionsFirm = (text: string, vc: Pick<VcContext, 'firm' | 'firmAliases'>) =>
  [vc.firm, ...vc.firmAliases].some((n) => containsPhrase(text, n));

export function filterReason(
  item: { title: string; snippet: string | null; published_at: string | null },
  vc: Pick<VcContext, 'name' | 'aliases' | 'firm' | 'firmAliases' | 'ambiguous'>,
  windowDays: number,
  now: Date,
  opts: { personRss?: boolean } = {},
): string | null {
  if (item.published_at && daysOld(item.published_at, now) > windowDays) return 'out_of_window';
  if (opts.personRss) return null; // the VC's own feed is exempt from the name/firm rules
  const text = `${item.title} ${item.snippet ?? ''}`;
  const firm = mentionsFirm(text, vc);
  if (!mentionsName(text, vc) && !firm) return 'no_name_or_firm';
  if (vc.ambiguous && !firm) return 'ambiguous_no_firm';
  return null;
}
