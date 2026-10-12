import { cookies } from 'next/headers';
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

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="fade-in w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-card"><I.route width={18} height={18} /></span>
          <span className="font-display text-[26px] leading-none tracking-tight">Pipeline</span>
        </div>
        <h1 className="font-display text-[36px] leading-tight tracking-tight text-ink">Your seed round, <em className="text-accent-text">one screen</em>.</h1>
        <p className="mt-2 text-[14px] text-ink-2">Who to contact this week, why they fit, and how to reach them.</p>
        <form action={login} className="mt-8 grid gap-3">
          <label className="text-[13px] font-medium text-ink" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required autoFocus autoComplete="current-password" className={inputCls} />
          {error && <p role="alert" className="text-[13px] text-danger">Wrong password. Try again.</p>}
          <button type="submit" className={`${btn('primary', 'md')} mt-1 w-full`}>Sign in</button>
        </form>
      </div>
    </main>
  );
}
