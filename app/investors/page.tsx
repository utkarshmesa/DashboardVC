// REVIEW-2 item 2: pipeline runway. Researched-but-untracked investors Vikram can add, plus any investor he names.
import Link from 'next/link';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { addCandidate, addManualVc, dismissCandidate, loadCandidates } from '@/lib/candidates';
import { loadDashboard } from '@/lib/dashboard';

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

const TONE: Record<string, string> = { strong: 'bg-emerald-50 text-emerald-800', good: 'bg-sky-50 text-sky-800', weak: 'bg-neutral-100 text-neutral-700' };

export default async function InvestorsPage({ searchParams }: { searchParams: Promise<{ added?: string; error?: string }> }) {
  const [{ added, error }, candidates, { runway }] = await Promise.all([searchParams, loadCandidates(), loadDashboard()]);
  const fresh = candidates.filter((c) => c.newFirm), more = candidates.filter((c) => !c.newFirm);
  const row = (c: (typeof candidates)[number]) => (
    <li key={c.id} className="rounded border border-neutral-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{c.name}</span>
        <span className="text-sm text-neutral-600">{c.firm}</span>
        <span className={`rounded px-1.5 py-0.5 text-[11px] ${TONE[c.label]}`}>{c.label} fit {c.fit}</span>
        {!c.newFirm && <span className="text-[11px] text-neutral-500">{c.trackedAtFirm} partner{c.trackedAtFirm === 1 ? '' : 's'} already tracked here</span>}
        <span className="ml-auto flex gap-1.5">
          <form action={add}><input type="hidden" name="id" value={c.id} /><button className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-900 hover:bg-emerald-100">Add to pipeline</button></form>
          <form action={dismiss}><input type="hidden" name="id" value={c.id} /><button className="rounded border border-neutral-300 px-2 py-0.5 text-xs text-neutral-600 hover:bg-neutral-50">Not for me</button></form>
        </span>
      </div>
      {c.whyFit && <p className="mt-1 text-xs text-neutral-700"><span className="text-neutral-500">Why fit:</span> {c.whyFit}</p>}
      <p className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-neutral-500">
        {c.cheque && <span>Cheque: {c.cheque}</span>}{c.stage && <span>Stage: {c.stage}</span>}
        {c.flags.map((f) => <span key={f} className="text-rose-700">⚠ {f}</span>)}
      </p>
    </li>
  );
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="mb-4 text-sm"><Link href="/" className="text-neutral-500 hover:underline">← Dashboard</Link></p>
      <h1 className="mb-2 text-lg font-semibold">Add investors</h1>
      <p className={`mb-4 rounded px-3 py-2 text-sm ${runway.weeks < 4 ? 'bg-amber-50 text-amber-900' : 'bg-neutral-50 text-neutral-700'}`}>
        Runway: <strong>{runway.firms}</strong> good-fit firm{runway.firms === 1 ? '' : 's'} left to contact, about <strong>{runway.weeks} weeks</strong> at {runway.perWeek} new emails a week.
        {runway.weeks < 4 && ' Add investors below to keep the pipeline full.'}
      </p>
      {added && <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-800">Added. The card is on the dashboard now; news and LinkedIn arrive with the next run.</p>}
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800">{error === 'manual' ? 'Name and firm are required.' : 'Something went wrong. Try again.'}</p>}

      <h2 className="mb-1 mt-6 font-medium">From your research, at firms you don&apos;t track yet ({fresh.length})</h2>
      <p className="mb-2 text-xs text-neutral-500">Each adds a new firm, so a new outreach slot. Fit is scored the same way as on the dashboard; none of these reached &quot;good&quot;, so read the why-fit before adding.</p>
      {fresh.length ? <ul className="space-y-2">{fresh.map(row)}</ul> : <p className="text-sm text-neutral-500">None left.</p>}

      <details className="mt-6">
        <summary className="cursor-pointer font-medium">More partners at firms you already track ({more.length})</summary>
        <p className="mb-2 mt-1 text-xs text-neutral-500">Useful as a second route, but the plan reaches out to one partner per firm, so these add no new slot.</p>
        <ul className="space-y-2">{more.map(row)}</ul>
      </details>

      <h2 className="mb-2 mt-8 font-medium">Add someone else</h2>
      <form action={addManual} className="grid gap-2 sm:grid-cols-3">
        <input name="name" required maxLength={120} placeholder="Name" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
        <input name="firm" required maxLength={120} placeholder="Firm" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
        <input name="linkedin" maxLength={300} placeholder="LinkedIn profile URL (optional)" className="rounded border border-neutral-300 px-3 py-2 text-sm" />
        <button className="rounded bg-neutral-900 px-4 py-2 text-sm text-white sm:col-span-3 sm:justify-self-start">Add to pipeline</button>
      </form>
      <p className="mt-1 text-xs text-neutral-500">Without research, fit starts weak. Add notes and thesis from the card&apos;s edit form; news and LinkedIn posts (with the profile URL) arrive with the next run.</p>
    </main>
  );
}
