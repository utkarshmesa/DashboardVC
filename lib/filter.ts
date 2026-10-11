// SPEC §9.3: code filter before the LLM. Returns a reject reason, or null to send the item to the classifier.
// Phase 1 applies the window and name/firm rules; the ambiguous-name rule arrives in Phase 2.
import { containsPhrase, daysOld } from './text';
import type { VcContext } from './types';

export const mentionsName = (text: string, vc: Pick<VcContext, 'name' | 'aliases'>) =>
  [vc.name, ...vc.aliases].some((n) => containsPhrase(text, n));
export const mentionsFirm = (text: string, vc: Pick<VcContext, 'firm' | 'firmAliases'>) =>
  [vc.firm, ...vc.firmAliases].some((n) => containsPhrase(text, n));

export function filterReason(
  item: { title: string; snippet: string | null; published_at: string | null },
  vc: Pick<VcContext, 'name' | 'aliases' | 'firm' | 'firmAliases'>,
  windowDays: number,
  now: Date,
): string | null {
  if (item.published_at && daysOld(item.published_at, now) > windowDays) return 'out_of_window';
  const text = `${item.title} ${item.snippet ?? ''}`;
  if (!mentionsName(text, vc) && !mentionsFirm(text, vc)) return 'no_name_or_firm';
  return null;
}
