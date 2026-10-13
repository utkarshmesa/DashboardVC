// SPEC §10 gate, amended (DECISIONS #53): pages are viewable by anyone with the link; every write needs the owner
// session. Next.js 16 renamed middleware.ts to proxy.ts (Node runtime). Write routes re-check the session themselves.
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from './lib/session';

const PUBLIC = ['/login', '/api/cron', '/api/run/step', '/api/digest']; // the API ones check Bearer CRON_SECRET
// Read-only API a visitor's page needs (evidence list loaded on demand).
const PUBLIC_READ_API = /^\/api\/vc\/[0-9a-f-]{36}\/others$/i;

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();
  if (verifySession(req.cookies.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET ?? '')) return NextResponse.next();
  const read = req.method === 'GET' || req.method === 'HEAD';
  if (read && !pathname.startsWith('/api/')) return NextResponse.next();   // view-only pages
  if (read && PUBLIC_READ_API.test(pathname)) return NextResponse.next();
  // Anything that writes (API calls, server actions posted to a page) needs the owner.
  return new NextResponse('View-only link: sign in as the owner to make changes', { status: 401 });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
