// LinkedIn posts as a signal (DECISIONS #45). Found through Tavily search results restricted to linkedin.com: the app
// never requests a LinkedIn page, never logs in and stores no profile data, only title + ≤300-char snippet + link.
// Only posts BY the VC (their /in/ handle) or BY their firm's company page are kept; mentions by others are noise.
import { FETCH_TIMEOUT_MS, LINKEDIN_RECHECK_DAYS } from './config';
import { truncate } from './text';
import type { RawItem, VcContext } from './types';
import type { CollectResult } from './collectors';

// linkedin.com/posts/<author>_<words>-activity-<19-digit id>-<suffix> (also ugcPost / share ids).
const POST_RE = /linkedin\.com\/posts\/([^_/?#]+)_[^?#]*?(?:activity|ugcpost|share)-(\d{19})/i;

export function parsePostUrl(url: string): { author: string; id: string } | null {
  const m = url.match(POST_RE);
  return m ? { author: m[1].toLowerCase(), id: m[2] } : null;
}

// LinkedIn ids are time-ordered: the top 41 bits are milliseconds since the Unix epoch. Returns null if implausible.
export function postDate(id: string): string | null {
  try {
    const ms = Number(BigInt(id) >> 22n);
    return ms > Date.UTC(2015, 0, 1) && ms < Date.now() + 86_400_000 ? new Date(ms).toISOString() : null;
  } catch {
    return null;
  }
}

// Search snippets of LinkedIn pages carry sign-up boilerplate and follower counts; strip it.
export function cleanPostText(s: string): string {
  return s
    .replace(/Agree & Join LinkedIn[\s\S]*?Cookie Policy\.?/gi, ' ')
    .replace(/View (organization|profile) page for [^.]+\.?/gi, ' ')
    .replace(/[\d,]+ followers/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type PostAuthor = { kind: 'vc' | 'firm'; label: string };

export function postAuthor(author: string, vc: Pick<VcContext, 'name' | 'firm' | 'linkedinSlug' | 'firmLinkedinSlug'>): PostAuthor | null {
  if (vc.linkedinSlug && author === vc.linkedinSlug.toLowerCase()) return { kind: 'vc', label: vc.name };
  if (vc.firmLinkedinSlug && author === vc.firmLinkedinSlug.toLowerCase()) return { kind: 'firm', label: vc.firm };
  return null;
}

// Turns raw search results into RawItems: authored posts only, dated from the post id, titled so the classifier
// (and Vikram) can see who posted it.
export function toPostItems(results: { url: string; title?: string; content?: string }[], vc: Pick<VcContext, 'name' | 'firm' | 'linkedinSlug' | 'firmLinkedinSlug'>): RawItem[] {
  const out: RawItem[] = [];
  for (const r of results) {
    const p = parsePostUrl(r.url);
    if (!p) continue;
    const who = postAuthor(p.author, vc);
    if (!who) continue;
    const text = cleanPostText(r.content ?? '');
    if (!text) continue;
    out.push({
      url: r.url.split('?')[0],
      title: `LinkedIn post by ${who.label}: ${truncate(text, 110)}`,
      snippet: truncate(text, 300),
      source: 'linkedin',
      source_name: who.kind === 'vc' ? 'LinkedIn (own post)' : 'LinkedIn (firm page)',
      published_at: postDate(p.id),
      date_approx: false,
    });
  }
  return out;
}

// Weekly at most, and only for VCs whose handle (or firm page) is known.
export function linkedinDue(vc: Pick<VcContext, 'linkedinSlug' | 'firmLinkedinSlug' | 'linkedinCheckedAt'>, now: Date): boolean {
  if (!vc.linkedinSlug && !vc.firmLinkedinSlug) return false;
  if (!vc.linkedinCheckedAt) return true;
  return now.getTime() - new Date(vc.linkedinCheckedAt).getTime() >= LINKEDIN_RECHECK_DAYS * 86_400_000;
}

export async function linkedinPosts(vc: VcContext, apiKey: string): Promise<CollectResult> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: `"${vc.name}" ${vc.firm}`,
        search_depth: 'basic',
        topic: 'general',
        time_range: 'month',
        max_results: 10,
        include_domains: ['linkedin.com'],
      }),
    });
    if (!res.ok) return { items: [], ok: false, error: `linkedin search HTTP ${res.status}` };
    const j = (await res.json()) as { results?: { url: string; title?: string; content?: string }[] };
    return { items: toPostItems(j.results ?? [], vc), ok: true };
  } catch (e) {
    return { items: [], ok: false, error: `linkedin search: ${(e as Error).message}` };
  }
}
