'use client';
// Pipeline (Plan V2): every investor in one table shaped like Vikram's spreadsheet. The columns mirror his Supabase
// table: his own (status, last contact, notes) and the four the pipeline writes (last signal, summary, score, action).
// Filter, sort, and open a row for the full dossier.
import { Fragment, useMemo, useState } from 'react';
import type { VcView } from '@/lib/dashboard';
import { isDemoNote } from '@/lib/demo-label';
import { actionToneOf, Badge, NameLinks, TONE } from './ui';
import VcCard from './VcCard.client';

const STATUS: Record<VcView['status'], { label: string; cls: string }> = {
  not_contacted: { label: 'Not contacted', cls: 'text-ink-3' },
  awaiting_response: { label: 'Awaiting reply', cls: 'text-info' },
  in_conversation: { label: 'In conversation', cls: 'text-accent-text' },
  passed: { label: 'Passed', cls: 'text-ink-3' },
};
const FILTERS = [
  { key: 'all', label: 'All', test: () => true },
  { key: 'todo', label: 'To do this week', test: (v: VcView) => ['followups', 'thisWeek', 'conflict', 'capacity'].includes(v.section) },
  { key: 'signal', label: 'Signal this week', test: (v: VcView) => v.section === 'thisWeek' },
  { key: 'active', label: 'In flight', test: (v: VcView) => v.status === 'awaiting_response' || v.status === 'in_conversation' },
  { key: 'quiet', label: 'Not worth chasing', test: (v: VcView) => v.section === 'quiet' },
  { key: 'passed', label: 'Passed', test: (v: VcView) => v.status === 'passed' },
] as const;
const SORTS = {
  priority: { label: 'Priority', fn: () => 0 },
  score: { label: 'Follow-up score', fn: (a: VcView, b: VcView) => (b.score ?? 0) - (a.score ?? 0) },
  signal: { label: 'Last signal', fn: (a: VcView, b: VcView) => (b.lastSignalDate ?? '').localeCompare(a.lastSignalDate ?? '') },
  contact: { label: 'Last contact', fn: (a: VcView, b: VcView) => (b.lastContactDate ?? '').localeCompare(a.lastContactDate ?? '') },
  name: { label: 'Name', fn: (a: VcView, b: VcView) => a.name.localeCompare(b.name) },
} as const;
const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—');

export default function PipelineTable({ vcs }: { vcs: VcView[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [sort, setSort] = useState<keyof typeof SORTS>('priority');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const list = vcs.filter((v) => f.test(v));
    return sort === 'priority' ? list : [...list].sort(SORTS[sort].fn);
  }, [vcs, filter, sort]);
  const th = 'px-3 py-2.5 text-left font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-ink-3 whitespace-nowrap';
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filter" className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => {
            const count = vcs.filter((v) => f.test(v)).length;
            return (
              <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
                className={`inline-flex h-8 items-center gap-2 border px-3 font-mono text-[10.5px] uppercase tracking-[0.1em] transition-colors ${filter === f.key ? 'border-ink bg-ink text-paper' : 'border-line-2 text-ink-2 hover:border-ink-3 hover:text-ink'}`}>
                {f.label}<span className={filter === f.key ? 'text-paper/70' : 'text-ink-3'}>{count}</span>
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">Sort
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)} className="h-8 border border-line-2 bg-paper px-2 text-[12px] normal-case tracking-normal text-ink">
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto border border-line">
        <table className="w-full min-w-[980px] border-collapse text-[13px]">
          <thead className="border-b border-line bg-surface">
            <tr><th className={th}>Investor</th><th className={th}>Status</th><th className={th}>Last contact</th><th className={th}>Last signal</th><th className={th}>Signal summary</th><th className={`${th} text-right`}>Score</th><th className={th}>Recommended action</th><th className={th}>Notes</th></tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const tone = actionToneOf(v.action), isOpen = open === v.id;
              return (
                <Fragment key={v.id}>
                  <tr onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button')) setOpen(isOpen ? null : v.id); }}
                    className={`cursor-pointer border-b border-line align-top transition-colors hover:bg-surface ${isOpen ? 'bg-surface' : ''}`}>
                    <td className="max-w-[230px] px-3 py-3">
                      <NameLinks name={v.name} firm={v.firm} linkedin={v.brief.linkedin} website={v.brief.website} className="block truncate" />
                      <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.id)} className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink">{isOpen ? 'Close' : 'Open dossier'}</button>
                    </td>
                    <td className={`whitespace-nowrap px-3 py-3 ${STATUS[v.status].cls}`}>{STATUS[v.status].label}{isDemoNote(v.notes) && <Badge className="ml-1.5" title="Example history, not a real interaction">Demo</Badge>}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-ink-2">{day(v.lastContactDate)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-ink-2">{day(v.lastSignalDate)}</td>
                    <td className="max-w-[320px] px-3 py-3 text-ink-2"><span className="line-clamp-2" title={v.summary ?? undefined}>{v.summary ?? '—'}</span></td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">{v.score ?? 0}</td>
                    <td className={`max-w-[220px] px-3 py-3 ${TONE[tone].text}`}><span className="line-clamp-2">{v.action}</span></td>
                    <td className="max-w-[220px] px-3 py-3 text-ink-3"><span className="line-clamp-2" title={v.notes ?? undefined}>{v.notes ? v.notes.replace(/^\[demo\]\s*/, '') : '—'}</span></td>
                  </tr>
                  {isOpen && <tr className="border-b border-line bg-paper/60"><td colSpan={8} className="p-3 sm:p-4"><VcCard vc={v} /></td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="mt-3 text-center text-[13px] text-ink-3">No investors match this filter.</p>}
    </div>
  );
}
