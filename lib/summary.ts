// SPEC §9.7 summary text, built by code.
import { SIGNAL_WINDOW_DAYS } from './config';
import type { ScoreResult } from './scoring';
import { fmtDay } from './text';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function summaryText(
  r: ScoreResult,
  opts: { conflict?: { company: string; date: string | null; evidence?: string } | null; lastSignalDate: string | null },
): string {
  if (opts.conflict?.evidence) return `Research: "${opts.conflict.evidence}". Check for a conflict before pitching.`;
  if (opts.conflict) {
    const when = opts.conflict.date ? ` (${fmtDay(opts.conflict.date)})` : '';
    return `Backed ${opts.conflict.company}${when}, a likely competitor.`;
  }
  if (r.top) {
    const s = r.top.signal;
    const when = s.published_at ? fmtDay(s.published_at) : 'date approx';
    const more = r.groups.length > 1 ? ` · +${r.groups.length - 1} more` : '';
    return `${cap(s.signal_type ?? 'other')}: ${s.summary ?? ''} (${when})${more}`;
  }
  if (opts.lastSignalDate) return `No public activity in ${SIGNAL_WINDOW_DAYS} days. Last seen ${fmtDay(opts.lastSignalDate, true)}.`;
  return `No public activity found in ${SIGNAL_WINDOW_DAYS} days.`;
}
