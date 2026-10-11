import Parser from 'rss-parser';
import { FETCH_TIMEOUT_MS, GOOGLE_NEWS_SPACING_MS, SNIPPET_MIN_EXTRA_CHARS } from './config.js';
import { normTitle, normalizeUrl, sha256, sleep, stripTags, truncate } from './text.js';
import type { QueryKind, SpikeVc } from './types.js';

export type RawItem = {
  url: string;
  title: string;
  snippet: string | null;
  source_name: string | null;
  published_at: string | null;
  date_approx: boolean;
  kind: QueryKind;
};

export type CollectResult = { items: RawItem[]; ok: boolean; error?: string; httpStatus?: number; ms: number };

const parser = new Parser();
const q = (s: string) => `"${s.replace(/"/g, '')}"`;
const orGroup = (xs: string[]) => (xs.length === 1 ? q(xs[0]) : `(${xs.map(q).join(' OR ')})`);

export const newsQuery = (vc: SpikeVc) =>
  `${orGroup([vc.name, ...vc.aliases])} ${orGroup([vc.firm, ...vc.firmAliases])} when:30d`;
export const appearanceQuery = (vc: SpikeVc) =>
  `${orGroup([vc.name, ...vc.aliases])} (podcast OR panel OR keynote OR summit OR fireside) when:30d`;
export const goldenQuery = (company: string, firm: string) => `${q(company)} ${q(firm)}`;

// Global spacing: every Google News request starts ≥300 ms after the previous one.
let gnChain: Promise<void> = Promise.resolve();
function gnSlot(): Promise<void> {
  const slot = gnChain.then(() => sleep(GOOGLE_NEWS_SPACING_MS));
  gnChain = slot;
  return gnChain;
}

async function timedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

// Google News titles end in " - Publisher". The description repeats the headline plus links;
// keep a snippet only if it adds ≥ SNIPPET_MIN_EXTRA_CHARS of text beyond title and publisher.
export function splitGoogleTitle(title: string, source?: string): { title: string; source_name: string | null } {
  if (source && title.endsWith(` - ${source}`)) return { title: title.slice(0, -(source.length + 3)).trim(), source_name: source };
  const i = title.lastIndexOf(' - ');
  if (i > 0) return { title: title.slice(0, i).trim(), source_name: title.slice(i + 3).trim() };
  return { title: title.trim(), source_name: null };
}

export function extraText(desc: string, title: string, sourceName: string | null): string {
  let rest = normTitle(desc);
  for (const part of [normTitle(title), sourceName ? normTitle(sourceName) : '']) if (part) rest = rest.split(part).join(' ');
  return rest.replace(/\s+/g, ' ').trim();
}

export async function googleNews(query: string, kind: QueryKind): Promise<CollectResult> {
  await gnSlot();
  const t0 = Date.now();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const res = await timedFetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; vc-pipeline-spike/0.1)' } });
    if (!res.ok) return { items: [], ok: false, httpStatus: res.status, error: `HTTP ${res.status}`, ms: Date.now() - t0 };
    const feed = await parser.parseString(await res.text());
    const items: RawItem[] = (feed.items ?? []).filter((it) => it.link && it.title).map((it) => {
      const src = (it as unknown as { source?: string | { _: string } }).source;
      const srcName = typeof src === 'string' ? src : src?._;
      const { title, source_name } = splitGoogleTitle(it.title!, srcName);
      const desc = it.content ? stripTags(it.content) : '';
      const extra = desc ? extraText(desc, title, source_name) : '';
      return {
        url: it.link!,
        title,
        snippet: extra.length >= SNIPPET_MIN_EXTRA_CHARS ? truncate(desc) : null,
        source_name,
        published_at: it.isoDate ?? (it.pubDate ? new Date(it.pubDate).toISOString() : null),
        date_approx: false,
        kind,
      };
    });
    return { items, ok: true, httpStatus: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { items: [], ok: false, error: String((e as Error).message ?? e), ms: Date.now() - t0 };
  }
}

export async function tavily(query: string, apiKey: string): Promise<CollectResult> {
  const t0 = Date.now();
  try {
    const res = await timedFetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query,
        search_depth: 'basic',
        topic: 'general',
        time_range: 'month',
        max_results: 5,
        include_published_date: true,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { items: [], ok: false, httpStatus: res.status, error: `HTTP ${res.status} ${body.slice(0, 160)}`, ms: Date.now() - t0 };
    }
    const j = (await res.json()) as { results?: Array<{ url: string; title: string; content?: string; published_date?: string | null }> };
    const items: RawItem[] = (j.results ?? []).filter((r) => r.url && r.title).map((r) => {
      const content = r.content ? stripTags(r.content) : '';
      const extra = content ? extraText(content, r.title, null) : '';
      const d = r.published_date ? new Date(r.published_date) : null;
      const dated = d && !isNaN(d.getTime());
      return {
        url: r.url,
        title: r.title.trim(),
        snippet: extra.length >= SNIPPET_MIN_EXTRA_CHARS ? truncate(content) : null,
        source_name: (() => { try { return new URL(r.url).hostname.replace(/^www\./, ''); } catch { return null; } })(),
        published_at: dated ? d!.toISOString() : null,
        date_approx: !dated,
        kind: 'tavily' as const,
      };
    });
    return { items, ok: true, httpStatus: res.status, ms: Date.now() - t0 };
  } catch (e) {
    return { items: [], ok: false, error: String((e as Error).message ?? e), ms: Date.now() - t0 };
  }
}

export const hashUrl = (u: string) => sha256(normalizeUrl(u));
