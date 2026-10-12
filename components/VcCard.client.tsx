'use client';
// One VC: decision first (action, score, why, source), proof one click away (SPEC §11.2–11.6).
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { SignalView, VcView } from '@/lib/dashboard';
import { actionTone, day, LEVEL_LABEL, REASON_LABEL } from './format';

const STATUSES = [
  ['not_contacted', 'Not contacted'], ['awaiting_response', 'Awaiting response'], ['in_conversation', 'In conversation'], ['passed', 'Passed'],
] as const;

function Auto() {
  return <span className="ml-1 rounded bg-neutral-100 px-1 text-[10px] uppercase tracking-wide text-neutral-500">auto</span>;
}

function Thumbs({ s }: { s: SignalView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function vote(v: 'up' | 'down') {
    setBusy(true);
    await fetch('/api/feedback', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signal_id: s.id, verdict: s.verdict === v ? null : v }),
    });
    setBusy(false);
    router.refresh();
  }
  const btn = (v: 'up' | 'down', label: string, glyph: string) => (
    <button type="button" disabled={busy} onClick={() => vote(v)} aria-label={label} aria-pressed={s.verdict === v}
      className={`rounded px-1.5 py-0.5 text-sm ${s.verdict === v ? (v === 'up' ? 'bg-emerald-100' : 'bg-rose-100') : 'hover:bg-neutral-100'} disabled:opacity-50`}>
      {glyph}
    </button>
  );
  return <span className="inline-flex gap-1">{btn('up', 'Useful signal', '👍')}{btn('down', 'Wrong or useless signal', '👎')}</span>;
}

function CopyHook({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button type="button" className="rounded border border-neutral-300 px-2 py-0.5 text-xs hover:bg-neutral-50"
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function EditForm({ vc }: { vc: VcView }) {
  const router = useRouter();
  const [status, setStatus] = useState(vc.status);
  const [date, setDate] = useState(vc.lastContactDate ?? '');
  const [notes, setNotes] = useState(vc.notes ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = <T,>(set: (v: T) => void) => (v: T) => { set(v); setState('idle'); }; // a new edit clears "Saved"
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState('saving');
    const r = await fetch(`/api/vc/${vc.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, last_contact_date: date || null, notes: notes || null }),
    });
    setState(r.ok ? 'saved' : 'error');
    router.refresh();
  }
  return (
    <form onSubmit={save} className="grid gap-2 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end">
      <label className="text-xs text-neutral-600">Status
        <select value={status} onChange={(e) => dirty(setStatus)(e.target.value as VcView['status'])} className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm">
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="text-xs text-neutral-600">Last contact
        <input type="date" value={date} onChange={(e) => dirty(setDate)(e.target.value)} className="mt-1 block rounded border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <label className="text-xs text-neutral-600">Notes
        <input value={notes} onChange={(e) => dirty(setNotes)(e.target.value)} maxLength={4000} className="mt-1 block w-full rounded border border-neutral-300 px-2 py-1 text-sm" />
      </label>
      <span className="flex items-center gap-2">
        <button type="submit" disabled={state === 'saving'} className="rounded bg-neutral-900 px-3 py-1 text-sm text-white disabled:opacity-50">Save</button>
        {state === 'saved' && <span className="text-xs text-emerald-700">Saved</span>}
        {state === 'idle' && (status !== vc.status || date !== (vc.lastContactDate ?? '') || notes !== (vc.notes ?? '')) && <span className="text-xs text-amber-700">Unsaved</span>}
        {state === 'error' && <span className="text-xs text-rose-700">Failed</span>}
      </span>
    </form>
  );
}

type Quick = 'emailed' | 'replied' | 'meeting' | 'passed' | 'snooze' | 'unsnooze' | 'dismiss_conflict' | 'restore_conflict';

function QuickActions({ vc }: { vc: VcView }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Quick | null>(null);
  async function go(action: Quick) {
    setBusy(action);
    await fetch(`/api/vc/${vc.id}/quick`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    setBusy(null);
    router.refresh();
  }
  const b = (action: Quick, label: string, tone = 'border-neutral-300 hover:bg-neutral-50') => (
    <button key={action} type="button" disabled={!!busy} onClick={() => go(action)}
      className={`rounded border px-2 py-0.5 text-xs disabled:opacity-50 ${tone}`}>{busy === action ? '…' : label}</button>
  );
  const items: React.ReactNode[] = [];
  if (vc.status !== 'passed') {
    if (vc.status === 'not_contacted') items.push(b('emailed', 'Emailed today'));
    if (vc.status === 'awaiting_response') items.push(b('emailed', 'Nudged today'), b('replied', 'They replied'));
    if (vc.status !== 'not_contacted') items.push(b('meeting', 'Meeting booked'));
    items.push(vc.snoozedUntil ? b('unsnooze', 'Unsnooze') : b('snooze', 'Snooze 2 weeks'));
    items.push(b('passed', 'Passed', 'border-neutral-300 text-neutral-500 hover:bg-neutral-50'));
  }
  if (vc.conflict && !vc.conflict.dismissed) items.push(b('dismiss_conflict', 'Not a conflict', 'border-rose-300 text-rose-800 hover:bg-rose-50'));
  if (vc.conflict?.dismissed) items.push(b('restore_conflict', 'Restore conflict flag', 'border-rose-200 text-rose-700 hover:bg-rose-50'));
  return items.length ? <div className="mt-2 flex flex-wrap gap-1.5">{items}</div> : null;
}

const FIT_TONE = { strong: 'bg-emerald-50 text-emerald-800 ring-emerald-200', good: 'bg-sky-50 text-sky-800 ring-sky-200', weak: 'bg-neutral-50 text-neutral-600 ring-neutral-200' };

function SignalLine({ s }: { s: SignalView }) {
  return (
    <li className="border-t border-neutral-100 py-2 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm">
          <span className="mr-2 rounded bg-neutral-100 px-1.5 py-0.5 text-xs capitalize">{s.type ?? '—'}</span>
          <span className="mr-2 text-xs text-neutral-500">{s.date ? day(s.date) : s.dateApprox ? 'date approx' : 'date unknown'}</span>
          <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-neutral-300 hover:decoration-neutral-700">{s.title}</a>
          {s.sourceName && <span className="ml-1 text-xs text-neutral-500">· {s.sourceName}</span>}
        </span>
        <span className="flex items-center gap-2">
          {s.contribution !== null && <span className="text-xs tabular-nums text-neutral-600" title="Points this signal adds to the score">+{s.contribution} pts</span>}
          <Thumbs s={s} />
        </span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-500">
        AI labels: {s.aboutThisVc ? 'about this VC' : 'not about this VC'} · {s.subject ?? '—'} · {s.type ?? '—'} · relevance {LEVEL_LABEL[s.relevanceLevel ?? ''] ?? '—'} · confidence {s.confidence ?? '—'}
        {s.competitor && <span className="ml-1 text-rose-700">· possible competitor</span>}
        {s.roleHint && <span className="ml-1 text-violet-700">· role: {s.roleHint}</span>}
        {s.verdict === 'down' && <span className="ml-1 text-rose-700">· excluded by your 👎</span>}
      </p>
    </li>
  );
}

export default function VcCard({ vc }: { vc: VcView }) {
  const [open, setOpen] = useState(false);
  return (
    <article className="rounded-lg border border-neutral-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${actionTone(vc.action)}`}>{vc.action}</span>
        <span className="text-xs tabular-nums text-neutral-600" title="Recent-signal score (0–100): how strong this VC's public activity in the last 30 days is">news {vc.score ?? 0}<Auto /></span>
        <h3 className="text-base font-semibold">{vc.name}</h3>
        <span className="text-sm text-neutral-600">{vc.firm}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] ring-1 ${FIT_TONE[vc.fit.label]}`} title={`Fit ${vc.fit.score}/100: ${vc.fit.reasons.join('; ')}`}>{vc.fit.label} fit {vc.fit.score}</span>
        {vc.trust && <span className="rounded border border-neutral-300 px-1 text-[10px] text-neutral-600" title="Research trust level">trust {vc.trust}</span>}
        {vc.badges.map((b) => <span key={b} className="rounded bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-800">{b}</span>)}
      </div>
      <p className="mt-1 text-sm text-neutral-800">{vc.summary ?? 'No public activity found in 30 days.'}<Auto /></p>
      {vc.whyFit && <p className="mt-1 text-xs text-neutral-700"><span className="font-medium text-neutral-500">Why fit:</span> {vc.whyFit}</p>}
      {vc.conflict && !vc.conflict.dismissed && vc.action.startsWith('Check conflict') && (
        <p className="mt-1 text-xs text-rose-800"><span className="font-medium">Research:</span> “{vc.conflict.evidence}” (applies to the whole firm)</p>
      )}
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-neutral-600">
        {vc.approach && <span><span className="text-neutral-500">Reach via:</span> {vc.approach.url
          ? <a href={vc.approach.url} target="_blank" rel="noopener noreferrer" className="underline">{vc.approach.text.replace(vc.approach.url, '').trim() || 'form'} ↗</a>
          : vc.approach.text}</span>}
        {vc.cheque && <span><span className="text-neutral-500">Cheque:</span> {vc.cheque}</span>}
        {vc.stage && <span><span className="text-neutral-500">Stage:</span> {vc.stage}</span>}
      </p>
      {vc.fit.flags.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{vc.fit.flags.map((f) => <span key={f} className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] text-rose-800">⚠ {f}</span>)}</div>}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
        {vc.newest && <a href={vc.newest.url} target="_blank" rel="noopener noreferrer" className="underline">Newest source: {day(vc.newest.date)}</a>}
        <span>{vc.status.replace(/_/g, ' ')}{vc.lastContactDate ? ` · last contact ${day(vc.lastContactDate, true)}${vc.daysSinceContact !== null ? ` (${vc.daysSinceContact} day${vc.daysSinceContact === 1 ? '' : 's'} ago)` : ''}` : ''}</span>
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="font-medium text-neutral-700 hover:underline">
          {open ? 'Hide evidence ▴' : `Evidence (${vc.accepted.length}) ▾`}
        </button>
      </div>

      <QuickActions vc={vc} />

      {open && (
        <div className="mt-3 space-y-3 border-t border-neutral-100 pt-3">
          {vc.hook && (
            <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-emerald-900">Suggested opener — edit before sending</span>
                <CopyHook text={vc.hook.text} />
              </div>
              <p className="mt-1 text-sm text-emerald-950">{vc.hook.text}</p>
            </div>
          )}
          {!vc.hook && vc.whyFit && (
            <div className="rounded border border-sky-200 bg-sky-50 px-3 py-2">
              <span className="text-xs font-medium text-sky-900">No recent public hook: talking point from verified research</span>
              <p className="mt-1 text-sm text-sky-950">{vc.whyFit}</p>
            </div>
          )}
          {vc.accepted.length > 0 ? (
            <ul>{vc.accepted.map((s) => <SignalLine key={s.id} s={s} />)}</ul>
          ) : <p className="text-sm text-neutral-500">No accepted signals.</p>}
          {vc.others.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-xs text-neutral-600">Rejected and undated items ({vc.others.length})</summary>
              <ul className="mt-1 space-y-1">
                {vc.others.map((s) => (
                  <li key={s.id} className="text-xs text-neutral-600">
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-neutral-300">{s.title}</a>
                    <span className="ml-1 text-neutral-500">— {s.status === 'accepted' ? 'date unknown, not scored' : (REASON_LABEL[s.rejectReason ?? ''] ?? s.rejectReason ?? s.status)}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
          <EditForm vc={vc} />
        </div>
      )}
    </article>
  );
}
