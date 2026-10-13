'use client';
// App-wide error boundary: a failed server action or data load shows a calm, recoverable message, not a blank page.
import Link from 'next/link';
import { btn, I } from '@/components/ui';

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-start justify-center px-4">
      <span className="mb-4 flex h-10 w-10 items-center justify-center border border-danger/40 text-danger"><I.alert width={20} height={20} /></span>
      <h1 className="text-[34px] font-medium leading-tight tracking-[-0.03em] text-ink">Something didn&apos;t load.</h1>
      <p className="mt-2 text-[14px] text-ink-2">Usually a network blip or the database waking up. Nothing you saved before this was lost.</p>
      <div className="mt-6 flex gap-2">
        <button type="button" onClick={reset} className={btn('primary', 'md')}>Try again</button>
        <Link href="/" className={btn('secondary', 'md')}>Back to this week</Link>
      </div>
    </main>
  );
}
