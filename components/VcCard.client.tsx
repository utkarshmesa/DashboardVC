'use client';
// One VC: who, why, how to reach them, one clear next action; the proof and drafts one click away (SPEC §11.2–11.6).
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SignalView, VcView } from '@/lib/dashboard';
import { day, LEVEL_LABEL, REASON_LABEL } from './format';
import { gsap } from 'gsap';
import { burst, reducedMotion } from './motion';
import { actionToneOf, Auto, Badge, btn, FitMeter, I, inputCls, TONE } from './ui';

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

function Thumbs({ s, canEdit }: { s: SignalView; canEdit: boolean }) {
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
        className={`inline-flex h-7 w-7 items-center justify-center transition-colors disabled:opacity-50 ${on ? (v === 'up' ? 'bg-accent-soft text-accent-text' : 'bg-danger-soft text-danger') : 'text-ink-3 hover:bg-surface-2 hover:text-ink'}`}>
        <Icon width={15} height={15} />
      </button>
    );
  };
  if (!canEdit) return s.verdict ? <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">{s.verdict === 'up' ? 'Marked useful' : 'Marked wrong'}</span> : null;
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

function Actions({ vc, canEdit, onDetails, open }: { vc: VcView; canEdit: boolean; onDetails: () => void; open: boolean }) {
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
    <a key={label} href={href} target="_blank" rel="noopener noreferrer" onClick={() => { setMore(false); if (canEdit) setConfirm(channel); }} className={btn(variant)}>
      <Icon width={14} height={14} />{label}
    </a>
  );
  const quick = (action: Quick, label: string, variant: 'secondary' | 'ghost' | 'danger' = 'secondary', channel?: Channel) => (
    <button key={action + label} type="button" disabled={!!busy} onClick={(e) => { const t = e.currentTarget; setMore(false); go(action, channel).then((ok) => { if (ok && ['emailed', 'replied', 'meeting'].includes(action)) burst(t); }); }} className={btn(variant)}>
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

  if (canEdit && vc.status !== 'passed') {
    if (fresh) secondary.push(quick('emailed', 'Mark as sent', 'ghost', defaultChannel));
    if (vc.status === 'awaiting_response') { secondary.push(quick('replied', 'They replied')); overflow.push(quick('emailed', 'Nudged today', 'ghost', 'email')); }
    if (vc.status === 'in_conversation') secondary.push(quick('meeting', 'Meeting booked'));
    if (vc.status === 'awaiting_response') overflow.push(quick('meeting', 'Meeting booked', 'ghost'));
    overflow.push(vc.snoozedUntil ? quick('unsnooze', 'Unsnooze', 'ghost') : quick('snooze', 'Snooze 2 weeks', 'ghost'));
    overflow.push(quick('passed', 'Mark as passed', 'ghost'));
  }
  if (canEdit && vc.conflict && !vc.conflict.dismissed) secondary.unshift(quick('dismiss_conflict', 'Not a conflict', 'danger')); // the first decision on a conflict card
  if (canEdit && vc.conflict?.dismissed) overflow.push(quick('restore_conflict', 'Restore conflict flag', 'ghost'));

  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line bg-paper/40 px-5 py-3 sm:pl-[100px] sm:pr-6">
      {primary}{secondary}
      {overflow.length > 0 && (
        <span className="relative" ref={menuRef}>
          <button type="button" aria-expanded={more} aria-label="More actions" onClick={() => setMore((m) => !m)} className={btn('quiet')}><I.more width={16} height={16} /></button>
          {more && (
            <span data-menu="" className="fade-in absolute left-0 top-9 z-30 flex min-w-48 flex-col items-stretch gap-0.5 border border-line-2 bg-surface-2 p-1 [&>*]:justify-start">
              {overflow}
            </span>
          )}
        </span>
      )}
      {!canEdit && <span className="ml-auto hidden font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3 lg:inline" title="Sign in as the owner to log outreach">View only</span>}
      <button type="button" onClick={onDetails} aria-expanded={open} className={`${btn('quiet')} ${canEdit ? 'ml-auto' : ''} font-mono text-[11px] uppercase tracking-[0.12em]`}>
        {open ? 'Close' : 'Details'}<I.chevron width={14} height={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {failed && (
        <div role="alert" className="fade-in flex w-full items-center gap-2 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
          <I.alert width={15} height={15} />Couldn&apos;t save that. Check your connection and try again; nothing was changed.
          <button type="button" onClick={clearFailed} className="ml-auto underline">Dismiss</button>
        </div>
      )}
      {confirm && (
        <div className="fade-in flex w-full flex-wrap items-center gap-2 border-l-2 border-signal bg-signal-soft px-3 py-2 text-[13px] text-signal" role="status">
          <I.check width={15} height={15} />
          <span className="font-medium">Sent it?</span>
          <span className="text-ink-2">Logging it starts the follow-up timer.</span>
          <span className="ml-auto flex gap-2">
            <button type="button" disabled={!!busy} onClick={async (e) => { const t = e.currentTarget; if (await go('emailed', confirm)) { burst(t); setConfirm(null); } }} className={btn('primary')}>
              {vc.status === 'awaiting_response' ? 'Yes, log the nudge' : 'Yes, log as sent'}
            </button>
            <button type="button" onClick={() => setConfirm(null)} className={btn('ghost')}>Not yet</button>
          </span>
        </div>
      )}
    </div>
  );
}

function SignalLine({ s, canEdit }: { s: SignalView; canEdit: boolean }) {
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
      <Thumbs s={s} canEdit={canEdit} />
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
    <details className="mt-3 bg-surface px-4 py-2.5 border border-line" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) load(); }}>
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
    <div className={`p-4 ${tone === 'neutral' ? 'bg-surface border border-line' : `border-l-2 ${TONE[tone].soft} ${tone === 'accent' ? 'border-accent-text' : 'border-info'}`}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className={`font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] ${tone === 'neutral' ? 'text-ink-3' : TONE[tone].text}`}>{title}{auto && <Auto />}</span>
        {copy && <CopyButton text={text} label="Copy" variant="ghost" />}
      </div>
      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{text}</p>
    </div>
  );
}

// Investor brief, ordered the way Vikram decides: can they write the cheque, have they backed companies like his,
// who is the person, and what to avoid saying. Every line is from verified research or a sourced deal (no AI text).
function Profile({ vc }: { vc: VcView }) {
  const b = vc.brief;
  const row = (label: string, value: React.ReactNode) => (
    <div className="grid gap-0.5 sm:grid-cols-[150px_1fr] sm:gap-4">
      <dt className="text-[12.5px] text-ink-3">{label}</dt><dd className="text-[13.5px] leading-relaxed text-ink">{value}</dd>
    </div>
  );
  const box = 'bg-surface p-4 border border-line';
  const head = 'mb-3 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3';
  return (
    <div role="tabpanel" id={`panel-${vc.id}`} aria-labelledby={`tab-${vc.id}-profile`} className="grid gap-3">
      <section className={box} aria-label={`${vc.name}: cheque and fund`}>
        <h4 className={head}>Can they write your cheque?</h4>
        <dl className="grid gap-2.5">
          {row('First cheque', b.cheque ?? <span className="text-ink-3">Not public</span>)}
          {b.chequeNote && row('Against your round', <Badge tone="warn"><I.alert width={12} height={12} />{b.chequeNote}</Badge>)}
          {row('Stage focus', b.stage ?? <span className="text-ink-3">Not public</span>)}
          {row('Fund', b.fund ? <>{b.fundStatus && <Badge tone={b.fundStatus.tone} className="mr-1.5">{b.fundStatus.label}</Badge>}{b.fund}</> : <span className="text-ink-3">No verified fund note</span>)}
        </dl>
      </section>

      <section className={box} aria-label={`${vc.name}: track record`}>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h4 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3">Have they backed companies like yours?</h4>
          <span className="text-[12px] text-ink-3">
            {b.dealCount ? `${b.dealCount} deal${b.dealCount === 1 ? '' : 's'} found · ${b.inSpaceCount} in your space` : 'No deals found in the research'}
            {b.latestRelevant && ` · latest relevant ${b.latestRelevant}`}
          </span>
        </div>
        {b.deals.length > 0 ? (
          <ul className="grid gap-2">
            {b.deals.map((d) => (
              <li key={d.label} className="flex items-start gap-2 text-[13.5px]">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${d.competitor ? 'bg-danger' : d.inSpace ? 'bg-accent-text' : 'bg-line-2'}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-ink underline decoration-line-2 underline-offset-2 hover:decoration-ink">{d.label}</a> : <span className="text-ink">{d.label}</span>}
                  <span className="ml-1.5 inline-flex flex-wrap gap-1 align-middle">
                    {d.competitor ? <Badge tone="danger" title="Names a known competitor or your own product category">possible competitor</Badge> : d.inSpace && <Badge tone="accent">in your space</Badge>}
                    {d.round && <Badge>{d.round}</Badge>}
                    {d.year && <Badge>{d.year}</Badge>}
                    {d.verified && <Badge tone="info" title="A structured, verified deal or a dated news/LinkedIn signal naming the company">verified</Badge>}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="text-[13px] text-ink-3">The research has no deal articles for this investor. Use the why-fit and the firm&apos;s portfolio page.</p>}
        {b.dealCount > b.deals.length && <p className="mt-2 text-[12px] text-ink-3">+{b.dealCount - b.deals.length} more in the research sources.</p>}
        <p className="mt-3 text-[11.5px] text-ink-3">Headlines come from the source articles; amounts are left out because they can&apos;t be read reliably from links.</p>
      </section>

      <section className={box} aria-label={`${vc.name}: who they are`}>
        <h4 className={head}>Who they are</h4>
        <dl className="grid gap-2.5">
          {row('Role', <>{b.title ?? <span className="text-ink-3">Not verified</span>}{b.titleVerified && <span className="text-ink-3"> · verified {b.titleVerified}</span>}</>)}
          {b.city && row('Based in', b.city)}
          {b.thesis && row('Thesis', <span className="italic text-ink-2">“{b.thesis}”</span>)}
          {b.approach && row('How they like to be approached', b.approach)}
          {b.linkedin && row('LinkedIn', <a href={b.linkedin} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-info underline underline-offset-2"><I.linkedin width={13} height={13} />Profile</a>)}
        </dl>
      </section>

      {b.caveats && (
        <section className="border-l-2 border-warn bg-warn-soft p-4" aria-label={`${vc.name}: before you write`}>
          <h4 className="mb-1.5 flex items-center gap-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-warn"><I.alert width={13} height={13} />Before you write</h4>
          <p className="text-[13.5px] leading-relaxed text-ink">{b.caveats}</p>
        </section>
      )}
      <p className="text-[11.5px] text-ink-3">From {b.sourceCount} research source{b.sourceCount === 1 ? '' : 's'}{b.trust ? ` · research trust ${b.trust}` : ''}. Nothing on this tab is written by AI.</p>
    </div>
  );
}

function Details({ vc, canEdit }: { vc: VcView; canEdit: boolean }) {
  const hasDraft = !!(vc.draft || vc.hook || vc.opener || vc.formAnswers);
  // Decide first, then draft: the profile opens first.
  const [tab, setTab] = useState<'profile' | 'draft' | 'evidence' | 'notes'>('profile');
  const panelRef = useRef<HTMLDivElement>(null);
  // Panel content slides in, staggered, on open and on every tab change.
  useEffect(() => {
    const panel = panelRef.current?.querySelector('[role=tabpanel]');
    if (!panel || reducedMotion()) return;
    // A context, reverted on cleanup: an interrupted animation (re-render, refresh) restores the content to visible
    // instead of freezing it at the hidden starting state.
    const ctx = gsap.context(() => {
      gsap.fromTo(panel.children, { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.45, stagger: 0.05, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
    });
    return () => ctx.revert();
  }, [tab]);
  const tabs = [
    ['profile', 'Profile'] as const,
    ...(hasDraft ? [['draft', 'Draft & opener'] as const] : []),
    ['evidence', `Evidence (${vc.accepted.length})`] as const,
    ['notes', 'Notes & status'] as const,
  ];
  const conflictCard = vc.action.startsWith('Check conflict');
  return (
    <div ref={panelRef} className="border-t border-line bg-paper/60 px-5 pb-6 pt-1 sm:pl-[100px] sm:pr-6">
      <div role="tablist" aria-label={`${vc.name} details`} className="mb-5 flex gap-1 overflow-x-auto border-b border-line"
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
            className={`relative whitespace-nowrap px-3 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] transition-colors ${tab === k ? 'text-ink after:absolute after:inset-x-3 after:bottom-[-1px] after:h-px after:bg-ink' : 'text-ink-3 hover:text-ink'}`}>{label}</button>
        ))}
      </div>

      {tab === 'profile' && <Profile vc={vc} />}

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
          {vc.accepted.length ? <ul className="bg-surface px-4 border border-line">{vc.accepted.map((s) => <SignalLine key={s.id} s={s} canEdit={canEdit} />)}</ul>
            : <p className="bg-surface px-4 py-6 text-center text-[13.5px] text-ink-3 border border-line">No public activity accepted in the last 30 days. The research above is the case for reaching out.</p>}
          {vc.othersCount > 0 && <OtherItems vcId={vc.id} count={vc.othersCount} />}
        </div>
      )}

      {tab === 'notes' && (
        <div role="tabpanel" id={`panel-${vc.id}`} aria-labelledby={`tab-${vc.id}-notes`} className="grid gap-4">
          {canEdit ? <EditForm vc={vc} /> : (
            <p className="flex items-center gap-2 border border-dashed border-line-2 px-4 py-3 text-[13px] text-ink-3"><I.lock width={13} height={13} />View-only link. <a href="/login" className="text-ink underline underline-offset-4">Sign in</a> as the owner to change status or notes.</p>
          )}
          <dl className="grid gap-x-6 gap-y-2 bg-surface p-4 text-[13px] border border-line sm:grid-cols-[140px_1fr]">
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
      {vc.brief.fundStatus && <Badge tone={vc.brief.fundStatus.tone} title={vc.brief.fund ?? undefined}>{vc.brief.fundStatus.label}</Badge>}
      {vc.brief.dealCount > 0 && <span title="Deals found in the research sources; see Details → Profile"><span className="text-ink-3">Deals</span> {vc.brief.dealCount}{vc.brief.inSpaceCount > 0 && <span className="text-accent-text"> · {vc.brief.inSpaceCount} in your space</span>}</span>}
      <span className="inline-flex items-center gap-1.5 text-ink-3">
        <I.clock width={13} height={13} />
        {vc.status === 'not_contacted' ? 'Not contacted yet' : `${vc.status.replace(/_/g, ' ')}${vc.lastContactDate ? ` · last contact ${day(vc.lastContactDate)}${vc.daysSinceContact !== null ? ` (${vc.daysSinceContact}d ago)` : ''}` : ''}`}
      </span>
    </div>
  );
}

// A dossier entry: index, who, one action, why they fit; the proof one click away.
function FullCard({ vc, index, canEdit, onCollapse, autoFocus }: { vc: VcView; index?: string; canEdit: boolean; onCollapse?: () => void; autoFocus?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => { if (autoFocus) ref.current?.focus({ preventScroll: true }); }, [autoFocus]); // keep keyboard users in place after expanding a row
  const tone = actionToneOf(vc.action);
  const conflictCard = vc.action.startsWith('Check conflict');
  return (
    <article ref={ref} data-card="" tabIndex={autoFocus ? -1 : undefined} aria-label={`${vc.name}, ${vc.firm}`} id={`vc-${vc.id}`}
      className={`row-hover group ${autoFocus ? 'fade-in ' : ''}relative scroll-mt-28 border bg-surface transition-colors has-[[data-menu]]:z-30 ${conflictCard ? 'border-danger/35' : 'border-line hover:border-line-2'}`}>
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-px ${TONE[tone].dot}`} />
      <div className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-[52px_minmax(0,1fr)_auto] sm:p-6">
        <span className="hidden pt-0.5 font-mono text-[12px] tabular-nums text-ink-3 sm:block" aria-hidden="true">{index ?? '—'}</span>
        <div className="min-w-0">
          <div className="mb-2.5 flex flex-wrap items-center gap-1.5">
            <Badge tone={tone} title="Recommended by the pipeline from fit, activity and your status">{vc.action}</Badge>
            {vc.badges.map((b) => <Badge key={b} tone="violet">{b}</Badge>)}
            {vc.linkedin && (
              <a href={vc.linkedin.latestUrl} target="_blank" rel="noopener noreferrer" title="Posts found through search results in the last 30 days (can under-count, never over-count)"
                className="inline-flex items-center gap-1.5 border border-info/35 px-1.5 py-[3px] font-mono text-[10.5px] uppercase leading-none tracking-[0.08em] text-info hover:bg-info-soft">
                <I.linkedin width={11} height={11} />
                {[vc.linkedin.own && `${vc.linkedin.own} post${vc.linkedin.own === 1 ? '' : 's'}`, vc.linkedin.firm && `${vc.linkedin.firm} by firm`].filter(Boolean).join(' · ')}
              </a>
            )}
          </div>
          <h3 className="text-[20px] font-medium leading-tight tracking-[-0.02em] text-ink">
            {vc.name} <span className="text-ink-3">/ {vc.firm}</span>
          </h3>
          {(vc.brief.title || vc.brief.city) && <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">{[vc.brief.title, vc.brief.city].filter(Boolean).join(' · ')}</p>}
          {vc.whyFit && <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-ink-2">{vc.whyFit}</p>}
        </div>
        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
          <FitMeter score={vc.fit.score} label={vc.fit.label} title={`Fit ${vc.fit.score}/100: ${vc.fit.reasons.join('; ')}`} />
          <span className="label">{vc.fit.label} fit</span>
          {onCollapse && <button type="button" onClick={onCollapse} className="ml-auto inline-flex min-h-6 items-center font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3 hover:text-ink sm:ml-0 sm:mt-1">Collapse ↑</button>}
        </div>

        <div className="grid gap-3 sm:col-start-2 sm:col-end-4">
          {vc.brief.competitorDeals.length > 0 && !conflictCard && (
            <p className="flex items-start gap-2 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger">
              <I.alert width={15} height={15} className="mt-0.5 shrink-0" />
              <span>A research source mentions a deal with a possible competitor: <strong className="font-semibold">{vc.brief.competitorDeals[0]}</strong>{vc.brief.competitorDeals.length > 1 && ` (+${vc.brief.competitorDeals.length - 1} more)`}. Open Details → Profile and check the source before pitching.</span>
            </p>
          )}
          {conflictCard && vc.conflict && !vc.conflict.dismissed && (
            <p className="flex items-start gap-2 border-l-2 border-danger bg-danger-soft px-3 py-2 text-[13px] text-danger"><I.alert width={15} height={15} className="mt-0.5 shrink-0" />Research: “{vc.conflict.evidence}”. Applies to the whole firm; check before pitching.</p>
          )}

          <div className="grid gap-2 border-t border-line pt-3 text-[13px] sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:gap-4">
            <span className="label pt-0.5">Last 30 days</span>
            <p className="min-w-0 text-ink-2">
              {vc.summary ?? 'No public activity found in the last 30 days.'}<Auto />
              {vc.newest && <> · <a href={vc.newest.url} target="_blank" rel="noopener noreferrer" className="text-ink-3 underline decoration-line-2 underline-offset-2 hover:text-ink">source {day(vc.newest.date)}</a></>}
            </p>
            <span className="hidden font-mono text-[11px] tabular-nums text-ink-3 sm:inline" title="Activity score (0–100): how strong this VC's public activity is in the last 30 days">ACT {String(vc.score ?? 0).padStart(2, '0')}</span>
          </div>

          <Meta vc={vc} />
          {vc.fit.flags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">{vc.fit.flags.map((f) => <Badge key={f} tone="warn"><I.alert width={11} height={11} />{f}</Badge>)}</div>
          )}
        </div>
      </div>
      <Actions vc={vc} canEdit={canEdit} open={open} onDetails={() => setOpen((o) => !o)} />
      <div className="reveal" data-open={open}>
        <div>{open && <Details vc={vc} canEdit={canEdit} />}</div>
      </div>
    </article>
  );
}

// Compact ledger row for the rest of the pipeline; expands into the full entry.
function CompactRow({ vc, index, canEdit }: { vc: VcView; index?: string; canEdit: boolean }) {
  const [open, setOpen] = useState(false);
  if (open) return <FullCard vc={vc} index={index} canEdit={canEdit} onCollapse={() => setOpen(false)} autoFocus />;
  const tone = actionToneOf(vc.action);
  return (
    <button type="button" data-card="" id={`vc-${vc.id}`} onClick={() => setOpen(true)} aria-expanded={false}
      className="row-hover group grid w-full scroll-mt-28 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface sm:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1fr)_auto_16px]">
      <span className="hidden font-mono text-[11px] tabular-nums text-ink-3 sm:block">{index}</span>
      <span className="min-w-0">
        <span className="block truncate text-[14px] text-ink">{vc.name} <span className="text-ink-3">/ {vc.firm}</span></span>
        <span className={`block truncate font-mono text-[10.5px] uppercase tracking-[0.08em] sm:hidden ${TONE[tone].text}`}>{vc.action}</span>
      </span>
      <span className={`hidden truncate font-mono text-[10.5px] uppercase tracking-[0.08em] sm:block ${TONE[tone].text}`}>{vc.action}</span>
      <FitMeter score={vc.fit.score} label={vc.fit.label} compact />
      <I.chevron width={14} height={14} className="hidden text-ink-3 transition-transform group-hover:translate-y-0.5 sm:block" />
    </button>
  );
}

export default function VcCard({ vc, compact = false, index, canEdit = false }: { vc: VcView; compact?: boolean; index?: string; canEdit?: boolean }) {
  return compact ? <CompactRow vc={vc} index={index} canEdit={canEdit} /> : <FullCard vc={vc} index={index} canEdit={canEdit} />;
}
