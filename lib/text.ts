import { createHash } from 'node:crypto';
import { SNIPPET_MAX } from './config';

export function normalizeUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    u.hostname = u.hostname.toLowerCase();
    for (const k of [...u.searchParams.keys()]) if (/^utm_|^fbclid$|^gclid$/i.test(k)) u.searchParams.delete(k);
    let s = u.toString();
    if (s.endsWith('/') && u.pathname !== '/') s = s.slice(0, -1);
    return s;
  } catch {
    return raw.trim();
  }
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
export const urlHash = (url: string) => sha256(normalizeUrl(url));

// Lowercase, punctuation stripped, whitespace collapsed (SPEC §9.2).
export function normTitle(t: string): string {
  return t.toLowerCase().replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
}

export function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export const truncate = (s: string, n = SNIPPET_MAX) => (s.length <= n ? s : s.slice(0, n - 1).trimEnd() + '…');

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Whole-word, case-insensitive phrase match ("Accel" must not match "accelerate").
export function containsPhrase(text: string, phrase: string): boolean {
  if (!phrase.trim()) return false;
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(phrase.trim())}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export const daysOld = (iso: string, now: Date) => (now.getTime() - new Date(iso).getTime()) / 86_400_000;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "07 Oct" / "07 Oct 2026", in UTC.
export function fmtDay(iso: string, withYear = false): string {
  const d = new Date(iso);
  const s = `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]}`;
  return withYear ? `${s} ${d.getUTCFullYear()}` : s;
}

export const isoDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);
