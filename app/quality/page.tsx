// SPEC §11.8: thumbs-based precision (up ÷ (up + down)) overall and by signal type, plus item counts from the last run.
import AppHeader from '@/components/AppHeader';
import { PageTitle, SectionTitle } from '@/components/ui';
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

  const th = 'py-2.5 pr-3 text-left font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-ink-3';
  const td = 'py-2.5 pr-3 font-mono text-[13px] tabular-nums text-ink';
  const big = (code: string, label: string, value: string, note: string) => (
    <div data-reveal="" className="px-5 py-5">
      <p className="label flex justify-between"><span data-scramble="">{label}</span><span>{code}</span></p>
      <p className="mt-4 font-mono text-[40px] font-light leading-none tracking-[-0.04em] text-ink">{value}</p>
      <p className="mt-3 text-[12.5px] text-ink-2">{note}</p>
    </div>
  );
  return (
    <>
      <AppHeader active="/quality" />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1040px] px-4 pb-28 pt-12 outline-none sm:px-8">
        <PageTitle eyebrow="03 / Quality · Feedback loop" title="Is it working?" sub="Replies to your outreach, how often the signals are right by your own judgement, and what the last run collected." />

        <section className="mb-12 grid grid-cols-1 divide-y divide-line border-y border-line sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {big('Q1', 'Emails logged', String(funnel.total.emailed), 'From one-click logging and status edits')}
          {big('Q2', 'Reply rate', rate(funnel.total.replyRate), `${funnel.total.replied} replied · ${funnel.total.meeting} meeting${funnel.total.meeting === 1 ? '' : 's'}`)}
          {big('Q3', 'Signal precision', pct(up, fb.length), `From ${fb.length} rated signal${fb.length === 1 ? '' : 's'} (${up} up, ${down} down)`)}
        </section>

        <section data-reveal="" className="mb-12">
          <SectionTitle index="§1" tone="accent" hint="Of the investors you emailed, how many replied or booked a meeting">Outreach outcomes</SectionTitle>
          {funnel.total.emailed === 0 ? <p className="border border-dashed border-line-2 px-4 py-6 text-center text-[13.5px] text-ink-3">No emails logged yet. Use <strong className="text-ink-2">Mark as sent</strong> or the <strong className="text-ink-2">Sent it?</strong> prompt on a card.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-line"><th className={th}>Group</th><th className={th}>Emailed</th><th className={th}>Replied</th><th className={th}>Meeting</th><th className={th}>Reply rate</th><th className={th}>Meeting rate</th></tr></thead>
                <tbody>
                  {[funnel.total, ...funnel.byFit.map((r) => ({ ...r, group: `${r.group} fit` })), ...funnel.byHook].map((r) => (
                    <tr key={r.group} className="border-b border-line last:border-0"><td className="py-2.5 pr-3 text-[13.5px] capitalize text-ink">{r.group}</td><td className={td}>{r.emailed}</td><td className={td}>{r.replied}</td><td className={td}>{r.meeting}</td><td className={td}>{rate(r.replyRate)}</td><td className={td}>{rate(r.meetingRate)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[12px] text-ink-3">Rankings get recalibrated on real outcomes once at least 20 emails are logged.</p>
        </section>

        <section data-reveal="" className="mb-12">
          <SectionTitle index="§2" tone="info" hint="Precision = thumbs up ÷ (up + down), from the Evidence tab on each card">Your ratings</SectionTitle>
          {byType.size > 0 ? (
            <table className="w-full">
              <thead><tr className="border-b border-line"><th className={th}>Signal type</th><th className={th}>Up</th><th className={th}>Down</th><th className={th}>Precision</th></tr></thead>
              <tbody>
                {[...byType.entries()].sort().map(([t, v]) => (
                  <tr key={t} className="border-b border-line last:border-0"><td className="py-2.5 pr-3 text-[13.5px] capitalize text-ink">{t}</td><td className={td}>{v.up}</td><td className={td}>{v.down}</td><td className={td}>{pct(v.up, v.up + v.down)}</td></tr>
                ))}
              </tbody>
            </table>
          ) : <p className="border border-dashed border-line-2 px-4 py-6 text-center text-[13.5px] text-ink-3">No ratings yet. Open a card&apos;s Evidence tab and rate a few signals.</p>}
        </section>

        <section data-reveal="">
          <SectionTitle index="§3" hint="Undated items aren't scored, except Tavily results marked date approx (scored as 30 days old)">Items collected</SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-line"><th className={th}><span className="sr-only">Scope</span></th><th className={th}>Accepted</th><th className={th}>Rejected</th><th className={th}>Undated</th><th className={th}>Pending</th></tr></thead>
              <tbody>
                {lastRun && (
                  <tr className="border-b border-line"><td className="py-2.5 pr-3 text-[13.5px] text-ink">Last run <span className="block text-[12px] text-ink-3">{ist(run!.started_at)} · {run!.trigger}</span></td>
                    <td className={td}>{lastRun.accepted}</td><td className={td}>{lastRun.rejected}</td><td className={td}>{lastRun.undated}</td><td className={td}>{lastRun.pending}</td></tr>
                )}
                <tr><td className="py-2.5 pr-3 text-[13.5px] text-ink">All stored</td><td className={td}>{all.accepted}</td><td className={td}>{all.rejected}</td><td className={td}>{all.undated}</td><td className={td}>{all.pending}</td></tr>
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </>
  );
}
