// SPEC §11 dashboard: the decision first (This week), the proof one click away (card details).
// Visual language: operational console — ruled grid, mono readouts, numbered dossier, colour only where it means something.
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import VcCard from '@/components/VcCard.client';
import { btn, I, SectionTitle } from '@/components/ui';
import { loadDashboard, loadHeader, nextScheduledRun, SECTIONS } from '@/lib/dashboard';
import { loadPersona } from '@/lib/store';

export const dynamic = 'force-dynamic';

const pad = (n: number) => String(n).padStart(2, '0');
const isoWeek = (d: Date) => {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  return Math.ceil(((t.getTime() - Date.UTC(t.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
};

// One readout cell in the KPI strip.
function Readout({ code, label, value, unit, note, tone, href }: { code: string; label: string; value: number; unit?: string; note: React.ReactNode; tone?: 'signal' | 'danger' | 'info' | 'warn'; href?: string }) {
  const colour = tone === 'signal' ? 'text-signal' : tone === 'danger' ? 'text-danger' : tone === 'info' ? 'text-info' : tone === 'warn' ? 'text-warn' : 'text-ink';
  const body = (
    <div data-reveal="" className="group relative h-full px-5 py-5 sm:px-6">
      <p className="label flex items-center justify-between"><span data-scramble="">{label}</span><span className="text-ink-3/70">{code}</span></p>
      <p className={`mt-4 font-mono text-[44px] font-light leading-none tabular-nums tracking-[-0.04em] ${value > 0 ? colour : 'text-ink-3'}`}>
        <span data-count={value} data-decimals={Number.isInteger(value) ? 0 : 1}>{value}</span>{unit && <span className="ml-1.5 text-[14px] tracking-normal text-ink-3">{unit}</span>}
      </p>
      <div className="mt-3 text-[12.5px] leading-snug text-ink-2">{note}</div>
      {href && <I.arrow width={14} height={14} className="absolute right-5 top-[52px] text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />}
    </div>
  );
  return href ? <Link href={href} className="block h-full transition-colors hover:bg-surface">{body}</Link> : body;
}

const STAGES = [
  { key: 'not_contacted', label: 'Not contacted', cls: 'bg-line-2' },
  { key: 'awaiting_response', label: 'Awaiting reply', cls: 'bg-info' },
  { key: 'in_conversation', label: 'In conversation', cls: 'bg-accent-text' },
  { key: 'passed', label: 'Passed', cls: 'bg-ink-3' },
] as const;

export default async function Home() {
  const [{ vcs, runway }, header, persona] = await Promise.all([loadDashboard(), loadHeader(), loadPersona()]);
  const pick = (k: string) => vcs.filter((v) => v.section === k);
  const followups = pick('followups'), conflicts = pick('conflict'), week = pick('thisWeek');
  const committed = week.filter((v) => !v.action.startsWith('Warm')), optional = week.filter((v) => v.action.startsWith('Warm'));
  const now = new Date();
  const dateLabel = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
  const rest = SECTIONS.filter((s) => !['followups', 'thisWeek', 'conflict'].includes(s.key)).map((s) => ({ ...s, list: pick(s.key) })).filter((s) => s.list.length);
  const firstNames = (list: typeof vcs) => list.slice(0, 3).map((v) => v.name.split(' ')[0]).join(', ') + (list.length > 3 ? ` +${list.length - 3}` : '');
  let n = 0; // running dossier number across sections
  const num = () => pad(++n);

  return (
    <>
      <AppHeader active="/" run={header.lastRun} nextRun={nextScheduledRun().toISOString()} credits={header.credits} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1240px] px-4 pb-28 outline-none sm:px-8">
        {/* Hero: the answer to "what do I do this week?" */}
        <section className="relative -mx-4 border-b border-line px-4 pb-12 pt-14 sm:-mx-8 sm:px-8 sm:pt-20">
          <div className="grid-bg" aria-hidden="true" />
          <span className="tick left-[calc(2rem-4px)] top-[calc(5rem-4px)] hidden sm:block" aria-hidden="true" />
          <span className="tick right-[calc(2rem-4px)] top-[calc(5rem-4px)] hidden sm:block" aria-hidden="true" />
          <div className="relative z-[1]">
            <p data-reveal="" className="label mb-8 flex flex-wrap gap-x-5 gap-y-1">
              <span data-scramble="">Week {pad(isoWeek(now))}</span><span data-scramble="">{dateLabel}</span><span data-scramble="">Seed round · USD 1–3M</span>
            </p>
            <h1 className="max-w-[980px] text-[44px] font-medium leading-[0.98] tracking-[-0.045em] text-ink sm:text-[76px]">
              <span className="mask-line"><span data-line="">
                {followups.length > 0 ? <>{followups.length} follow-up{followups.length === 1 ? '' : 's'} due, </> : null}
                <span className="text-signal">{committed.length}</span> investor{committed.length === 1 ? '' : 's'}
              </span></span>
              <span className="mask-line"><span data-line="" className="text-ink-3">to reach this week.</span></span>
            </h1>
            <p data-reveal="" className="mt-8 max-w-[620px] text-[15px] leading-relaxed text-ink-2">
              Ranked by fit to a USD 1–3M freight-tech seed. Every investor below carries the reason they fit, the way in,
              a ready draft and the evidence behind it.{optional.length > 0 && <> {optional.length} more {optional.length === 1 ? 'is' : 'are'} worth a note if there is time.</>}
            </p>
          </div>
        </section>

        {/* KPI strip: a ruled four-cell readout */}
        <section aria-label="This week at a glance" className="-mx-4 grid grid-cols-2 border-b border-line sm:-mx-8 lg:grid-cols-4 [&>*]:border-line [&>*:nth-child(odd)]:border-r lg:[&>*:not(:last-child)]:border-r [&>*:nth-child(-n+2)]:border-b lg:[&>*]:border-b-0">
          <div><Readout code="K1" label="To reach" value={committed.length} tone="signal" note={committed.length ? firstNames(committed) : 'Nothing new this week'} /></div>
          <div><Readout code="K2" label="Follow-ups due" value={followups.length} tone="info" note={followups.length ? firstNames(followups) : 'Nothing waiting on you'} /></div>
          <div><Readout code="K3" label="Check first" value={conflicts.length} tone="danger" note={conflicts.length ? 'Firm backed a company like yours' : 'No conflicts'} /></div>
          <div><Readout code="K4" label="Runway" value={runway.weeks} unit="weeks" tone={runway.weeks < 4 ? 'warn' : undefined} href="/investors"
            note={<>{runway.firms} good-fit firms left at {runway.perWeek}/week<span className="mt-2.5 block h-[3px] bg-line" aria-hidden="true"><span data-fill="" className={`block h-full ${runway.weeks < 4 ? 'bg-warn' : 'bg-ink'}`} style={{ width: `${Math.min(100, Math.round((runway.weeks / 6) * 100))}%` }} /></span></>} /></div>
        </section>

        {/* Pipeline stage bar */}
        <section data-reveal="" aria-label="Pipeline" className="-mx-4 mb-16 border-b border-line px-4 py-5 sm:-mx-8 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
            <p className="label">Pipeline · <span data-count={vcs.length}>{vcs.length}</span> investors tracked</p>
            <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-3">
              {STAGES.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-2"><span className={`h-2 w-2 ${s.cls}`} aria-hidden="true" />{s.label} <span className="text-ink">{pad(vcs.filter((v) => v.status === s.key).length)}</span></span>
              ))}
            </div>
          </div>
          <div className="mt-4 flex h-[6px] gap-px bg-paper" aria-hidden="true">
            {STAGES.map((s) => { const c = vcs.filter((v) => v.status === s.key).length; return c ? <span key={s.key} data-seg="" className={`${s.cls} h-full`} style={{ width: `${(100 * c) / vcs.length}%` }} /> : null; })}
          </div>
          <div className="mt-4 grid gap-1 text-[12px] text-ink-3 sm:grid-cols-[1fr_1fr_auto] sm:gap-8">
            <p className="truncate" title={persona.targetSpace}><span className="label mr-2">Target</span>{persona.targetSpace}</p>
            <p className="truncate" title={persona.myProduct || 'Not set'}><span className="label mr-2">Product</span>{persona.myProduct || 'not set (competitor flags off)'}</p>
            <Link href="/settings" className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 hover:text-ink">Edit →</Link>
          </div>
        </section>

        {followups.length > 0 && (
          <section className="mb-16">
            <SectionTitle index="§1" count={followups.length} tone="info" hint="Longest waiting first">Follow-ups due</SectionTitle>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-3">{followups.map((v) => <VcCard key={v.id} vc={v} index={num()} />)}</div>
          </section>
        )}

        <section className="mb-16">
          <SectionTitle index={followups.length ? '§2' : '§1'} count={committed.length} tone="signal" hint="Best fit first · at most 7 new a week · one partner per firm">Reach out this week</SectionTitle>
          {committed.length ? <div className="grid grid-cols-[minmax(0,1fr)] gap-3">{committed.map((v) => <VcCard key={v.id} vc={v} index={num()} />)}</div>
            : <div className="border border-dashed border-line-2 p-10 text-center text-[14px] text-ink-3">No new outreach this week. <Link href="/investors" className="text-ink underline underline-offset-4">Add investors</Link> to refill the pipeline.</div>}
          {optional.length > 0 && (
            <div className="mt-12">
              <SectionTitle index="+" count={optional.length} tone="warn" hint="Good fit or recent in-space activity; reach out if there is capacity">If there is time</SectionTitle>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-3">{optional.map((v) => <VcCard key={v.id} vc={v} index={num()} />)}</div>
            </div>
          )}
        </section>

        {conflicts.length > 0 && (
          <section className="mb-16">
            <SectionTitle index="!" count={conflicts.length} tone="danger" hint="Their firm backed a company like yours. Open a row to see the evidence.">Check before pitching</SectionTitle>
            <div className="grid grid-cols-[minmax(0,1fr)] border-t border-line">{conflicts.map((v) => <VcCard key={v.id} vc={v} compact index={num()} />)}</div>
          </section>
        )}

        <section>
          <div className="mb-1 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 flex-1"><SectionTitle index="∑" count={rest.reduce((c, s) => c + s.list.length, 0)} hint="Queued, routed through a partner, or on hold">Rest of the pipeline</SectionTitle></div>
          </div>
          <div className="mb-5 flex justify-end"><Link href="/investors" className={btn('secondary')}><I.plus width={14} height={14} />Add investors</Link></div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {rest.map((s) => (
              <details key={s.key} open={s.key === 'queue'} className="group border border-line">
                <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 text-[13.5px] text-ink transition-colors hover:bg-surface">
                  <I.chevron width={14} height={14} className="text-ink-3 transition-transform group-open:rotate-180" />
                  <span className="font-medium">{s.title}</span><span className="ml-auto font-mono text-[11px] text-ink-3">{pad(s.list.length)}</span>
                </summary>
                <div className="grid grid-cols-[minmax(0,1fr)] border-t border-line">{s.list.map((v) => <VcCard key={v.id} vc={v} compact index={num()} />)}</div>
              </details>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
