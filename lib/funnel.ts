// Review item 8: outreach outcomes. Pure helpers (event mapping and funnel maths); persistence lives in lib/outcomes.ts.
export type OutreachEvent = { vc_id: string; event: string; fit_label: string | null; had_hook: boolean | null; at: string };

// Which event a status change represents (inline edits and quick actions both go through this).
export function statusEvent(before: string, after: string): string | null {
  if (before === after) return null;
  if (after === 'awaiting_response') return before === 'not_contacted' ? 'emailed' : 'nudged';
  if (after === 'in_conversation') return 'replied';
  if (after === 'passed') return 'passed';
  return 'status_change';
}

export type FunnelRow = { group: string; emailed: number; replied: number; meeting: number; replyRate: number | null; meetingRate: number | null };

// Per VC, the first "emailed" event starts an attempt; a later replied/meeting event counts as its outcome.
// Grouped by fit label and by whether a news hook existed when the email went out.
export function computeFunnel(events: OutreachEvent[]): { byFit: FunnelRow[]; byHook: FunnelRow[]; total: FunnelRow } {
  const byVc = new Map<string, OutreachEvent[]>();
  for (const e of [...events].sort((a, b) => a.at.localeCompare(b.at))) byVc.set(e.vc_id, [...(byVc.get(e.vc_id) ?? []), e]);
  const attempts: { fit: string; hook: string; replied: boolean; meeting: boolean }[] = [];
  for (const list of byVc.values()) {
    const start = list.findIndex((e) => e.event === 'emailed');
    if (start < 0) continue;
    const after = list.slice(start + 1);
    attempts.push({
      fit: list[start].fit_label ?? 'unknown',
      hook: list[start].had_hook ? 'with news hook' : 'without news hook',
      replied: after.some((e) => e.event === 'replied' || e.event === 'meeting'),
      meeting: after.some((e) => e.event === 'meeting'),
    });
  }
  const row = (group: string, xs: typeof attempts): FunnelRow => {
    const emailed = xs.length, replied = xs.filter((x) => x.replied).length, meeting = xs.filter((x) => x.meeting).length;
    return { group, emailed, replied, meeting, replyRate: emailed ? replied / emailed : null, meetingRate: emailed ? meeting / emailed : null };
  };
  const groups = (key: 'fit' | 'hook', order: string[]) =>
    order.map((g) => row(g, attempts.filter((a) => a[key] === g))).filter((r) => r.emailed > 0);
  return {
    byFit: groups('fit', ['strong', 'good', 'weak', 'unknown']),
    byHook: groups('hook', ['with news hook', 'without news hook']),
    total: row('all', attempts),
  };
}
