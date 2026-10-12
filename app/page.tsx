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

      {(() => {
        const f = vcs.filter((v) => v.section === 'followups'), c = vcs.filter((v) => v.section === 'conflict');
        // Warm cards are optional ("if capacity"), so they are counted separately from the committed emails.
        const all = vcs.filter((v) => v.section === 'thisWeek'), o = all.filter((v) => !v.action.startsWith('Warm')), w = all.length - o.length;
        const names = (xs: typeof vcs) => xs.slice(0, 6).map((v, i) => <span key={v.id}>{i ? ', ' : ''}<a href={`#vc-${v.id}`} className="underline decoration-neutral-300 hover:decoration-neutral-700">{v.name}</a></span>);
        return (
          <p className="mb-5 rounded border border-neutral-200 bg-white px-3 py-2 text-sm" aria-label="This week at a glance">
            <strong>This week:</strong>{' '}
            {f.length > 0 && <>{f.length} follow-up{f.length === 1 ? '' : 's'} due ({names(f)}) · </>}
            {o.length} email{o.length === 1 ? '' : 's'} to send{o.length ? <> ({names(o)}{o.length > 6 ? ', …' : ''})</> : ''}
            {w > 0 && <>, plus {w} optional if you have capacity</>}
            {c.length > 0 && <> · {c.length} conflict{c.length === 1 ? '' : 's'} to check</>}
          </p>
        );
      })()}

      {SECTIONS.map((sec) => {
        const list = vcs.filter((v) => v.section === sec.key);
        if (sec.key === 'followups' || sec.key === 'thisWeek') {
          if (sec.key === 'followups' && !list.length) return null;
          return (
            <section key={sec.key} className="mb-6">
              <h2 className="mb-2 text-lg font-semibold">{sec.title} <span className="text-sm font-normal text-neutral-500">
                ({list.length}{sec.key === 'thisWeek' ? ', best fit first' : ', longest waiting first'})</span></h2>
              {list.length ? <div className="space-y-2">{list.map((v) => <VcCard key={v.id} vc={v} />)}</div>
                : <p className="rounded border border-dashed border-neutral-300 px-3 py-4 text-sm text-neutral-600">No new outreach suggested this week.</p>}
            </section>
          );
        }
        if (!list.length) return null;
        return (
          <details key={sec.key} className={`mb-3 rounded-lg border ${sec.key === 'conflict' ? 'border-rose-200 bg-rose-50/40' : 'border-neutral-200 bg-neutral-50/60'}`}>
            <summary className="cursor-pointer px-4 py-2 text-sm font-medium">{sec.title} <span className="font-normal text-neutral-500">({list.length})</span></summary>
            <div className="space-y-2 px-3 pb-3">{list.map((v) => <VcCard key={v.id} vc={v} />)}</div>
          </details>
        );
      })}
    </main>
  );
}
