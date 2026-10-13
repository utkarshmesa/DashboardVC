'use client';
// One to-do for the week (Plan V2): what to do, with whom, why, one Done control. Opening it shows the full dossier
// (profile, draft, evidence, notes). Done logs the outreach event, so the task moves to "Done this week".
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { VcView } from '@/lib/dashboard';
import { isDemoNote } from '@/lib/demo-label';
import { burst } from './motion';
import { actionToneOf, Badge, btn, FitMeter, I, NameLinks, TONE } from './ui';
import VcCard from './VcCard.client';

type Quick = 'emailed' | 'meeting' | 'dismiss_conflict';

// The task wording and its Done action, from the recommended action.
export function taskOf(vc: VcView): { verb: string; why: string; done: { action: Quick; label: string } | null } {
  const a = vc.action, d = vc.daysSinceContact;
  const waited = d !== null ? `No reply for ${d} days` : 'No reply yet';
  if (a.startsWith('Close the loop')) return { verb: 'Close the loop with', why: `${waited}. One last short note, then move on.`, done: { action: 'emailed', label: 'Followed up' } };
  if (a.startsWith('Nudge — reference')) return { verb: 'Follow up with', why: `${waited}. Reference their recent activity: ${vc.summary ?? ''}`, done: { action: 'emailed', label: 'Followed up' } };
  if (a.startsWith('Nudge due')) return { verb: 'Follow up with', why: `${waited}. A short nudge with one new data point.`, done: { action: 'emailed', label: 'Followed up' } };
  if (a.startsWith('Next step due')) return { verb: 'Move forward with', why: `In conversation · last contact ${d ?? '?'} days ago. Propose the next step.`, done: { action: 'meeting', label: 'Meeting booked' } };
  if (a.startsWith('Check conflict')) return { verb: 'Check before pitching', why: vc.conflict?.evidence ?? vc.summary ?? 'Their firm may have backed a company like yours.', done: { action: 'dismiss_conflict', label: 'Not a conflict' } };
  if (a.startsWith('Reach out')) return { verb: 'Reach out to', why: vc.summary ?? 'Recent activity in your space.', done: { action: 'emailed', label: 'Mark sent' } };
  if (a.startsWith('If you have capacity')) return { verb: 'Optional: reach out to', why: `${vc.whyFit ?? 'Good fit from research.'} No logistics activity in the last 30 days.`, done: { action: 'emailed', label: 'Mark sent' } };
  if (a.startsWith('Added by you')) return { verb: 'Reach out to', why: 'You added this investor.', done: { action: 'emailed', label: 'Mark sent' } };
  return { verb: a, why: vc.summary ?? '', done: null };
}

export default function TaskRow({ vc, index }: { vc: VcView; index: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const t = taskOf(vc);
  const tone = actionToneOf(vc.action);
  async function done(e: React.MouseEvent<HTMLButtonElement>) {
    if (!t.done) return;
    const el = e.currentTarget;
    setBusy(true); setFailed(false);
    try {
      const r = await fetch(`/api/vc/${vc.id}/quick`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: t.done.action }) });
      if (!r.ok) throw new Error(String(r.status));
      burst(el);
      router.refresh();
    } catch { setFailed(true); } finally { setBusy(false); }
  }
  const primary = vc.status === 'not_contacted' && vc.route.kind === 'form' && (vc.route.url ?? vc.route.findUrl) ? { href: (vc.route.url ?? vc.route.findUrl)!, label: 'Open form', Icon: I.form }
    : vc.status === 'not_contacted' && vc.route.kind === 'linkedin' && vc.route.url ? { href: vc.route.url, label: 'LinkedIn', Icon: I.linkedin }
    : vc.gmailUrl ? { href: vc.gmailUrl, label: vc.status === 'not_contacted' ? 'Draft in Gmail' : 'Nudge in Gmail', Icon: I.mail } : null;
  return (
    <li data-card="" className="row-hover border-b border-line last:border-b-0">
      <div className="grid gap-x-4 gap-y-2 px-4 py-4 sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:px-5">
        <span className="hidden pt-1 font-mono text-[11px] tabular-nums text-ink-3 sm:block" aria-hidden="true">{index}</span>
        <div className="min-w-0">
          <p className="text-[15px] leading-snug">
            <span className={`mr-1.5 inline-block h-1.5 w-1.5 -translate-y-[2px] ${TONE[tone].dot}`} aria-hidden="true" />
            <span className="text-ink-2">{t.verb} </span>
            <NameLinks name={vc.name} firm={vc.firm} linkedin={vc.brief.linkedin} website={vc.brief.website} />
            {isDemoNote(vc.notes) && <Badge className="ml-2 align-middle" title="Example history for the walkthrough, not a real interaction">Demo</Badge>}
          </p>
          <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-ink-3">{t.why}</p>
          {failed && <p role="alert" className="mt-1 text-[12.5px] text-danger">Couldn&apos;t save that. Check your connection and try again.</p>}
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="mr-1 hidden lg:inline"><FitMeter score={vc.fit.score} label={vc.fit.label} compact /></span>
          {primary && <a href={primary.href} target="_blank" rel="noopener noreferrer" className={btn('secondary')}><primary.Icon width={14} height={14} />{primary.label}</a>}
          {t.done && <button type="button" disabled={busy} onClick={done} className={btn('primary')}><I.check width={14} height={14} />{busy ? 'Saving…' : t.done.label}</button>}
          <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className={`${btn('quiet')} font-mono text-[11px] uppercase tracking-[0.12em]`}>
            {open ? 'Close' : 'Open'}<I.chevron width={13} height={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>
      {open && <div className="border-t border-line bg-paper/50 p-3 sm:p-4"><VcCard vc={vc} index={index} /></div>}
    </li>
  );
}
