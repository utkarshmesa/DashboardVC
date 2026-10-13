'use client';
// Pipeline (Plan V2): every investor in one table shaped like Vikram's spreadsheet. The columns mirror his Supabase
// table: his own (status, last contact, notes) and the four the pipeline writes (last signal, summary, score, action).
// Filter, sort, and open a row for the full dossier.
import { useRouter } from 'next/navigation';
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
// Default order follows the week's plan: follow-ups, signal, check-first, capacity, … quiet, passed.
const PLAN = ['followups', 'thisWeek', 'conflict', 'capacity', 'sameFirm', 'wait', 'snoozed', 'quiet', 'unavailable', 'passed'];
const SORTS = {
  priority: { label: "This week's plan", fn: (a: VcView, b: VcView) => PLAN.indexOf(a.section) - PLAN.indexOf(b.section) },
  score: { label: 'Follow-up score', fn: (a: VcView, b: VcView) => (b.score ?? 0) - (a.score ?? 0) },
  signal: { label: 'Last signal', fn: (a: VcView, b: VcView) => (b.lastSignalDate ?? '').localeCompare(a.lastSignalDate ?? '') },
  contact: { label: 'Last contact', fn: (a: VcView, b: VcView) => (b.lastContactDate ?? '').localeCompare(a.lastContactDate ?? '') },
  name: { label: 'Name', fn: (a: VcView, b: VcView) => a.name.localeCompare(b.name) },
} as const;
const day = (iso: string | null) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }) : '—');

const istToday = () => new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10);

// In-cell edits use the same endpoint as the dossier's Notes tab (his columns only; the status change is logged).
function useSave(vc: VcView) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'saving' | 'error'>('idle');
  async function save(patch: { status?: VcView['status']; notes?: string | null }) {
    setState('saving');
    const status = patch.status ?? vc.status;
    // Moving someone to "awaiting reply" or "in conversation" without a contact date means "today".
    const date = vc.lastContactDate ?? (status === 'awaiting_response' || status === 'in_conversation' ? istToday() : null);
    try {
      const r = await fetch(`/api/vc/${vc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, last_contact_date: date, notes: patch.notes !== undefined ? patch.notes : vc.notes }) });
      if (!r.ok) throw new Error(String(r.status));
      setState('idle'); router.refresh();
      return true;
    } catch { setState('error'); return false; }
  }
  return { state, save };
}

function StatusCell({ vc }: { vc: VcView }) {
  const { state, save } = useSave(vc);
  return (
    <span className="inline-flex items-center gap-1.5">
      <select aria-label={`Status for ${vc.name}`} value={vc.status} disabled={state === 'saving'} onChange={(e) => save({ status: e.target.value as VcView['status'] })}
        className={`h-7 border border-transparent bg-transparent pr-1 text-[13px] hover:border-line-2 focus:border-ink-2 ${STATUS[vc.status].cls}`}>
        {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k} className="bg-paper text-ink">{s.label}</option>)}
      </select>
      {state === 'error' && <span role="alert" className="text-[11px] text-danger">Not saved</span>}
    </span>
  );
}

function NotesCell({ vc }: { vc: VcView }) {
  const { state, save } = useSave(vc);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(vc.notes ?? '');
  if (!editing) return (
    <button type="button" onClick={() => { setText(vc.notes ?? ''); setEditing(true); }} title="Edit notes" className="block w-full text-left hover:text-ink">
      <span className="line-clamp-2">{vc.notes ? vc.notes.replace(/^\[demo\]\s*/, '') : <span className="text-ink-3/70">Add a note</span>}</span>
      {state === 'error' && <span role="alert" className="text-[11px] text-danger">Not saved</span>}
    </button>
  );
  const commit = async () => { if (text !== (vc.notes ?? '')) { if (await save({ notes: text.trim() || null })) setEditing(false); } else setEditing(false); };
  return (
    <textarea autoFocus aria-label={`Notes for ${vc.name}`} value={text} maxLength={4000} rows={3} disabled={state === 'saving'}
      onChange={(e) => setText(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } }}
      className="w-full border border-ink-2 bg-paper px-2 py-1 text-[13px] text-ink focus:outline-none" />
  );
}

export default function PipelineTable({ vcs }: { vcs: VcView[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [sort, setSort] = useState<keyof typeof SORTS>('priority');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter)!;
    const list = vcs.filter((v) => f.test(v));
    return [...list].sort(SORTS[sort].fn); // stable: ties keep the server's priority order
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
        <table className="w-full min-w-[1180px] border-collapse text-[13px]">
          <thead className="border-b border-line bg-surface">
            <tr><th className={th}>Investor</th><th className={th}>Thesis</th><th className={th}>Status</th><th className={th}>Last contact</th><th className={th}>Last signal</th><th className={th}>Signal summary</th><th className={`${th} text-right`} title="How strongly they engaged with logistics in the last 30 days (0–100)">Follow-up score</th><th className={th}>Recommended action</th><th className={th}>Notes</th></tr>
          </thead>
          <tbody>
            {rows.map((v) => {
              const tone = actionToneOf(v.action), isOpen = open === v.id;
              return (
                <Fragment key={v.id}>
                  <tr onClick={(e) => { if (!(e.target as HTMLElement).closest('a,button,select,textarea')) setOpen(isOpen ? null : v.id); }}
                    className={`cursor-pointer border-b border-line align-top transition-colors hover:bg-surface ${isOpen ? 'bg-surface' : ''}`}>
                    <td className="max-w-[230px] px-3 py-3">
                      <NameLinks name={v.name} firm={v.firm} linkedin={v.brief.linkedin} website={v.brief.website} className="block truncate" />
                      <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : v.id)} className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink">{isOpen ? 'Close' : 'Open dossier'}</button>
                    </td>
                    <td className="max-w-[200px] px-3 py-3 text-ink-3"><span className="line-clamp-2" title={v.thesis ?? undefined}>{v.thesis ?? '—'}</span></td>
                    <td className="whitespace-nowrap px-3 py-3"><StatusCell vc={v} />{isDemoNote(v.notes) && <Badge className="ml-1.5" title="Example history, not a real interaction">Demo</Badge>}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-ink-2">{day(v.lastContactDate)}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12px] text-ink-2">{day(v.lastSignalDate)}</td>
                    <td className="max-w-[320px] px-3 py-3 text-ink-2"><span className="line-clamp-2" title={v.summary ?? undefined}>{v.summary ?? '—'}</span></td>
                    <td className="px-3 py-3 text-right font-mono tabular-nums text-ink">{v.score ?? 0}</td>
                    <td className={`max-w-[220px] px-3 py-3 ${TONE[tone].text}`}><span className="line-clamp-2">{v.action}</span></td>
                    <td className="min-w-[200px] max-w-[260px] px-3 py-3 text-ink-3"><NotesCell vc={v} /></td>
                  </tr>
                  {isOpen && <tr className="border-b border-line bg-paper/60"><td colSpan={9} className="p-3 sm:p-4"><VcCard vc={v} /></td></tr>}
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
