// REVIEW-2 item 2: pipeline runway. Researched-but-untracked investors Vikram can add, plus any investor he names.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addCandidate, addManualVc, dismissCandidate, loadCandidates } from '@/lib/candidates';
import { loadDashboard } from '@/lib/dashboard';
import AppHeader from '@/components/AppHeader';
import { Badge, btn, FitMeter, I, inputCls, NameLinks, PageTitle, SectionTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

async function add(formData: FormData) {
  'use server';
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) redirect('/investors?error=1');
  await addCandidate(id);
  revalidatePath('/');
  redirect('/investors?added=1');
}

async function dismiss(formData: FormData) {
  'use server';
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id) || id <= 0) redirect('/investors?error=1');
  await dismissCandidate(id);
  redirect('/investors');
}

async function addManual(formData: FormData) {
  'use server';
  const name = String(formData.get('name') ?? ''), firm = String(formData.get('firm') ?? '');
  if (!name.trim() || !firm.trim()) redirect('/investors?error=manual');
  await addManualVc({ name, firm, linkedinUrl: String(formData.get('linkedin') ?? '') });
  revalidatePath('/');
  redirect('/investors?added=1');
}

export default async function InvestorsPage({ searchParams }: { searchParams: Promise<{ added?: string; error?: string }> }) {
  const [{ added, error }, candidates, { runway }] = await Promise.all([searchParams, loadCandidates(), loadDashboard()]);
  const fresh = candidates.filter((c) => c.newFirm), more = candidates.filter((c) => !c.newFirm);
  const low = runway.weeks < 4;
  let n = 0;
  const row = (c: (typeof candidates)[number]) => (
    <li key={c.id}>
      <div className="row-hover border-b border-line p-5 transition-colors hover:bg-surface" data-card="">
        <div className="flex flex-wrap items-start gap-x-5 gap-y-2">
          <span className="hidden w-8 pt-1 font-mono text-[11px] tabular-nums text-ink-3 sm:block" aria-hidden="true">{String(++n).padStart(2, '0')}</span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-medium tracking-[-0.01em] text-ink"><NameLinks name={c.name} firm={c.firm} linkedin={c.brief.linkedin} website={c.brief.website} /></p>
            {!c.newFirm && <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-3">{c.trackedAtFirm} partner{c.trackedAtFirm === 1 ? '' : 's'} already tracked at this firm</p>}
          </div>
          <FitMeter score={c.fit} label={c.label} />
        </div>
        {c.whyFit && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2 sm:pl-[52px]">{c.whyFit}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2 sm:pl-[52px]">
          {c.cheque && <span><span className="text-ink-3">Cheque</span> {c.cheque}</span>}
          {c.stage && <span><span className="text-ink-3">Stage</span> {c.stage}</span>}
          {c.brief.fundStatus && <Badge tone={c.brief.fundStatus.tone} title={c.brief.fund ?? undefined}>{c.brief.fundStatus.label}</Badge>}
          {c.brief.dealCount > 0 && <span><span className="text-ink-3">Deals</span> {c.brief.dealCount}{c.brief.inSpaceCount > 0 && <span className="text-accent-text"> · {c.brief.inSpaceCount} in your space</span>}</span>}
          {c.flags.map((f) => <Badge key={f} tone="warn"><I.alert width={12} height={12} />{f}</Badge>)}
          {c.brief.competitorDeals.length > 0 && <Badge tone="danger"><I.alert width={12} height={12} />Possible competitor deal: {c.brief.competitorDeals[0].slice(0, 40)}</Badge>}
        </div>
        {c.brief.deals.length > 0 && (
          <ul className="mt-2 grid gap-1 sm:pl-[52px]" aria-label={`${c.name} recent deals`}>
            {c.brief.deals.slice(0, 3).map((d) => (
              <li key={d.label} className="flex items-start gap-1.5 text-[12.5px] text-ink-2">
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 ${d.competitor ? 'bg-danger' : d.inSpace ? 'bg-accent-text' : 'bg-line-2'}`} aria-hidden="true" />
                {d.url ? <a href={d.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line-2 underline-offset-2 hover:decoration-ink">{d.label}</a> : d.label}
                {d.year && <span className="text-ink-3">· {d.year}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex gap-2 sm:pl-[52px]">
            <form action={add}><input type="hidden" name="id" value={c.id} /><button className={btn('primary')}><I.plus width={14} height={14} />Add to pipeline</button></form>
            <form action={dismiss}><input type="hidden" name="id" value={c.id} /><button className={btn('ghost')}>Not for me</button></form>
        </div>
      </div>
    </li>
  );
  return (
    <>
      <AppHeader active="/investors" />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1040px] px-4 pb-28 pt-12 outline-none sm:px-8">
        <PageTitle eyebrow="02 / Investors · Runway" title={<>Keep the pipeline full.</>}
          sub="Researched investors you don't track yet, plus anyone you want to add. Adding one puts them in your queue with a draft ready." />
        <div data-reveal="" className={`mb-12 flex flex-wrap items-end gap-x-10 gap-y-4 border-y px-1 py-6 ${low ? 'border-warn/40' : 'border-line'}`}>
          <div>
            <p className="label">Runway</p>
            <p className={`mt-3 font-mono text-[44px] font-light leading-none tracking-[-0.04em] ${low ? 'text-warn' : 'text-ink'}`}><span data-count={runway.weeks}>{runway.weeks}</span><span className="ml-1.5 text-[14px] tracking-normal text-ink-3">weeks</span></p>
          </div>
          <div className="min-w-48 flex-1">
            <span className="block h-[3px] bg-line" aria-hidden="true"><span data-fill="" className={`block h-full ${low ? 'bg-warn' : 'bg-ink'}`} style={{ width: `${Math.min(100, Math.round((runway.weeks / 6) * 100))}%` }} /></span>
            <p className="mt-2 text-[13px] text-ink-2">{runway.firms} good-fit firm{runway.firms === 1 ? '' : 's'} left to contact at {runway.perWeek} new emails a week.{low && ' Add a few below to stay ahead.'}</p>
          </div>
        </div>
        {added && <p role="status" className="fade-in mb-6 flex items-center gap-2 border-l-2 border-accent-text bg-accent-soft px-4 py-3 text-[13.5px] text-accent-text"><I.check width={16} height={16} />Added. Their card is in your queue now; news and LinkedIn arrive with the next run.</p>}
        {error && <p role="alert" className="mb-6 border-l-2 border-danger bg-danger-soft px-4 py-3 text-[13.5px] text-danger">{error === 'manual' ? 'Name and firm are required.' : 'Something went wrong. Try again.'}</p>}

        <SectionTitle index="§1" count={fresh.length} tone="accent" hint="Each adds a new firm, so a new outreach slot">From your research, at new firms</SectionTitle>
        <p className="-mt-1 mb-4 text-[13px] text-ink-3">None reached a &quot;good&quot; fit score, so read the why-fit before adding. When you add someone, your choice queues them for outreach.</p>
        {fresh.length ? <ul className="border-t border-line">{fresh.map(row)}</ul> : <p className="border border-dashed border-line-2 p-6 text-center text-[14px] text-ink-3">None left.</p>}

        <details className="group mt-12 border border-line">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-surface">
            <I.chevron width={14} height={14} className="text-ink-3 transition-transform group-open:rotate-180" />
            More partners at firms you already track<span className="ml-auto font-mono text-[11px] text-ink-3">{String(more.length).padStart(2, '0')}</span>
          </summary>
          <p className="px-4 pb-2 text-[13px] text-ink-3">A second route into a firm. The plan reaches out to one partner per firm, so these add no new slot.</p>
          <ul className="border-t border-line">{more.map(row)}</ul>
        </details>

        <section className="mt-12 border border-line p-6">
          <SectionTitle index="§2" tone="info">Add someone else</SectionTitle>
          <form action={addManual} className="grid gap-3 sm:grid-cols-3">
            <input name="name" required maxLength={120} placeholder="Name" aria-label="Name" className={inputCls} />
            <input name="firm" required maxLength={120} placeholder="Firm" aria-label="Firm" className={inputCls} />
            <input name="linkedin" maxLength={300} placeholder="LinkedIn profile URL (optional)" aria-label="LinkedIn profile URL" className={inputCls} />
            <div className="sm:col-span-3"><button className={btn('primary', 'md')}><I.plus width={15} height={15} />Add to pipeline</button></div>
          </form>
          <p className="mt-3 text-[12.5px] text-ink-3">Without research, fit starts weak, but your choice still queues them. With the LinkedIn URL, their posts arrive with the next weekly check.</p>
        </section>
      </main>
    </>
  );
}
