// SPEC §10 session cookie: "<expiryMs>.<hmac-sha256-hex>", signed with SESSION_SECRET, valid 30 days.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'vcp_session';
export const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

const mac = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('hex');

export function signSession(secret: string, now = Date.now()): string {
  const exp = String(now + SESSION_MAX_AGE_S * 1000);
  return `${exp}.${mac(exp, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): boolean {
  if (!token || !secret) return false;
  const [exp, sig] = token.split('.');
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < now) return false;
  const want = Buffer.from(mac(exp, secret), 'hex');
  const got = Buffer.from(sig, 'hex');
  return got.length === want.length && timingSafeEqual(got, want);
}

// Constant-time string comparison (hash both sides so lengths match).
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function bearerOk(header: string | null, secret: string): boolean {
  return !!secret && !!header && safeEqual(header, `Bearer ${secret}`);
}
