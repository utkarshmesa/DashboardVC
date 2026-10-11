import { containsPhrase, daysOld } from './text.js';
import type { Item, SpikeVc } from './types.js';

export const nameHit = (text: string, vc: SpikeVc) => [vc.name, ...vc.aliases].some((n) => containsPhrase(text, n));
export const firmHit = (text: string, vc: SpikeVc) => [vc.firm, ...vc.firmAliases].some((n) => containsPhrase(text, n));

// SPEC §9.3. Returns a reject reason, or null if the item may go to the classifier.
export function filterReason(item: Pick<Item, 'title' | 'snippet' | 'published_at'>, vc: SpikeVc, windowDays: number, now: Date): string | null {
  if (item.published_at && daysOld(item.published_at, now) > windowDays) return 'out_of_window';
  const text = `${item.title} ${item.snippet ?? ''}`;
  const n = nameHit(text, vc), f = firmHit(text, vc);
  if (!n && !f) return 'no_name_or_firm';
  if (vc.ambiguous && !f) return 'ambiguous_no_firm';
  return null;
}
