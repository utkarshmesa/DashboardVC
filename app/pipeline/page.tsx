// Pipeline (Plan V2): all investors in one table, shaped like Vikram's spreadsheet and his Supabase table.
import Link from 'next/link';
import AppHeader from '@/components/AppHeader';
import PipelineTable from '@/components/PipelineTable.client';
import { btn, I, PageTitle } from '@/components/ui';
import { loadDashboard, loadHeader, nextScheduledRun } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

export default async function PipelinePage() {
  const [{ vcs }, header] = await Promise.all([loadDashboard(), loadHeader()]);
  return (
    <>
      <AppHeader active="/pipeline" run={header.lastRun} nextRun={nextScheduledRun().toISOString()} credits={header.credits} />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[1400px] px-4 pb-28 pt-12 outline-none sm:px-8">
        <PageTitle eyebrow="02 / Pipeline · All investors" title="Every investor, one table."
          sub="The same columns as your Supabase table: your status, last contact and notes, plus the four columns the pipeline updates twice a week (last signal, summary, follow-up score, recommended action). Click a row for the full dossier." />
        <div className="mb-6 flex flex-wrap gap-2">
          <Link href="/investors" className={btn('secondary')}><I.plus width={14} height={14} />Add investors</Link>
        </div>
        <PipelineTable vcs={vcs} />
      </main>
    </>
  );
}
