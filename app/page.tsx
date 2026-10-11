// Phase 1: a plain table of vcs. The full dashboard (sections, evidence drawer, edits) is Phase 3.
import Link from 'next/link';
import { db } from '@/lib/db';
import { loadPersona } from '@/lib/store';
import type { VcRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const ist = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' }) + ' IST' : '—';

export default async function Home() {
  const [vcsRes, runRes, creditsRes, persona] = await Promise.all([
    db().from('vcs').select('*').order('follow_up_score', { ascending: false, nullsFirst: false }).order('name'),
    db().from('runs').select('status, trigger, started_at, finished_at').order('started_at', { ascending: false }).limit(1),
    db().from('runs').select('tavily_credits').gte('started_at', new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()),
    loadPersona(),
  ]);
  if (vcsRes.error) throw new Error(vcsRes.error.message);
  const vcs = (vcsRes.data ?? []) as VcRow[];
  const run = runRes.data?.[0];
  const credits = (creditsRes.data ?? []).reduce((s, r) => s + (r.tavily_credits ?? 0), 0);

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm text-neutral-600">
        <h1 className="text-lg font-semibold text-neutral-900">VC pipeline</h1>
        <span>Last run: {run ? `${ist(run.finished_at ?? run.started_at)} · ${run.status} (${run.trigger})` : 'never'}</span>
        <span>Next run: Mon &amp; Thu 06:00 IST</span>
        <span>Tavily credits this month: {credits}</span>
      </header>
      <section className="mb-5 space-y-1 rounded border border-neutral-200 px-3 py-2 text-sm">
        <p className="line-clamp-1" title={persona.targetSpace}><span className="text-neutral-500">Target space:</span> {persona.targetSpace}</p>
        <p className="line-clamp-1" title={persona.myProduct || 'Not set'}>
          <span className="text-neutral-500">My product:</span> {persona.myProduct || <em className="text-neutral-500">not set (competitor flags off)</em>}
        </p>
        <p><Link href="/settings" className="text-neutral-600 underline">Edit</Link></p>
      </section>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-neutral-500">
              <th className="py-2 pr-3">Name</th><th className="pr-3">Firm</th><th className="pr-3">Status</th>
              <th className="pr-3">Score <span className="text-xs">auto</span></th>
              <th className="pr-3">Action <span className="text-xs">auto</span></th>
              <th className="pr-3">Summary <span className="text-xs">auto</span></th>
              <th className="pr-3">Last signal <span className="text-xs">auto</span></th>
            </tr>
          </thead>
          <tbody>
            {vcs.map((v) => (
              <tr key={v.id} className="border-b align-top">
                <td className="py-2 pr-3 font-medium">{v.name}</td>
                <td className="pr-3">{v.firm}</td>
                <td className="pr-3">{v.status.replace(/_/g, ' ')}</td>
                <td className="pr-3 tabular-nums">{v.follow_up_score ?? '—'}</td>
                <td className="pr-3">{v.recommended_action ?? '—'}</td>
                <td className="pr-3 text-neutral-700">{v.signal_summary ?? '—'}</td>
                <td className="pr-3 whitespace-nowrap">{v.last_signal_date ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
