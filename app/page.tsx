// SPEC §11 dashboard: the decision first (This week), the proof one click away (card details).
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import VcCard from '@/components/VcCard.client';
import { Avatar, btn, Card, I, SectionTitle, TONE, type Tone } from '@/components/ui';
import { loadDashboard, loadHeader, nextScheduledRun, SECTIONS, type VcView } from '@/lib/dashboard';
import { loadPersona } from '@/lib/store';

export const dynamic = 'force-dynamic';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Stat({ label, value, tone, children, href }: { label: string; value: React.ReactNode; tone: Tone; children?: React.ReactNode; href?: string }) {
  const body = (
    <Card className={`h-full p-4 transition-shadow ${href ? 'hover:shadow-lift' : ''}`}>
      <p className="flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-ink-3">
        <span className={`h-1.5 w-1.5 rounded-full ${TONE[tone].dot}`} aria-hidden="true" />{label}
      </p>
      <p className="mt-2 font-display text-[40px] leading-none tracking-tight text-ink">{value}</p>
      {children && <div className="mt-3 text-[12.5px] text-ink-2">{children}</div>}
    </Card>
  );
  return href ? <Link href={href} className="block rounded-2xl">{body}</Link> : body;
}

function Faces({ vcs }: { vcs: VcView[] }) {
  if (!vcs.length) return <span className="text-ink-3">None this week</span>;
  return (
    <span className="flex items-center gap-2">
      <span className="flex -space-x-2">
        {vcs.slice(0, 5).map((v) => (
          <a key={v.id} href={`#vc-${v.id}`} title={`${v.name} · ${v.firm}`} aria-label={`Jump to ${v.name}, ${v.firm}`} className="rounded-full ring-2 ring-surface transition-transform hover:-translate-y-0.5">
            <Avatar name={v.name} fit={v.fit.label} size={26} />
          </a>
        ))}
      </span>
      <span className="truncate">{vcs.slice(0, 2).map((v) => v.name.split(' ')[0]).join(', ')}{vcs.length > 2 ? ` +${vcs.length - 2}` : ''}</span>
    </span>
  );
}

const STAGES = [
  { key: 'not_contacted', label: 'Not contacted', cls: 'bg-line-2' },
  { key: 'awaiting_response', label: 'Awaiting reply', cls: 'bg-info' },
  { key: 'in_conversation', label: 'In conversation', cls: 'bg-accent' },
  { key: 'passed', label: 'Passed', cls: 'bg-ink-3' },
] as const;

export default async function Home() {
  const [{ vcs, runway }, header, persona] = await Promise.all([loadDashboard(), loadHeader(), loadPersona()]);
  const pick = (k: string) => vcs.filter((v) => v.section === k);
  const followups = pick('followups'), conflicts = pick('conflict'), week = pick('thisWeek');
  const committed = week.filter((v) => !v.action.startsWith('Warm')), optional = week.filter((v) => v.action.startsWith('Warm'));
  const today = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' });
  const runwayPct = Math.min(100, Math.round((runway.weeks / 6) * 100));
  const rest = SECTIONS.filter((s) => !['followups', 'thisWeek', 'conflict'].includes(s.key)).map((s) => ({ ...s, list: pick(s.key) })).filter((s) => s.list.length);

  return (
    <>
      <AppHeader active="/" run={header.lastRun} nextRun={nextScheduledRun().toISOString()} credits={header.credits} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-6xl px-4 pb-24 pt-8 outline-none sm:px-6">
        {/* Hero: the answer to "what do I do this week?" in one line. */}
        <section className="fade-in mb-8">
          <p className="mb-3 text-[12px] font-medium uppercase tracking-[0.14em] text-ink-3">{today} · Seed round, USD 1–3M</p>
          <h1 className="max-w-3xl font-display text-[40px] leading-[1.05] tracking-tight text-ink sm:text-[54px]">
            {followups.length > 0 && <><em className="text-accent-text">{plural(followups.length, 'follow-up')}</em> due and </>}
            <em className="text-accent-text">{plural(committed.length, 'investor')}</em> to reach this week.
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
            Best fit first. Each card shows why they fit, the way in, a ready draft and the evidence behind it.
            {optional.length > 0 && <> {plural(optional.length, 'more is', 'more are')} worth a note if you have time.</>}
          </p>
        </section>

        <section aria-label="This week at a glance" className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="To reach" value={committed.length} tone="accent"><Faces vcs={committed} /></Stat>
          <Stat label="Follow-ups due" value={followups.length} tone="info">
            {followups.length ? <Faces vcs={followups} /> : <span className="text-ink-3">Nothing waiting on you</span>}
          </Stat>
          <Stat label="Check first" value={conflicts.length} tone="danger">
            {conflicts.length ? <span>{plural(conflicts.length, 'partner')} at firms that backed a company like yours</span> : <span className="text-ink-3">No conflicts</span>}
          </Stat>
          <Stat label="Runway" value={<>{runway.weeks}<span className="ml-1 font-sans text-[15px] text-ink-3">wks</span></>} tone={runway.weeks < 4 ? 'warn' : 'accent'} href="/investors">
            <span className="block h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
              <span className={`block h-full rounded-full ${runway.weeks < 4 ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${runwayPct}%` }} />
            </span>
            <span className="mt-2 flex items-center justify-between gap-2">
              <span>{plural(runway.firms, 'good-fit firm')} left at {runway.perWeek}/wk</span>
              <span className={`inline-flex items-center gap-0.5 font-medium ${runway.weeks < 4 ? 'text-warn' : 'text-accent-text'}`}>Add<I.plus width={13} height={13} /></span>
            </span>
          </Stat>
        </section>

        <Card className="mb-10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] font-medium text-ink">Pipeline · {vcs.length} investors</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-2">
              {STAGES.map((s) => (
                <span key={s.key} className="inline-flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${s.cls}`} aria-hidden="true" />{s.label} <span className="font-mono text-ink">{vcs.filter((v) => v.status === s.key).length}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
            {STAGES.map((s) => {
              const n = vcs.filter((v) => v.status === s.key).length;
              return n ? <span key={s.key} className={`${s.cls} h-full`} style={{ width: `${(100 * n) / vcs.length}%` }} /> : null;
            })}
          </div>
          <div className="mt-3 grid gap-1 border-t border-line pt-3 text-[12px] text-ink-3 sm:grid-cols-[1fr_1fr_auto] sm:gap-4">
            <p className="truncate" title={persona.targetSpace}><span className="font-medium text-ink-2">Target space</span> · {persona.targetSpace}</p>
            <p className="truncate" title={persona.myProduct || 'Not set'}><span className="font-medium text-ink-2">My product</span> · {persona.myProduct || 'not set (competitor flags off)'}</p>
            <Link href="/settings" className="-my-1 inline-flex min-h-6 items-center font-medium text-accent-text hover:underline">Edit</Link>
          </div>
        </Card>

        {followups.length > 0 && (
          <section className="mb-12">
            <SectionTitle count={followups.length} tone="info" hint="Longest waiting first">Follow-ups due</SectionTitle>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-4">{followups.map((v) => <VcCard key={v.id} vc={v} />)}</div>
          </section>
        )}

        <section className="mb-12">
          <SectionTitle count={committed.length} tone="accent" hint="Best fit first · at most 7 new a week">Reach out this week</SectionTitle>
          {committed.length ? <div className="grid grid-cols-[minmax(0,1fr)] gap-4">{committed.map((v) => <VcCard key={v.id} vc={v} />)}</div>
            : <Card className="p-8 text-center text-[14px] text-ink-3">No new outreach suggested this week. <Link href="/investors" className="text-accent-text underline">Add investors</Link> to refill the pipeline.</Card>}
          {optional.length > 0 && (
            <div className="mt-8">
              <SectionTitle count={optional.length} tone="warn" hint="Good fit or recent in-space activity; reach out if you have capacity">If you have time</SectionTitle>
              <div className="grid grid-cols-[minmax(0,1fr)] gap-4">{optional.map((v) => <VcCard key={v.id} vc={v} />)}</div>
            </div>
          )}
        </section>

        {conflicts.length > 0 && (
          <section className="mb-12">
            <SectionTitle count={conflicts.length} tone="danger" hint="Their firm backed a company like yours. Open a card to see the evidence.">Check before pitching</SectionTitle>
            <div className="grid grid-cols-[minmax(0,1fr)] gap-2">{conflicts.map((v) => <VcCard key={v.id} vc={v} compact />)}</div>
          </section>
        )}

        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <SectionTitle count={rest.reduce((n, s) => n + s.list.length, 0)} hint="Queued, routed through a partner, or on hold">Rest of the pipeline</SectionTitle>
            <Link href="/investors" className={btn('secondary')}><I.plus width={14} height={14} />Add investors</Link>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
            {rest.map((s) => (
              <details key={s.key} open={s.key === 'queue'} className="group rounded-2xl bg-surface-2/70 ring-1 ring-line">
                <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[14px] font-medium text-ink">
                  <I.chevron width={16} height={16} className="text-ink-3 transition-transform group-open:rotate-180" />
                  {s.title}<span className="font-mono text-[12px] text-ink-3">{s.list.length}</span>
                </summary>
                <div className="grid grid-cols-[minmax(0,1fr)] gap-2 px-3 pb-3">{s.list.map((v) => <VcCard key={v.id} vc={v} compact />)}</div>
              </details>
            ))}
          </div>
        </section>
      </main>
    </>
  );
}
