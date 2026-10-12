// SPEC §11 dashboard: the decision first (This week), the proof one click away (evidence drawer).
import Link from 'next/link';
import RunNow from '@/components/RunNow.client';
import VcCard from '@/components/VcCard.client';
import { ist } from '@/components/format';
import { loadDashboard, loadHeader, nextScheduledRun, SECTIONS } from '@/lib/dashboard';
import { loadPersona } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const [{ vcs }, header, persona] = await Promise.all([loadDashboard(), loadHeader(), loadPersona()]);
  const run = header.lastRun;

  return (
    <main className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">VC pipeline</h1>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/quality" className="text-neutral-600 hover:underline">Quality</Link>
            <Link href="/settings" className="text-neutral-600 hover:underline">Settings</Link>
            <RunNow />
          </nav>
        </div>
        <p className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-600">
          <span>Last run: {run ? `${ist(run.finished_at ?? run.started_at)} · ${run.status} (${run.trigger}) · ${run.processed} VCs` : 'never'}</span>
          <span>Next run: {ist(nextScheduledRun().toISOString())}</span>
          <span>Tavily credits this month: {header.credits}</span>
        </p>
        <div className="rounded border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          <p className="line-clamp-1" title={persona.targetSpace}><span className="text-neutral-500">Target space:</span> {persona.targetSpace}</p>
          <p className="line-clamp-1" title={persona.myProduct || 'Not set'}>
            <span className="text-neutral-500">My product:</span> {persona.myProduct || <em>not set (competitor flags off)</em>}
            {' '}<Link href="/settings" className="underline">Edit</Link>
          </p>
        </div>
      </header>

      {SECTIONS.map((sec) => {
        const list = vcs.filter((v) => v.section === sec.key);
        if (sec.key === 'thisWeek') {
          return (
            <section key={sec.key} className="mb-6">
              <h2 className="mb-2 text-lg font-semibold">This week <span className="text-sm font-normal text-neutral-500">({list.length}, by score)</span></h2>
              {list.length ? <div className="space-y-2">{list.map((v) => <VcCard key={v.id} vc={v} />)}</div>
                : <p className="rounded border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-600">No VC has a strong enough recent signal this week.</p>}
            </section>
          );
        }
        if (!list.length) return null;
        return (
          <details key={sec.key} className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50/60">
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium">{sec.title} <span className="font-normal text-neutral-500">({list.length})</span></summary>
            <div className="space-y-2 px-3 pb-3">{list.map((v) => <VcCard key={v.id} vc={v} />)}</div>
          </details>
        );
      })}
    </main>
  );
}
