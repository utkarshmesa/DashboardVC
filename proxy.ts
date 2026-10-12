// SPEC §10 password gate. Next.js 16 renamed middleware.ts to proxy.ts (Node runtime); see docs/DECISIONS.md.
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/session';

const PUBLIC = ['/login', '/api/cron', '/api/run/step', '/api/digest']; // the API ones check Bearer CRON_SECRET

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET ?? '')) return NextResponse.next();
  if (pathname.startsWith('/api/')) return new NextResponse('Unauthorized', { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
