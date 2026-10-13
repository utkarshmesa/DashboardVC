// Server-to-server auth for the scheduled routes (cron, run steps, digest): "Authorization: Bearer <CRON_SECRET>".
// The dashboard itself is open to anyone with the link (DECISIONS #54).
import { createHmac, timingSafeEqual } from 'node:crypto';

// Constant-time string comparison (hash both sides so lengths match).
export function safeEqual(a: string, b: string): boolean {
  const ha = createHmac('sha256', 'cmp').update(a).digest();
  const hb = createHmac('sha256', 'cmp').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function bearerOk(header: string | null, secret: string): boolean {
  return !!secret && !!header && safeEqual(header, `Bearer ${secret}`);
}
