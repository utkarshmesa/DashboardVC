'use client';
// One VC: who, why, how to reach them, one clear next action; the proof and drafts one click away (SPEC §11.2–11.6).
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SignalView, VcView } from '@/lib/dashboard';
import { day, LEVEL_LABEL, REASON_LABEL } from './format';
import { actionToneOf, Auto, Avatar, Badge, btn, FitMeter, I, inputCls, TONE } from './ui';

const STATUSES = [
  ['not_contacted', 'Not contacted'], ['awaiting_response', 'Awaiting response'], ['in_conversation', 'In conversation'], ['passed', 'Passed'],
] as const;

type Quick = 'emailed' | 'replied' | 'meeting' | 'passed' | 'snooze' | 'unsnooze' | 'dismiss_conflict' | 'restore_conflict';
type Channel = 'email' | 'form' | 'linkedin' | 'other';

function useQuick(vc: VcView) {
  const router = useRouter();
  const [busy, setBusy] = useState<Quick | null>(null);
  const [failed, setFailed] = useState(false);
  // Never leave a button on "Saving…": a network or server failure says so, and nothing is assumed saved.
  async function go(action: Quick, channel?: Channel): Promise<boolean> {
    setBusy(action); setFailed(false);
    let ok = false;
    try {
      const r = await fetch(`/api/vc/${vc.id}/quick`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, channel }) });
      ok = r.ok;
    } catch { ok = false; }
    setBusy(null);
    if (ok) router.refresh(); else setFailed(true);
    return ok;
  }
  return { busy, go, failed, clearFailed: () => setFailed(false) };
}

function CopyButton({ text, label, variant = 'secondary' }: { text: string; label: string; variant?: 'secondary' | 'ghost' }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  async function copy() {
    try { await navigator.clipboard.writeText(text); setState('copied'); } catch { setState('failed'); }
    setTimeout(() => setState('idle'), 1800);
  }
  return (
    <button type="button" className={btn(variant)} onClick={copy} aria-live="polite">
      {state === 'copied' ? <><I.check width={14} height={14} />Copied</> : state === 'failed' ? 'Copy blocked: select the text in Details' : <><I.copy width={14} height={14} />{label}</>}
    </button>
  );
}

function Thumbs({ s }: { s: SignalView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function vote(v: 'up' | 'down') {
    setBusy(true); setFailed(false);
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signal_id: s.id, verdict: s.verdict === v ? null : v }) });
      if (!r.ok) throw new Error(String(r.status));
      router.refresh();
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  const b = (v: 'up' | 'down', label: string) => {
    const on = s.verdict === v;
    const Icon = v === 'up' ? I.thumbUp : I.thumbDown;
    return (
      <button type="button" disabled={busy} onClick={() => vote(v)} aria-label={label} aria-pressed={on} title={label}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors disabled:opacity-50 ${on ? (v === 'up' ? 'bg-accent-soft text-accent-text' : 'bg-danger-soft text-danger') : 'text-ink-3 hover:bg-surface-2 hover:text-ink'}`}>
        <Icon width={15} height={15} />
      </button>
    );
  };
  return (
    <span className="inline-flex items-center gap-0.5">
      {failed && <span role="alert" className="mr-1 text-[11.5px] text-danger">Not saved</span>}
      {b('up', 'Useful signal')}{b('down', 'Wrong or useless signal (removes it from scoring)')}
    </span>
  );
}

function EditForm({ vc }: { vc: VcView }) {
  const router = useRouter();
  const [status, setStatus] = useState(vc.status);
  const [date, setDate] = useState(vc.lastContactDate ?? '');
  const [notes, setNotes] = useState(vc.notes ?? '');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const dirty = <T,>(set: (v: T) => void) => (v: T) => { set(v); setState('idle'); };
  const changed = status !== vc.status || date !== (vc.lastContactDate ?? '') || notes !== (vc.notes ?? '');
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState('saving');
    try {
      const r = await fetch(`/api/vc/${vc.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, last_contact_date: date || null, notes: notes || null }) });
      setState(r.ok ? 'saved' : 'error');
      if (r.ok) router.refresh();
    } catch { setState('error'); } // offline: say so instead of hanging on "Saving…"
  }
  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-[180px_160px_1fr]">
      <label className="text-[12.5px] font-medium text-ink-2">Status
        <select value={status} onChange={(e) => dirty(setStatus)(e.target.value as VcView['status'])} className={`${inputCls} mt-1`}>
          {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label className="text-[12.5px] font-medium text-ink-2">Last contact
        <input type="date" value={date} onChange={(e) => dirty(setDate)(e.target.value)} className={`${inputCls} mt-1`} />
      </label>
      <label className="text-[12.5px] font-medium text-ink-2">Notes
        <input value={notes} onChange={(e) => dirty(setNotes)(e.target.value)} maxLength={4000} placeholder="Anything worth remembering" className={`${inputCls} mt-1`} />
      </label>
      <div className="flex items-center gap-3 sm:col-span-3">
        <button type="submit" disabled={state === 'saving' || !changed} className={btn('primary')}>{state === 'saving' ? 'Saving…' : 'Save'}</button>
        {state === 'saved' && <span className="inline-flex items-center gap-1 text-[12.5px] text-accent-text"><I.check width={14} height={14} />Saved</span>}
        {state === 'idle' && changed && <span className="text-[12.5px] text-warn">Unsaved changes</span>}
        {state === 'error' && <span className="text-[12.5px] text-danger">Couldn&apos;t save. Try again.</span>}
      </div>
    </form>
  );
}

const ROUTE_ICON = { form: I.form, linkedin: I.linkedin, email: I.mail, contact: I.globe, unknown: I.route } as const;

function Actions({ vc, onDetails, open }: { vc: VcView; onDetails: () => void; open: boolean }) {
  const { busy, go, failed, clearFailed } = useQuick(vc);
  const [confirm, setConfirm] = useState<Channel | null>(null);
  const [more, setMore] = useState(false);
  const menuRef = useRef<HTMLSpanElement>(null);
  // The overflow menu closes on Escape or a click outside it.
  useEffect(() => {
    if (!more) return;
    const onDown = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMore(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMore(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [more]);
  const canSend = !!vc.draft && (vc.status === 'not_contacted' || vc.status === 'awaiting_response');
  const fresh = vc.status === 'not_contacted';
  const defaultChannel: Channel = fresh && vc.route.kind === 'form' ? 'form' : fresh && vc.route.kind === 'linkedin' ? 'linkedin' : 'email';
  const link = (href: string, label: string, channel: Channel, variant: 'primary' | 'secondary' | 'ghost', Icon = I.external) => (
    <a key={label} href={href} target="_blank" rel="noopener noreferrer" onClick={() => { setMore(false); setConfirm(channel); }} className={btn(variant)}>
      <Icon width={14} height={14} />{label}
    </a>
  );
  const quick = (action: Quick, label: string, variant: 'secondary' | 'ghost' | 'danger' = 'secondary', channel?: Channel) => (
    <button key={action + label} type="button" disabled={!!busy} onClick={() => { setMore(false); go(action, channel); }} className={btn(variant)}>
      {busy === action ? 'Saving…' : label}
    </button>
  );

  const primary: React.ReactNode[] = [], secondary: React.ReactNode[] = [], overflow: React.ReactNode[] = [];
  if (canSend && fresh && vc.route.kind === 'form') {
    primary.push(link((vc.route.url ?? vc.route.findUrl)!, vc.route.label, 'form', 'primary', I.form));
    if (vc.formAnswers) secondary.push(<CopyButton key="answers" text={vc.formAnswers} label="Copy form answers" />);
    if (vc.gmailUrl) overflow.push(link(vc.gmailUrl, 'Open in Gmail instead', 'email', 'ghost', I.mail));
  } else if (canSend && fresh && vc.route.kind === 'linkedin' && vc.route.url) {
    primary.push(link(vc.route.url, vc.route.label, 'linkedin', 'primary', I.linkedin));
    secondary.push(<CopyButton key="msg" text={vc.draft!.body} label="Copy message" />);
    if (vc.gmailUrl) overflow.push(link(vc.gmailUrl, 'Open in Gmail instead', 'email', 'ghost', I.mail));
  } else if (canSend && vc.gmailUrl) {
    primary.push(link(vc.gmailUrl, vc.status === 'awaiting_response' ? 'Open nudge in Gmail' : 'Open in Gmail', 'email', 'primary', I.mail));
    if (fresh && vc.route.kind === 'contact' && (vc.route.url || vc.route.findUrl)) secondary.push(link((vc.route.url ?? vc.route.findUrl)!, vc.route.label, 'other', 'secondary', I.globe));
    if (fresh && vc.route.kind === 'email' && vc.route.findUrl) secondary.push(<a key="find" href={vc.route.findUrl} target="_blank" rel="noopener noreferrer" className={btn('secondary')}><I.external width={14} height={14} />Find their email</a>);
  }
  if (vc.draft) secondary.push(<CopyButton key="draft" text={`Subject: ${vc.draft.subject}\n\n${vc.draft.body}`} label="Copy draft" variant={primary.length ? 'ghost' : 'secondary'} />);

  if (vc.status !== 'passed') {
    if (fresh) secondary.push(quick('emailed', 'Mark as sent', 'ghost', defaultChannel));
    if (vc.status === 'awaiting_response') { secondary.push(quick('replied', 'They replied')); overflow.push(quick('emailed', 'Nudged today', 'ghost', 'email')); }
    if (vc.status === 'in_conversation') secondary.push(quick('meeting', 'Meeting booked'));
    if (vc.status === 'awaiting_response') overflow.push(quick('meeting', 'Meeting booked', 'ghost'));
    overflow.push(vc.snoozedUntil ? quick('unsnooze', 'Unsnooze', 'ghost') : quick('snooze', 'Snooze 2 weeks', 'ghost'));
    overflow.push(quick('passed', 'Mark as passed', 'ghost'));
  }
  if (vc.conflict && !vc.conflict.dismissed) secondary.unshift(quick('dismiss_conflict', 'Not a conflict', 'danger')); // the first decision on a conflict card
  if (vc.conflict?.dismissed) overflow.push(quick('restore_conflict', 'Restore conflict flag', 'ghost'));

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
      {primary}{secondary}
      {overflow.length > 0 && (
        <span className="relative" ref={menuRef}>
          <button type="button" aria-expanded={more} aria-label="More actions" onClick={() => setMore((m) => !m)} className={btn('quiet')}><I.more width={16} height={16} /></button>
          {more && (
            <span data-menu="" className="fade-in absolute left-0 top-9 z-30 flex min-w-48 flex-col items-stretch gap-0.5 rounded-xl bg-surface p-1.5 shadow-lift ring-1 ring-line [&>*]:justify-start">
              {overflow}
            </span>
          )}
        </span>
      )}
      <button type="button" onClick={onDetails} aria-expanded={open} className={`${btn('quiet')} ml-auto`}>
        {open ? 'Hide details' : 'Details'}<I.chevron width={14} height={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {failed && (
        <div role="alert" className="fade-in flex w-full items-center gap-2 rounded-xl bg-danger-soft px-3 py-2 text-[13px] text-danger">
          <I.alert width={15} height={15} />Couldn&apos;t save that. Check your connection and try again; nothing was changed.
          <button type="button" onClick={clearFailed} className="ml-auto underline">Dismiss</button>
        </div>
      )}
      {confirm && (
        <div className="fade-in flex w-full flex-wrap items-center gap-2 rounded-xl bg-warn-soft px-3 py-2 text-[13px] text-warn" role="status">
          <I.check width={15} height={15} />
          <span className="font-medium">Sent it?</span>
          <span className="text-ink-2">Logging it starts the follow-up timer.</span>
          <span className="ml-auto flex gap-2">
            <button type="button" disabled={!!busy} onClick={async () => { if (await go('emailed', confirm)) setConfirm(null); }} className={btn('primary')}>
              {vc.status === 'awaiting_response' ? 'Yes, log the nudge' : 'Yes, log as sent'}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className={btn('ghost')}>Not yet</button>
          </span>
        </div>
      )}
    </div>
  );
}

function SignalLine({ s }: { s: SignalView }) {
  return (
    <li className="flex gap-3 border-t border-line py-3 first:border-t-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
          <Badge tone={s.type === 'investment' ? 'accent' : s.type === 'speaking' || s.type === 'authored' ? 'info' : 'neutral'} className="capitalize">{s.type ?? '—'}</Badge>
          <span>{s.date ? day(s.date) : s.dateApprox ? 'date approx' : 'date unknown'}</span>
          {s.sourceName && <span>· {s.sourceName}</span>}
          {s.contribution !== null && <span className="font-mono tabular-nums text-ink-2" title="Points this signal adds to the activity score">+{s.contribution} pts</span>}
        </div>
        <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 block text-[14px] leading-snug text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink">{s.title}</a>
        <p className="mt-1 text-[11.5px] text-ink-3">
          AI labels: {s.aboutThisVc ? 'about this VC' : 'not about this VC'} · {s.subject ?? '—'} · relevance {LEVEL_LABEL[s.relevanceLevel ?? ''] ?? '—'} · confidence {s.confidence ?? '—'}
          {s.competitor && <span className="text-danger"> · possible competitor</span>}
          {s.roleHint && <span className="text-violet"> · role: {s.roleHint}</span>}
          {s.verdict === 'down' && <span className="text-danger"> · excluded by your thumbs-down</span>}
        </p>
      </div>
      <Thumbs s={s} />
    </li>
  );
}

type Other = { id: number; title: string; url: string; status: string; rejectReason: string | null };
// Rejected and undated items load only when opened, keeping them out of every page load.
function OtherItems({ vcId, count }: { vcId: string; count: number }) {
  const [items, setItems] = useState<Other[] | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  async function load() {
    if (items || state === 'loading') return;
    setState('loading');
    try {
      const r = await fetch(`/api/vc/${vcId}/others`);
      if (!r.ok) throw new Error(String(r.status));
      setItems(((await r.json()) as { items: Other[] }).items); setState('idle');
    } catch { setState('error'); }
  }
  return (
    <details className="mt-3 rounded-xl bg-surface px-4 py-2.5 ring-1 ring-line" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) load(); }}>
      <summary className="flex cursor-pointer items-center gap-1.5 text-[13px] font-medium text-ink-2"><I.chevron width={14} height={14} />Rejected and undated items ({count})</summary>
      {state === 'loading' && <p className="py-2 text-[12.5px] text-ink-3">Loading…</p>}
      {state === 'error' && <p role="alert" className="py-2 text-[12.5px] text-danger">Couldn&apos;t load these. <button type="button" onClick={load} className="underline">Retry</button></p>}
      {items && (
        <ul className="mt-2 space-y-1.5 pb-1">
          {items.map((s) => (
            <li key={s.id} className="text-[12.5px] text-ink-3">
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-ink-2 underline decoration-line-2 underline-offset-2">{s.title}</a>
              <span> — {s.status === 'accepted' ? 'date unknown, not scored' : (REASON_LABEL[s.rejectReason ?? ''] ?? s.rejectReason ?? s.status)}</span>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}

function TextBlock({ title, text, tone = 'neutral', copy, auto }: { title: string; text: string; tone?: 'accent' | 'info' | 'neutral'; copy?: boolean; auto?: boolean }) {
  return (
    <div className={`rounded-xl p-4 ${tone === 'neutral' ? 'bg-surface-2 ring-1 ring-line' : TONE[tone].soft}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`text-[12px] font-semibold uppercase tracking-wider ${tone === 'neutral' ? 'text-ink-3' : TONE[tone].text}`}>{title}{auto && <Auto />}</span>
        {copy && <CopyButton text={text} label="Copy" variant="ghost" />}
      </div>
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}

function Details({ vc }: { vc: VcView }) {
  const hasDraft = !!(vc.draft || vc.hook || vc.opener || vc.formAnswers);
  const [tab, setTab] = useState<'draft' | 'evidence' | 'notes'>(hasDraft ? 'draft' : 'evidence');
  const tabs = [
    ...(hasDraft ? [['draft', 'Draft & opener'] as const] : []),
    ['evidence', `Evidence (${vc.accepted.length})`] as const,
    ['notes', 'Notes & status'] as const,
  ];
  const conflictCard = vc.action.startsWith('Check conflict');
  return (
    <div className="rounded-b-2xl border-t border-line bg-surface-2/60 px-5 pb-5 pt-3">
      <div role="tablist" aria-label={`${vc.name} details`} className="mb-4 flex gap-1 overflow-x-auto"
        onKeyDown={(e) => {
          // WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends.
          const keys = tabs.map(([k]) => k), i = keys.indexOf(tab);
          const next = e.key === 'ArrowRight' ? keys[(i + 1) % keys.length] : e.key === 'ArrowLeft' ? keys[(i - 1 + keys.length) % keys.length] : e.key === 'Home' ? keys[0] : e.key === 'End' ? keys[keys.length - 1] : null;
          if (!next) return;
          e.preventDefault(); setTab(next);
          (e.currentTarget.querySelector(`[data-tab="${next}"]`) as HTMLElement | null)?.focus();
        }}>
        {tabs.map(([k, label]) => (
          <button key={k} role="tab" data-tab={k} id={`tab-${vc.id}-${k}`} aria-controls={`panel-${vc.id}`} tabIndex={tab === k ? 0 : -1} aria-selected={tab === k} type="button" onClick={() => setTab(k)}
            className={`rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${tab === k ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-3 hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {tab === 'draft' && (
        <div role="tabpanel" id={`panel-${vc.id}`} aria-labelledby={`tab-${vc.id}-draft`} className="grid gap-3">
          {/* Same order as the draft: the research opener leads; a news hook is the alternative. */}
          {vc.opener && !conflictCard && <TextBlock title="Opener used in the draft · from verified research" text={vc.opener} tone="accent" copy auto />}
          {vc.hook && <TextBlock title={`Suggested opener — edit before sending${vc.opener ? ' · from recent news' : ''}`} text={vc.hook.text} tone={vc.opener ? 'info' : 'accent'} copy auto />}
          {!vc.hook && !vc.opener && vc.whyFit && !conflictCard && <TextBlock title="Talking point from verified research" text={vc.whyFit} tone="info" />}
          {vc.draft && <TextBlock title="Email draft — edit before sending" text={`Subject: ${vc.draft.subject}\n\n${vc.draft.body}`} copy />}
          {vc.formAnswers && <TextBlock title="Pitch-form answers" text={vc.formAnswers} copy />}
        </div>
      )}

      {tab === 'evidence' && (
        <div role="tabpanel" id={`panel-${vc.id}`} aria-labelledby={`tab-${vc.id}-evidence`}>
          {vc.accepted.length ? <ul className="rounded-xl bg-surface px-4 ring-1 ring-line">{vc.accepted.map((s) => <SignalLine key={s.id} s={s} />)}</ul>
            : <p className="rounded-xl bg-surface px-4 py-6 text-center text-[13.5px] text-ink-3 ring-1 ring-line">No public activity accepted in the last 30 days. The research above is the case for reaching out.</p>}
          {vc.othersCount > 0 && <OtherItems vcId={vc.id} count={vc.othersCount} />}
        </div>
      )}

      {tab === 'notes' && (
        <div role="tabpanel" id={`panel-${vc.id}`} aria-labelledby={`tab-${vc.id}-notes`} className="grid gap-4">
          <EditForm vc={vc} />
          <dl className="grid gap-x-6 gap-y-2 rounded-xl bg-surface p-4 text-[13px] ring-1 ring-line sm:grid-cols-[140px_1fr]">
            {vc.approach && <><dt className="text-ink-3">How to reach</dt><dd className="text-ink-2">{vc.approach.text}</dd></>}
            {vc.conflict && <><dt className="text-ink-3">Research conflict</dt><dd className="text-danger">“{vc.conflict.evidence}” (applies to the whole firm){vc.conflict.dismissed && ' — dismissed by you'}</dd></>}
            <dt className="text-ink-3">Activity score</dt><dd className="text-ink-2"><span className="font-mono">{vc.score ?? 0}</span>/100 <Auto /> · how strong this VC&apos;s public activity was in the last 30 days</dd>
            {vc.trust && <><dt className="text-ink-3">Research trust</dt><dd className="text-ink-2">{vc.trust}</dd></>}
            <dt className="text-ink-3">Recommended action</dt><dd className="text-ink-2">{vc.action} <Auto /></dd>
          </dl>
        </div>
      )}
    </div>
  );
}

function Meta({ vc }: { vc: VcView }) {
  const RouteIcon = ROUTE_ICON[vc.route.kind];
  const routeText = { form: 'Application form', linkedin: 'LinkedIn', email: 'Email', contact: 'Contact page', unknown: 'Route not verified' }[vc.route.kind];
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2">
      <span className="inline-flex items-center gap-1.5" title={vc.approach?.text}><RouteIcon width={14} height={14} className="text-ink-3" />{routeText}</span>
      {vc.cheque && <span title="First cheque"><span className="text-ink-3">Cheque</span> {vc.cheque}</span>}
      {vc.stage && <span title="Stage focus"><span className="text-ink-3">Stage</span> {vc.stage}</span>}
      <span className="inline-flex items-center gap-1.5 text-ink-3">
        <I.clock width={13} height={13} />
        {vc.status === 'not_contacted' ? 'Not contacted yet' : `${vc.status.replace(/_/g, ' ')}${vc.lastContactDate ? ` · last contact ${day(vc.lastContactDate)}${vc.daysSinceContact !== null ? ` (${vc.daysSinceContact}d ago)` : ''}` : ''}`}
      </span>
    </div>
  );
}

function FullCard({ vc, onCollapse, autoFocus }: { vc: VcView; onCollapse?: () => void; autoFocus?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }); }, [autoFocus]); // keep keyboard users in place after expanding a row
  const tone = actionToneOf(vc.action);
  const conflictCard = vc.action.startsWith('Check conflict');
  return (
    <article ref={ref} tabIndex={autoFocus ? -1 : undefined} aria-label={`${vc.name}, ${vc.firm}`} id={`vc-${vc.id}`} className={`group fade-in relative scroll-mt-28 rounded-2xl bg-surface has-[[data-menu]]:z-30 shadow-card ring-1 transition-shadow duration-200 hover:shadow-lift ${conflictCard ? 'ring-danger/25' : 'ring-line'}`}>
      <div className="p-5">
        <div className="flex gap-4">
          <Avatar name={vc.name} fit={vc.fit.label} size={44} />
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-1.5">
              <Badge tone={tone} title="Recommended by the pipeline from fit, activity and your status"><span className={`h-1.5 w-1.5 rounded-full ${TONE[tone].dot}`} />{vc.action}</Badge>
              {vc.badges.map((b) => <Badge key={b} tone="violet">{b}</Badge>)}
              {vc.linkedin && (
                <a href={vc.linkedin.latestUrl} target="_blank" rel="noopener noreferrer" title="Posts found through search results in the last 30 days (can under-count, never over-count)"
                  className="inline-flex min-h-6 items-center gap-1 rounded-full bg-info-soft px-2 py-1 text-[11.5px] font-medium text-info hover:underline">
                  <I.linkedin width={12} height={12} />
                  Active: {[vc.linkedin.own && `${vc.linkedin.own} own post${vc.linkedin.own === 1 ? '' : 's'}`, vc.linkedin.firm && `${vc.linkedin.firm} by firm`].filter(Boolean).join(', ')}
                </a>
              )}
            </div>
            <h3 className="text-[18px] font-semibold leading-tight tracking-tight text-ink">
              {vc.name} <span className="font-normal text-ink-3">· {vc.firm}</span>
            </h3>
          </div>
          <div className="flex flex-col items-center gap-1">
            <FitMeter score={vc.fit.score} label={vc.fit.label} title={`Fit ${vc.fit.score}/100: ${vc.fit.reasons.join('; ')}`} />
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-3">{vc.fit.label} fit</span>
            {onCollapse && <button type="button" onClick={onCollapse} className="mt-1 inline-flex min-h-6 items-center px-1 text-[11.5px] text-ink-3 underline">Collapse</button>}
          </div>
        </div>
        {vc.whyFit && <p className="mt-2 text-[14px] leading-relaxed text-ink-2 sm:pl-[60px]">{vc.whyFit}</p>}
        {conflictCard && vc.conflict && !vc.conflict.dismissed && (
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger sm:ml-[60px]"><I.alert width={15} height={15} className="mt-0.5 shrink-0" />Research: “{vc.conflict.evidence}”. Applies to the whole firm; check before pitching.</p>
        )}

        <div className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3 py-2.5 text-[13.5px] ring-1 ring-line">
          <I.sparkle width={14} height={14} className="mt-0.5 shrink-0 text-ink-3" />
          <p className="min-w-0 flex-1 text-ink-2">
            {vc.summary ?? 'No public activity found in the last 30 days.'}<Auto />
            {vc.newest && <> · <a href={vc.newest.url} target="_blank" rel="noopener noreferrer" className="text-ink-3 underline decoration-line-2 underline-offset-2 hover:text-ink">source {day(vc.newest.date)}</a></>}
          </p>
          <span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-ink-3 sm:inline" title="Activity score (0–100): how strong this VC's public activity is in the last 30 days">activity {vc.score ?? 0}</span>
        </div>

        <Meta vc={vc} />
        {vc.fit.flags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">{vc.fit.flags.map((f) => <Badge key={f} tone="warn"><I.alert width={12} height={12} />{f}</Badge>)}</div>
        )}
      </div>
      <Actions vc={vc} open={open} onDetails={() => setOpen((o) => !o)} />
      <div className="reveal" data-open={open}>
        <div>{open && <Details vc={vc} />}</div>
      </div>
    </article>
  );
}

// Compact row for the rest of the pipeline; expands into the full card.
function CompactRow({ vc }: { vc: VcView }) {
  const [open, setOpen] = useState(false);
  if (open) return <FullCard vc={vc} onCollapse={() => setOpen(false)} autoFocus />;
  const tone = actionToneOf(vc.action);
  return (
    <button type="button" id={`vc-${vc.id}`} onClick={() => setOpen(true)} aria-expanded={false}
      className="group flex w-full scroll-mt-28 items-center gap-3 rounded-xl bg-surface px-4 py-3 text-left ring-1 ring-line transition-all hover:shadow-card hover:ring-line-2">
      <Avatar name={vc.name} fit={vc.fit.label} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium text-ink">{vc.name} <span className="font-normal text-ink-3">· {vc.firm}</span></span>
        <span className={`block truncate text-[12.5px] ${TONE[tone].text}`}>{vc.action}</span>
      </span>
      <span className="hidden font-mono text-[12px] tabular-nums text-ink-3 sm:inline" title="Fit score">fit {vc.fit.score}</span>
      <I.chevron width={16} height={16} className="text-ink-3 transition-transform group-hover:translate-y-0.5" />
    </button>
  );
}

export default function VcCard({ vc, compact = false }: { vc: VcView; compact?: boolean }) {
  return compact ? <CompactRow vc={vc} /> : <FullCard vc={vc} />;
}
