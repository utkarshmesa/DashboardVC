import 'server-only';
// View-only sharing (DECISIONS #53): anyone with the link can read every page; changing anything (logging outreach,
// edits, settings, adding investors, Run now) needs the owner session. Enforced in proxy.ts and again here, inside
// each write path, so a routing mistake can never open writes.
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySession } from './session';

export async function isOwner(): Promise<boolean> {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET ?? '');
}

// Server actions: bounce visitors to the sign-in page instead of writing.
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) redirect('/login');
}

// API routes: read the session from the request's cookie header.
export function ownerFromRequest(req: Request): boolean {
  const raw = req.headers.get('cookie') ?? '';
  const token = raw.split(/;\s*/).find((c) => c.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return verifySession(token ? decodeURIComponent(token) : undefined, process.env.SESSION_SECRET ?? '');
}

export const forbidden = () => Response.json({ error: 'View-only link: sign in as the owner to make changes' }, { status: 401 });
