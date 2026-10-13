// Pipeline (Plan V2): all investors in one table, shaped like Vikram's spreadsheet and his Supabase table.
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import PipelineTable from '@/components/PipelineTable.client';
import { btn, PageTitle } from '@/components/ui';
import { redirect } from 'next/navigation';
import { loadDashboard, loadHeader, nextScheduledRun } from '@/lib/dashboard';
import { importSpreadsheet } from '@/lib/import';

export const dynamic = 'force-dynamic';

async function importSheet(formData: FormData) {
  'use server';
  const file = formData.get('file');
  if (!(file instanceof File) || !file.size) redirect('/pipeline?imp=empty');
  if (file.size > 1_000_000) redirect('/pipeline?imp=big');
  const r = await importSpreadsheet(await file.text());
  const q = new URLSearchParams(r.error ? { imperr: r.error } : { imp: 'ok', u: String(r.updated), a: String(r.added), n: String(r.unchanged), i: r.issues.slice(0, 6).map((x) => `Row ${x.line}: ${x.reason}`).join('|') });
  redirect(`/pipeline?${q}`);
}

export default async function PipelinePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ vcs }, header, sp] = await Promise.all([loadDashboard(), loadHeader(), searchParams]);
  return (
    <>
      <AppHeader active="/pipeline" run={header.lastRun} nextRun={nextScheduledRun().toISOString()} credits={header.credits} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1400px] px-4 pb-28 pt-12 outline-none sm:px-8">
        <PageTitle eyebrow="02 / Pipeline · All investors" title="Every investor, one table."
          sub="The same columns as your Supabase table: your status, last contact and notes, plus the four columns the pipeline updates twice a week (last signal, summary, follow-up score, recommended action). Click a row for the full dossier." />
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <form action={importSheet} className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
              <span className="label">Your spreadsheet (.csv)</span>
              <input type="file" name="file" accept=".csv,text/csv" required
                className="max-w-[260px] text-[12px] text-ink-2 file:mr-2 file:h-8 file:cursor-pointer file:border file:border-line-2 file:bg-transparent file:px-3 file:text-[12.5px] file:text-ink hover:file:border-ink-3" />
            </label>
            <button type="submit" className={btn('primary')}>Import</button>
          </form>
          <a href="/api/export" className={btn('ghost')}>Download as CSV</a>
          <Link href="/investors" className={btn('ghost')}>Add from research</Link>
        </div>
        <p className="mb-6 max-w-[760px] text-[12.5px] leading-relaxed text-ink-3">
          Import your existing sheet (File → Download → CSV in Google Sheets or Excel). Columns are matched by name: name, firm, thesis, status, last contact, notes.
          Statuses like &quot;waiting for a response&quot; or &quot;yet to reach out&quot; and dates like 28/09/2026 are understood. Blank cells leave what&apos;s here unchanged;
          new names are added. Only your columns are written, never the four the pipeline updates. Click a status or note in the table to edit it.
        </p>
        {sp.imp === 'ok' && (
          <div role="status" className="mb-6 border-l-2 border-accent-text bg-accent-soft px-4 py-3 text-[13px] text-ink">
            Imported: {sp.u} updated, {sp.a} added, {sp.n} already up to date.{Number(sp.a) > 0 && ' New investors get signals on the next run (or press Run now).'}
            {sp.i && <ul className="mt-1.5 list-disc pl-5 text-[12.5px] text-ink-2">{sp.i.split('|').map((x) => <li key={x}>{x}</li>)}</ul>}
          </div>
        )}
        {(sp.imperr || sp.imp === 'empty' || sp.imp === 'big') && (
          <p role="alert" className="mb-6 border-l-2 border-danger bg-danger-soft px-4 py-3 text-[13px] text-danger">
            {sp.imperr ?? (sp.imp === 'big' ? 'That file is over 1 MB. Export just the investor sheet.' : 'Choose a CSV file first.')}
          </p>
        )}
        <PipelineTable vcs={vcs} />
      </main>
    </>
  );
}
