import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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
    <main className="mx-auto mt-24 max-w-sm px-4">
      <h1 className="mb-6 text-xl font-semibold">VC pipeline</h1>
      <form action={login} className="space-y-3">
        <input name="password" type="password" required autoFocus placeholder="Password"
          className="w-full rounded border border-neutral-300 px-3 py-2" />
        {error && <p className="text-sm text-red-600">Wrong password.</p>}
        <button type="submit" className="w-full rounded bg-neutral-900 px-3 py-2 text-white">Sign in</button>
      </form>
    </main>
  );
}
