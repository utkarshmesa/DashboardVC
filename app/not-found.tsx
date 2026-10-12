import Link from 'next/link';
import { btn } from '@/components/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-md flex-col items-start justify-center px-4">
      <p className="mb-2 font-mono text-[13px] text-ink-3">404</p>
      <h1 className="font-display text-[34px] leading-tight text-ink">This page doesn&apos;t exist.</h1>
      <Link href="/" className={`${btn('primary', 'md')} mt-6`}>Back to this week</Link>
    </main>
  );
}
