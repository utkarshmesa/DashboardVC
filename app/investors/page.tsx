// REVIEW-2 item 2: pipeline runway. Researched-but-untracked investors Vikram can add, plus any investor he names.
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addCandidate, addManualVc, dismissCandidate, loadCandidates } from '@/lib/candidates';
import { loadDashboard } from '@/lib/dashboard';
import AppHeader from '@/components/AppHeader';
import { Avatar, Badge, btn, Card, FitMeter, I, inputCls, PageTitle, SectionTitle } from '@/components/ui';

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
  const row = (c: (typeof candidates)[number]) => (
    <li key={c.id}>
      <Card className="p-4 transition-shadow hover:shadow-lift">
        <div className="flex flex-wrap items-start gap-3">
          <Avatar name={c.name} fit={c.label} size={38} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold tracking-tight text-ink">{c.name} <span className="font-normal text-ink-3">· {c.firm}</span></p>
            {!c.newFirm && <p className="text-[12px] text-ink-3">{c.trackedAtFirm} partner{c.trackedAtFirm === 1 ? '' : 's'} already tracked at this firm</p>}
          </div>
          <FitMeter score={c.fit} label={c.label} size={40} />
        </div>
        {c.whyFit && <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2 sm:pl-[50px]">{c.whyFit}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2 sm:pl-[50px]">
          {c.cheque && <span><span className="text-ink-3">Cheque</span> {c.cheque}</span>}
          {c.stage && <span><span className="text-ink-3">Stage</span> {c.stage}</span>}
          {c.flags.map((f) => <Badge key={f} tone="warn"><I.alert width={12} height={12} />{f}</Badge>)}
        </div>
        <div className="mt-3 flex gap-2 sm:pl-[50px]">
          <form action={add}><input type="hidden" name="id" value={c.id} /><button className={btn('primary')}><I.plus width={14} height={14} />Add to pipeline</button></form>
          <form action={dismiss}><input type="hidden" name="id" value={c.id} /><button className={btn('ghost')}>Not for me</button></form>
        </div>
      </Card>
    </li>
  );
  return (
    <>
      <AppHeader active="/investors" />
      <main id="main" tabIndex={-1} className="mx-auto max-w-4xl px-4 pb-24 pt-8 outline-none sm:px-6">
        <PageTitle eyebrow="Investors" title={<>Keep the pipeline <em className="text-accent-text">full</em>.</>}
          sub="Researched investors you don't track yet, plus anyone you want to add. Adding one puts them in your queue with a draft ready." />
        <Card className={`mb-8 flex flex-wrap items-center gap-4 p-5 ${low ? 'ring-warn/30' : ''}`}>
          <div>
            <p className="text-[12px] font-medium uppercase tracking-wider text-ink-3">Runway</p>
            <p className="font-display text-[40px] leading-none text-ink">{runway.weeks}<span className="ml-1 font-sans text-[15px] text-ink-3">weeks</span></p>
          </div>
          <div className="min-w-48 flex-1">
            <span className="block h-2 overflow-hidden rounded-full bg-line" aria-hidden="true"><span className={`block h-full rounded-full ${low ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${Math.min(100, Math.round((runway.weeks / 6) * 100))}%` }} /></span>
            <p className="mt-2 text-[13px] text-ink-2">{runway.firms} good-fit firm{runway.firms === 1 ? '' : 's'} left to contact at {runway.perWeek} new emails a week.{low && ' Add a few below to stay ahead.'}</p>
          </div>
        </Card>
        {added && <p role="status" className="fade-in mb-6 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-3 text-[13.5px] text-accent-text"><I.check width={16} height={16} />Added. Their card is in your queue now; news and LinkedIn arrive with the next run.</p>}
        {error && <p role="alert" className="mb-6 rounded-xl bg-danger-soft px-4 py-3 text-[13.5px] text-danger">{error === 'manual' ? 'Name and firm are required.' : 'Something went wrong. Try again.'}</p>}

        <SectionTitle count={fresh.length} tone="accent" hint="Each adds a new firm, so a new outreach slot">From your research, at new firms</SectionTitle>
        <p className="-mt-1 mb-4 text-[13px] text-ink-3">None reached a &quot;good&quot; fit score, so read the why-fit before adding. When you add someone, your choice queues them for outreach.</p>
        {fresh.length ? <ul className="grid gap-3">{fresh.map(row)}</ul> : <Card className="p-6 text-center text-[14px] text-ink-3">None left.</Card>}

        <details className="group mt-10 rounded-2xl bg-surface-2/70 ring-1 ring-line">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 text-[14px] font-medium text-ink">
            <I.chevron width={16} height={16} className="text-ink-3 transition-transform group-open:rotate-180" />
            More partners at firms you already track<span className="font-mono text-[12px] text-ink-3">{more.length}</span>
          </summary>
          <p className="px-4 pb-2 text-[13px] text-ink-3">A second route into a firm. The plan reaches out to one partner per firm, so these add no new slot.</p>
          <ul className="grid gap-3 px-3 pb-3">{more.map(row)}</ul>
        </details>

        <Card className="mt-10 p-5">
          <SectionTitle tone="info">Add someone else</SectionTitle>
          <form action={addManual} className="grid gap-3 sm:grid-cols-3">
            <input name="name" required maxLength={120} placeholder="Name" aria-label="Name" className={inputCls} />
            <input name="firm" required maxLength={120} placeholder="Firm" aria-label="Firm" className={inputCls} />
            <input name="linkedin" maxLength={300} placeholder="LinkedIn profile URL (optional)" aria-label="LinkedIn profile URL" className={inputCls} />
            <div className="sm:col-span-3"><button className={btn('primary', 'md')}><I.plus width={15} height={15} />Add to pipeline</button></div>
          </form>
          <p className="mt-3 text-[12.5px] text-ink-3">Without research, fit starts weak, but your choice still queues them. With the LinkedIn URL, their posts arrive with the next weekly check.</p>
        </Card>
      </main>
    </>
  );
}
