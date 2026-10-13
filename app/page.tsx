// This week (Plan V2): Vikram's to-do list for the week and how the raise is moving. Follow-ups first (relationships in
// flight), then investors with a real in-space signal, then optional fit-based outreach. Quiet investors are listed
// with their reason, so he knows where not to spend energy. The full table lives on /pipeline.
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import TaskRow from '@/components/TaskRow.client';
import { btn, I, NameLinks, SectionTitle } from '@/components/ui';
import { loadDashboard, loadHeader, nextScheduledRun } from '@/lib/dashboard';
import { loadDraftSettings } from '@/lib/store';
import { demoActive } from '@/lib/demo';
import { loadProgress } from '@/lib/outcomes';
import { DONE_LABEL } from '@/lib/progress';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');
const CAPACITY_SHOWN = 5;

function Readout({ code, label, value, unit, note, tone, bar }: { code: string; label: string; value: number; unit?: string; note: React.ReactNode; tone?: 'signal' | 'info' | 'accent' | 'warn'; bar?: number }) {
  const colour = tone === 'signal' ? 'text-signal' : tone === 'info' ? 'text-info' : tone === 'accent' ? 'text-accent-text' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div data-reveal="" className="h-full px-5 py-5 sm:px-6">
      <p className="label" data-code={code}><span data-scramble="">{label}</span></p>
      <p className={`mt-4 font-mono text-[40px] font-light leading-none tabular-nums tracking-[-0.04em] ${value > 0 ? colour : 'text-ink-3'}`}>
        <span data-count={value} data-decimals={Number.isInteger(value) ? 0 : 1}>{value}</span>{unit && <span className="ml-1.5 text-[14px] tracking-normal text-ink-3">{unit}</span>}
      </p>
      <div className="mt-3 text-[12.5px] leading-snug text-ink-2">{note}</div>
      {bar !== undefined && <span className="mt-2.5 block h-[3px] bg-line" aria-hidden="true"><span data-fill="" className="block h-full bg-ink" style={{ width: `${Math.min(100, Math.round(bar * 100))}%` }} /></span>}
    </div>
  );
}

export default async function Home() {
  const [{ vcs, runway }, header, progress, demo, draft] = await Promise.all([loadDashboard(), loadHeader(), loadProgress(), demoActive(), loadDraftSettings()]);
  // Drafts are only sendable once the pitch names the company and the deck link is set.
  const genericPitch = !draft.pitch.trim() || /^we are building b2b logistics saas and raising our seed round.?$/i.test(draft.pitch.trim());
  const setupMissing = [genericPitch && 'your one-line pitch (company name and a traction number)', !draft.deckUrl.trim() && 'your deck link'].filter(Boolean) as string[];
  const pick = (k: string) => vcs.filter((v) => v.section === k);
  const followups = pick('followups'), signal = pick('thisWeek'), conflicts = pick('conflict'), capacity = pick('capacity'), quiet = pick('quiet');
  const committed = followups.length + signal.length + conflicts.length;
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase();
  const w = progress.thisWeek, lw = progress.lastWeek, f = progress.funnel;
  const doneCount = progress.done.length;
  let n = 0;
  const num = () => pad(++n);
  const stages = [
    { label: 'To contact', count: f.toContact, cls: 'bg-line-2' },
    { label: 'Awaiting reply', count: f.awaiting, cls: 'bg-info' },
    { label: 'In conversation', count: f.conversation, cls: 'bg-accent-text' },
    { label: 'Passed', count: f.passed, cls: 'bg-ink-3' },
  ];
  const total = stages.reduce((s, x) => s + x.count, 0) || 1;
  const vs = (a: number, b: number) => (a === b ? 'same as last week' : a > b ? `up from ${b} last week` : `down from ${b} last week`);

  return (
    <>
      <AppHeader active="/" run={header.lastRun} nextRun={nextScheduledRun().toISOString()} credits={header.credits} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1240px] px-4 pb-28 outline-none sm:px-8">
        {demo && (
          <p className="-mx-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-surface px-4 py-2.5 text-[12.5px] text-ink-2 sm:-mx-8 sm:px-8">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-signal">Demo history loaded</span>
            Rows marked DEMO are example contact history for the walkthrough, not real interactions.
            <Link href="/settings#demo" className="text-ink underline underline-offset-4">Clear it in Settings</Link>
          </p>
        )}

        {setupMissing.length > 0 && (
          <p className="-mx-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line bg-signal-soft px-4 py-2.5 text-[12.5px] text-ink sm:-mx-8 sm:px-8">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-signal">Before you send anything</span>
            Add {setupMissing.join(' and ')} in Settings. Every draft uses them.
            <Link href="/settings" className="text-ink underline underline-offset-4">Open Settings</Link>
          </p>
        )}

        {/* Hero: the week in one sentence */}
        <section className="relative -mx-4 border-b border-line px-4 pb-10 pt-12 sm:-mx-8 sm:px-8 sm:pt-16">
          <div className="grid-bg" aria-hidden="true" />
          <div className="relative z-[1]">
            <p data-reveal="" className="label mb-7 flex flex-wrap gap-x-5 gap-y-1">
              <span data-scramble="">Week of {dateLabel}</span>
              {progress.weekOfRaise && <span data-scramble="">Week {progress.weekOfRaise} of the raise</span>}
              <span data-scramble="">Seed round · B2B logistics SaaS</span>
            </p>
            <h1 className="max-w-[1000px] text-[40px] font-medium leading-[1] tracking-[-0.045em] text-ink sm:text-[68px]">
              <span className="mask-line"><span data-line=""><span className="text-signal">{committed}</span> thing{committed === 1 ? '' : 's'} to do this week,</span></span>
              <span className="mask-line"><span data-line="" className="text-ink-3">{doneCount} done so far.</span></span>
            </h1>
            <p data-reveal="" className="mt-7 max-w-[680px] text-[15px] leading-relaxed text-ink-2">
              {followups.length > 0 && <>{followups.length} follow-up{followups.length === 1 ? '' : 's'} on conversations in flight. </>}
              {signal.length > 0
                ? <>{signal.length} investor{signal.length === 1 ? ' has' : 's have'} shown observable activity in logistics in the last 30 days, so this is a good moment to write. </>
                : <>No investor on your list showed activity in logistics in the last 30 days. </>}
              {quiet.length} {quiet.length === 1 ? 'is' : 'are'} quiet or busy elsewhere: not worth chasing this week.
            </p>
          </div>
        </section>

        {/* Progress strip */}
        <section aria-label="Progress this week" className="-mx-4 grid grid-cols-2 border-b border-line sm:-mx-8 lg:grid-cols-4 [&>*]:border-line [&>*:nth-child(odd)]:border-r lg:[&>*:not(:last-child)]:border-r [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0">
          <div><Readout code="P1" label="New emails this week" value={w.sent} unit={`/ ${progress.target}`} tone="signal" bar={w.sent / progress.target} note={`Weekly target ${progress.target} · ${vs(w.sent, lw.sent)}`} /></div>
          <div><Readout code="P2" label="Follow-ups sent" value={w.nudged} tone="info" note={`${followups.length} still due · ${vs(w.nudged, lw.nudged)}`} /></div>
          <div><Readout code="P3" label="Replies this week" value={w.replies} tone="accent" note={`${f.replied} of ${f.contacted} contacted have replied`} /></div>
          <div><Readout code="P4" label="Meetings" value={f.meetings} tone="accent" note={`${w.meetings} this week · runway ${runway.weeks} weeks of good-fit firms`} /></div>
        </section>

        {/* Funnel */}
        <section data-reveal="" aria-label="Pipeline funnel" className="-mx-4 mb-14 border-b border-line px-4 py-5 sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <p className="label">Pipeline · {total} investors</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
              {stages.map((s) => <span key={s.label} className="inline-flex items-center gap-2"><span className={`h-2 w-2 ${s.cls}`} aria-hidden="true" />{s.label} <span className="text-ink">{pad(s.count)}</span></span>)}
            </div>
          </div>
          <div className="mt-4 flex h-[6px] gap-px" aria-hidden="true">
            {stages.map((s) => (s.count ? <span key={s.label} data-seg="" className={`${s.cls} h-full`} style={{ width: `${(100 * s.count) / total}%` }} /> : null))}
          </div>
          <p className="mt-3 text-[12.5px] text-ink-3">
            {f.contacted ? <>{f.contacted} contacted · {f.replied} replied ({Math.round((100 * f.replied) / f.contacted)}%) · {f.meetings} meeting{f.meetings === 1 ? '' : 's'}</> : 'No outreach logged yet. Log your first email from the list below.'}
            {' · '}<Link href="/pipeline" className="text-ink-2 underline underline-offset-4 hover:text-ink">See all {total} in Pipeline</Link>
          </p>
        </section>

        {/* To-do list */}
        <section className="mb-14">
          <SectionTitle index="§1" count={followups.length} tone="info" hint="Conversations already in flight: waiting longest first">Follow-ups due</SectionTitle>
          {followups.length ? <ul className="border border-line">{followups.map((v) => <TaskRow key={v.id} vc={v} index={num()} />)}</ul>
            : <p className="border border-dashed border-line-2 p-6 text-center text-[13.5px] text-ink-3">Nothing waiting on you. Investors you email show up here when a follow-up is due.</p>}
        </section>

        <section className="mb-14">
          <SectionTitle index="§2" count={signal.length} tone="signal" hint="Wrote, spoke, invested or was quoted on logistics in the last 30 days: your message lands in a receptive moment">Reach out: signal this week</SectionTitle>
          {signal.length ? <ul className="border border-line">{signal.map((v) => <TaskRow key={v.id} vc={v} index={num()} />)}</ul>
            : <p className="border border-dashed border-line-2 p-6 text-center text-[13.5px] text-ink-3">No investor on your list showed logistics activity in the last 30 days. That is common: the list below keeps the pipeline moving.</p>}
        </section>

        {conflicts.length > 0 && (
          <section className="mb-14">
            <SectionTitle index="!" count={conflicts.length} tone="danger" hint="Their firm may have backed a company like yours: check before pitching">Check before pitching</SectionTitle>
            <ul className="border border-line">{conflicts.map((v) => <TaskRow key={v.id} vc={v} index={num()} />)}</ul>
          </section>
        )}

        <section className="mb-14">
          <SectionTitle index="§3" count={capacity.length} tone="accent" hint="Good fit from research and active, but not on logistics lately. Reach out on fit only, if you have time.">If you have capacity</SectionTitle>
          {capacity.length ? (
            <>
              <ul className="border border-line">{capacity.slice(0, CAPACITY_SHOWN).map((v) => <TaskRow key={v.id} vc={v} index={num()} />)}</ul>
              {capacity.length > CAPACITY_SHOWN && (
                <details className="group mt-2 border border-line">
                  <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[13px] text-ink-2 hover:bg-surface"><I.chevron width={14} height={14} className="transition-transform group-open:rotate-180" />{capacity.length - CAPACITY_SHOWN} more</summary>
                  <ul className="border-t border-line">{capacity.slice(CAPACITY_SHOWN).map((v) => <TaskRow key={v.id} vc={v} index={num()} />)}</ul>
                </details>
              )}
            </>
          ) : <p className="border border-dashed border-line-2 p-6 text-center text-[13.5px] text-ink-3">Nothing optional this week.</p>}
        </section>

        {/* Done this week */}
        <section className="mb-14">
          <SectionTitle index="✓" count={doneCount} tone="accent" hint="Everything you logged since Monday">Done this week</SectionTitle>
          {doneCount ? (
            <ul className="border border-line">
              {progress.done.map((d) => (
                <li key={`${d.vcId}-${d.at}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-3 text-[14px] last:border-b-0 sm:px-5">
                  <I.check width={15} height={15} className="text-accent-text" />
                  <span className="text-ink-2">{DONE_LABEL[d.event]} <span className="text-ink">{d.name}</span> <span className="text-ink-3">/ {d.firm}</span></span>
                  {d.demo && <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">[demo]</span>}
                  <span className="ml-auto font-mono text-[11px] text-ink-3">{new Date(d.at).toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short' })}</span>
                </li>
              ))}
            </ul>
          ) : <p className="border border-dashed border-line-2 p-6 text-center text-[13.5px] text-ink-3">Nothing logged yet this week. Use Mark sent or Followed up on a task above and it moves here.</p>}
        </section>

        {/* Not worth chasing */}
        <section>
          <details className="group border border-line">
            <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3.5 text-[13.5px] text-ink transition-colors hover:bg-surface">
              <I.chevron width={14} height={14} className="text-ink-3 transition-transform group-open:rotate-180" />
              <span className="font-medium">Not worth chasing this week</span>
              <span className="hidden text-ink-3 sm:inline">quiet for 30 days, or active only outside logistics</span>
              <span className="ml-auto font-mono text-[11px] text-ink-3">{pad(quiet.length)}</span>
            </summary>
            <ul className="border-t border-line">
              {quiet.map((v) => (
                <li key={v.id} className="grid gap-1 border-b border-line px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] sm:gap-6 sm:px-5">
                  <NameLinks name={v.name} firm={v.firm} linkedin={v.brief.linkedin} website={v.brief.website} className="truncate text-[14px]" />
                  <span className="truncate text-[12.5px] text-ink-3" title={v.summary ?? undefined}>{v.summary}</span>
                </li>
              ))}
            </ul>
          </details>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/pipeline" className={btn('secondary')}>Open the full pipeline <I.arrow width={14} height={14} /></Link>
            <Link href="/investors" className={btn('ghost')}><I.plus width={14} height={14} />Add investors</Link>
          </div>
        </section>
      </main>
    </>
  );
}
