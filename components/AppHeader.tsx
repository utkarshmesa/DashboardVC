// Shared top bar: wordmark, navigation, run status and Run now (SPEC §11.1).
import Link from 'next/link';
import RunNow from './RunNow.client';
import { ist } from './format';
import { I } from './ui';

const NAV = [
  { href: '/', label: 'This week', code: '01' },
  { href: '/investors', label: 'Investors', code: '02' },
  { href: '/quality', label: 'Quality', code: '03' },
  { href: '/settings', label: 'Settings', code: '04' },
] as const;

export default function AppHeader({ active, run, nextRun, credits }: {
  active: (typeof NAV)[number]['href'];
  run?: { finished_at: string | null; started_at: string; status: string; trigger: string; processed: number } | null;
  nextRun?: string;
  credits?: number;
}) {
  return (
    <>
      <a href="#main" className="sr-only fixed left-3 top-3 z-50 bg-accent px-3 py-2 text-[13px] font-medium text-accent-ink focus:not-sr-only">Skip to content</a>
      <header className="sticky top-0 z-20 border-b border-line bg-paper/90 backdrop-blur-md">
        <span data-progress="" aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px origin-left bg-signal" />
        <div className="mx-auto flex h-14 max-w-[1240px] items-center gap-6 px-4 sm:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3" aria-label="Pipeline home">
            <span className="flex h-7 w-7 items-center justify-center border border-ink text-ink"><I.route width={15} height={15} data-draw="" /></span>
            <span className="text-[14px] font-semibold tracking-[0.02em]">PIPELINE</span>
            <span className="hidden font-mono text-[10.5px] tracking-[0.14em] text-ink-3 sm:inline">/ SEED · USD 1–3M</span>
          </Link>
          <nav aria-label="Main" className="ml-auto hidden items-stretch self-stretch md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} aria-current={active === n.href ? 'page' : undefined}
                className={`relative flex items-center gap-2 px-4 text-[13px] transition-colors ${active === n.href ? 'text-ink' : 'text-ink-3 hover:text-ink'}`}>
                <span className="font-mono text-[10px] text-ink-3">{n.code}</span>{n.label}
                {active === n.href && <span className="absolute inset-x-4 bottom-0 h-px bg-ink" aria-hidden="true" />}
              </Link>
            ))}
          </nav>
          <span className="ml-auto md:ml-2">
            <RunNow />
          </span>
        </div>
        {/* Mobile nav */}
        <nav aria-label="Main mobile" className="flex border-t border-line md:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active === n.href ? 'page' : undefined}
              className={`flex-1 py-2.5 text-center text-[12.5px] ${active === n.href ? 'border-b border-ink text-ink' : 'text-ink-3'}`}>{n.label}</Link>
          ))}
        </nav>
        {run !== undefined && (
          <div className="border-t border-line">
            <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3 sm:px-8">
              <span className="inline-flex items-center gap-2">
                {run?.status === 'done' ? <span className="live-dot" aria-hidden="true" /> : <span className="h-1.5 w-1.5 bg-signal" aria-hidden="true" />}
                {run ? <>Updated {ist(run.finished_at ?? run.started_at)} · {run.processed} VCs · {run.status}</> : 'Never run'}
              </span>
              {nextRun && <span>Next run {ist(nextRun)}</span>}
              {credits !== undefined && <span className="hidden sm:inline">Tavily {credits}/800</span>}
            </div>
          </div>
        )}
      </header>
    </>
  );
}
