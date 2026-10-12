// SPEC §11.8: thumbs-based precision (up ÷ (up + down)) overall and by signal type, plus item counts from the last run.
import Link from 'next/link';
import { ist } from '@/components/format';
import { db } from '@/lib/db';
import { loadFunnel } from '@/lib/outcomes';

export const dynamic = 'force-dynamic';

const pct = (n: number, d: number) => (d ? `${Math.round((100 * n) / d)}%` : '—');

export default async function QualityPage() {
  const [fbR, runR] = await Promise.all([
    db().from('signal_feedback').select('verdict, signals(signal_type)'),
    db().from('runs').select('id, started_at, finished_at, status, trigger').order('started_at', { ascending: false }).limit(1),
  ]);
  if (fbR.error) throw new Error(fbR.error.message);
  const run = runR.data?.[0] ?? null;

  type Row = { verdict: 'up' | 'down'; signals: { signal_type: string | null } | { signal_type: string | null }[] | null };
  const fb = (fbR.data ?? []) as Row[];
  const typeOf = (r: Row) => (Array.isArray(r.signals) ? r.signals[0]?.signal_type : r.signals?.signal_type) ?? 'unknown';
  const byType = new Map<string, { up: number; down: number }>();
  for (const r of fb) {
    const t = byType.get(typeOf(r)) ?? { up: 0, down: 0 };
    t[r.verdict]++;
    byType.set(typeOf(r), t);
  }
  const up = fb.filter((r) => r.verdict === 'up').length, down = fb.length - up;

  // Items collected in the last run (by created_at) and everything currently stored.
  const counts = async (since?: string, until?: string) => {
    let q = db().from('signals').select('status, published_at, date_approx');
    if (since) q = q.gte('created_at', since);
    if (until) q = q.lte('created_at', until);
    const r = await q;
    const rows = (r.data ?? []) as { status: string; published_at: string | null; date_approx: boolean }[];
    return {
      accepted: rows.filter((x) => x.status === 'accepted').length,
      rejected: rows.filter((x) => x.status === 'rejected').length,
      undated: rows.filter((x) => !x.published_at).length,
      pending: rows.filter((x) => x.status === 'pending' || x.status === 'unclassified').length,
    };
  };
  const [lastRun, all, funnel] = await Promise.all([run ? counts(run.started_at, run.finished_at ?? undefined) : null, counts(), loadFunnel()]);
  const rate = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="mb-4 text-sm"><Link href="/" className="text-neutral-500 hover:underline">← Dashboard</Link></p>
      <h1 className="mb-6 text-lg font-semibold">Quality</h1>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Your thumbs</h2>
        <p className="mb-3 text-sm text-neutral-700">Precision = 👍 ÷ (👍 + 👎). Overall: <strong>{pct(up, fb.length)}</strong> from {fb.length} rated signal{fb.length === 1 ? '' : 's'} ({up} 👍, {down} 👎).</p>
        {byType.size > 0 ? (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-neutral-500"><th className="py-1">Signal type</th><th>👍</th><th>👎</th><th>Precision</th></tr></thead>
            <tbody>
              {[...byType.entries()].sort().map(([t, v]) => (
                <tr key={t} className="border-b"><td className="py-1 capitalize">{t}</td><td>{v.up}</td><td>{v.down}</td><td>{pct(v.up, v.up + v.down)}</td></tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-neutral-500">No ratings yet. Use 👍/👎 in a VC&apos;s evidence drawer.</p>}
      </section>

      <section className="mb-8">
        <h2 className="mb-2 font-medium">Outreach outcomes</h2>
        <p className="mb-3 text-sm text-neutral-700">From your one-click logging and status edits: of the VCs you emailed, how many replied or booked a meeting.</p>
        {funnel.total.emailed === 0 ? <p className="text-sm text-neutral-500">No emails logged yet. Use “Emailed today” on a card.</p> : (
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-neutral-500"><th className="py-1"></th><th>Emailed</th><th>Replied</th><th>Meeting</th><th>Reply rate</th><th>Meeting rate</th></tr></thead>
            <tbody>
              {[funnel.total, ...funnel.byFit.map((r) => ({ ...r, group: `${r.group} fit` })), ...funnel.byHook].map((r) => (
                <tr key={r.group} className="border-b"><td className="py-1 capitalize">{r.group}</td><td>{r.emailed}</td><td>{r.replied}</td><td>{r.meeting}</td><td>{rate(r.replyRate)}</td><td>{rate(r.meetingRate)}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-neutral-500">Rankings are recalibrated on outcomes only once there are at least 20 logged emails.</p>
      </section>

      <section>
        <h2 className="mb-2 font-medium">Items</h2>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-neutral-500"><th className="py-1"></th><th>Accepted</th><th>Rejected</th><th>Undated</th><th>Pending</th></tr></thead>
          <tbody>
            {lastRun && (
              <tr className="border-b"><td className="py-1">Collected in the last run <span className="text-xs text-neutral-500">({ist(run!.started_at)}, {run!.trigger})</span></td>
                <td>{lastRun.accepted}</td><td>{lastRun.rejected}</td><td>{lastRun.undated}</td><td>{lastRun.pending}</td></tr>
            )}
            <tr className="border-b"><td className="py-1">All stored</td><td>{all.accepted}</td><td>{all.rejected}</td><td>{all.undated}</td><td>{all.pending}</td></tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-neutral-500">Undated items pass to the classifier but are never scored, except Tavily results marked “date approx”, which are scored as 30 days old.</p>
      </section>
    </main>
  );
}
