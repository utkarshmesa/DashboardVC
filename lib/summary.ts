// SPEC §9.7 summary text, built by code (amended in Plan V2, DECISIONS #55): the summary is the reason, in the problem's
// terms. It leads with the in-space signal when there is one, says plainly when activity is outside the space, and
// says when a VC has been quiet. Only signals dated inside the window are described as current.
import { EVIDENCE_MIN_RELEVANCE, SIGNAL_WINDOW_DAYS } from './config';
import type { Contribution, ScoreResult } from './scoring';
import { fmtDay } from './text';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const line = (c: Contribution) => `${cap(c.signal.signal_type ?? 'other')}: ${c.signal.summary ?? ''} (${fmtDay(c.signal.published_at!)})`;

export function summaryText(
  r: ScoreResult,
  opts: { conflict?: { company: string; date: string | null; evidence?: string } | null; lastSignalDate: string | null },
): string {
  if (opts.conflict?.evidence) return `Research: "${opts.conflict.evidence}". Check for a conflict before pitching.`;
  if (opts.conflict) {
    const when = opts.conflict.date ? ` (${fmtDay(opts.conflict.date)})` : '';
    return `Backed ${opts.conflict.company}${when}, a likely competitor.`;
  }
  const inSpace = r.counted.filter((c) => (c.signal.relevance ?? 0) >= EVIDENCE_MIN_RELEVANCE).sort((a, b) => b.value - a.value);
  if (inSpace.length) {
    const more = inSpace.length > 1 ? ` · +${inSpace.length - 1} more in your space` : '';
    return `In your space — ${line(inSpace[0])}${more}`;
  }
  if (r.counted.length) {
    const newest = [...r.counted].sort((a, b) => a.daysOld - b.daysOld)[0];
    return `No logistics activity in ${SIGNAL_WINDOW_DAYS} days. Active elsewhere — ${line(newest)}`;
  }
  if (opts.lastSignalDate) return `Quiet: no public activity in ${SIGNAL_WINDOW_DAYS} days. Last seen ${fmtDay(opts.lastSignalDate, true)}.`;
  return `Quiet: no public activity found in ${SIGNAL_WINDOW_DAYS} days.`;
}
