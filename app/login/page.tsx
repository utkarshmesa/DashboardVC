import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { btn, I, inputCls } from '@/components/ui';
import { serverEnv } from '@/lib/env';
import { SESSION_COOKIE, SESSION_MAX_AGE_S, safeEqual, signSession } from '@/lib/session';

async function login(formData: FormData) {
  'use server';
  const env = serverEnv(['session']);
  const password = String(formData.get('password') ?? '');
  if (!safeEqual(password, env.dashboardPassword)) redirect('/login?error=1');
  (await cookies()).set(SESSION_COOKIE, signSession(env.sessionSecret), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE_S,
  });
  redirect('/');
}

// Owner sign-in. Viewing needs no password (DECISIONS #53); signing in unlocks logging outreach, edits and Run now.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="grid-bg" aria-hidden="true" />
      <div className="relative z-[1] w-full max-w-[380px] border border-line bg-paper/80 p-8 backdrop-blur-sm">
        <span className="tick -left-[5px] -top-[5px]" aria-hidden="true" /><span className="tick -right-[5px] -top-[5px]" aria-hidden="true" />
        <span className="tick -bottom-[5px] -left-[5px]" aria-hidden="true" /><span className="tick -bottom-[5px] -right-[5px]" aria-hidden="true" />
        <div className="mb-10 flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center border border-ink text-ink"><I.route width={15} height={15} data-draw="" /></span>
          <span className="text-[14px] font-semibold tracking-[0.02em]">PIPELINE</span>
          <span className="ml-auto label" data-scramble="">Owner access</span>
        </div>
        <h1 className="text-[34px] font-medium leading-[1.02] tracking-[-0.04em] text-ink">
          <span className="mask-line"><span data-line="">Your seed round,</span></span>
          <span className="mask-line"><span data-line="" className="text-ink-3">one screen.</span></span>
        </h1>
        <p data-reveal="" className="mt-4 text-[13.5px] leading-relaxed text-ink-2">Sign in to log outreach, edit notes and settings, and run the pipeline.</p>
        <form action={login} data-reveal="" className="mt-8 grid gap-2.5">
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" className={inputCls} />
          {error && <p role="alert" className="font-mono text-[11px] uppercase tracking-[0.1em] text-danger">Wrong password. Try again.</p>}
          <button type="submit" className={`${btn('primary', 'md')} mt-2 w-full`}>Sign in <I.arrow width={14} height={14} /></button>
        </form>
        <Link href="/" data-reveal="" className="mt-6 block font-mono text-[10.5px] uppercase tracking-[0.14em] text-ink-3 hover:text-ink">← Continue view-only</Link>
      </div>
    </main>
  );
}
