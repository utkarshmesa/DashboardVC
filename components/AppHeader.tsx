// Shared top bar: wordmark, navigation, run status and Run now (SPEC §11.1).
import Link from 'next/link';
import RunNow from './RunNow.client';
import { ist } from './format';
import { I } from './ui';

const NAV = [
  { href: '/', label: 'This week' },
  { href: '/investors', label: 'Investors' },
  { href: '/quality', label: 'Quality' },
  { href: '/settings', label: 'Settings' },
] as const;

export default function AppHeader({ active, run, nextRun, credits }: {
  active: (typeof NAV)[number]['href'];
  run?: { finished_at: string | null; started_at: string; status: string; trigger: string; processed: number } | null;
  nextRun?: string;
  credits?: number;
}) {
  return (
    <>
    <a href="#main" className="sr-only fixed left-3 top-3 z-50 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-ink focus:not-sr-only">Skip to content</a>
    <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:flex-nowrap sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Pipeline home">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-accent-ink shadow-card">
            <I.route width={17} height={17} />
          </span>
          <span className="font-display text-[22px] leading-none tracking-tight">Pipeline</span>
        </Link>
        <nav aria-label="Main" className="order-3 -mx-1 flex w-full min-w-0 items-center gap-0.5 overflow-x-auto px-1 sm:order-none sm:ml-4 sm:w-auto sm:flex-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active === n.href ? 'page' : undefined}
              className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[13.5px] font-medium transition-colors ${active === n.href ? 'bg-surface text-ink shadow-card ring-1 ring-line' : 'text-ink-2 hover:bg-surface-2 hover:text-ink'}`}>
              {n.label}
            </Link>
          ))}
        </nav>
        <span className="ml-auto sm:ml-0"><RunNow /></span>
      </div>
      {run !== undefined && (
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-4 pb-2.5 text-[12px] text-ink-3 sm:px-6">
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${run?.status === 'done' ? 'bg-accent' : run ? 'bg-warn' : 'bg-ink-3'}`} aria-hidden="true" />
            {run ? <>Updated {ist(run.finished_at ?? run.started_at)} · {run.processed} VCs · {run.status} ({run.trigger})</> : 'Never run'}
          </span>
          {nextRun && <span className="inline-flex items-center gap-1.5"><I.clock width={13} height={13} />Next run {ist(nextRun)}</span>}
          {credits !== undefined && <span className="hidden sm:inline">Tavily {credits}/800 credits this month</span>}
        </div>
      )}
    </header>
    </>
  );
}
