// SPEC §9.2 collectors. Phase 1: Google News (main query) and the Tavily fallback.
// Appearance collectors were dropped at the Phase 0 gate (docs/DECISIONS.md).
import Parser from 'rss-parser';
import { FETCH_TIMEOUT_MS, GOOGLE_NEWS_SPACING_MS, SNIPPET_MIN_EXTRA_CHARS, TAVILY_EXCLUDE_DOMAINS } from './config';
import { normTitle, sleep, stripTags, truncate } from './text';
import type { RawItem, VcContext } from './types';

export type CollectResult = { items: RawItem[]; ok: boolean; error?: string };

const parser = new Parser();
const quote = (s: string) => `"${s.replace(/"/g, '')}"`;
const orGroup = (xs: string[]) => (xs.length === 1 ? quote(xs[0]) : `(${xs.map(quote).join(' OR ')})`);

export const googleNewsQuery = (vc: VcContext) =>
  `${orGroup([vc.name, ...vc.aliases])} ${orGroup([vc.firm, ...vc.firmAliases])} when:30d`;

// Every Google News request starts ≥ 300 ms after the previous one, across concurrent workers.
let gnChain: Promise<void> = Promise.resolve();
function gnSlot(): Promise<void> {
  gnChain = gnChain.then(() => sleep(GOOGLE_NEWS_SPACING_MS));
  return gnChain;
}

// Google News titles end in " - Publisher": strip it into source_name before title_norm is computed.
export function splitGoogleTitle(title: string, source?: string): { title: string; source_name: string | null } {
  if (source && title.endsWith(` - ${source}`)) return { title: title.slice(0, -(source.length + 3)).trim(), source_name: source };
  const i = title.lastIndexOf(' - ');
  if (i > 0) return { title: title.slice(0, i).trim(), source_name: title.slice(i + 3).trim() };
  return { title: title.trim(), source_name: null };
}

// Text a description adds beyond the headline and publisher (Google News descriptions mostly repeat the title).
export function extraText(desc: string, title: string, sourceName: string | null): string {
  let rest = normTitle(desc);
  for (const part of [normTitle(title), sourceName ? normTitle(sourceName) : '']) if (part) rest = rest.split(part).join(' ');
  return rest.replace(/\s+/g, ' ').trim();
}

const snippetIfExtra = (text: string, title: string, sourceName: string | null) =>
  text && extraText(text, title, sourceName).length >= SNIPPET_MIN_EXTRA_CHARS ? truncate(text) : null;

export async function googleNews(vc: VcContext): Promise<CollectResult> {
  await gnSlot();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(googleNewsQuery(vc))}&hl=en-IN&gl=IN&ceid=IN:en`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; vc-pipeline/1.0)' } });
    if (!res.ok) return { items: [], ok: false, error: `google_news HTTP ${res.status}` };
    const feed = await parser.parseString(await res.text());
    const items = (feed.items ?? []).filter((it) => it.link && it.title).map((it): RawItem => {
      const src = (it as unknown as { source?: string | { _: string } }).source;
      const { title, source_name } = splitGoogleTitle(it.title!, typeof src === 'string' ? src : src?._);
      return {
        url: it.link!,
        title,
        snippet: snippetIfExtra(it.content ? stripTags(it.content) : '', title, source_name),
        source: 'google_news',
        source_name,
        published_at: it.isoDate ?? (it.pubDate ? new Date(it.pubDate).toISOString() : null),
        date_approx: false,
      };
    });
    return { items, ok: true };
  } catch (e) {
    return { items: [], ok: false, error: `google_news ${(e as Error).message}` };
  }
}

// Tavily fallback. Phase 0 gate: news topic (dated results) plus domain exclusions.
export async function tavily(vc: VcContext, apiKey: string): Promise<CollectResult> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: `"${vc.name}" ${vc.firm}`,
        search_depth: 'basic',
        topic: 'news',
        time_range: 'month',
        max_results: 5,
        include_published_date: true,
        exclude_domains: TAVILY_EXCLUDE_DOMAINS,
      }),
    });
    if (!res.ok) return { items: [], ok: false, error: `tavily HTTP ${res.status}` };
    const j = (await res.json()) as { results?: Array<{ url: string; title: string; content?: string; published_date?: string | null }> };
    const items = (j.results ?? []).filter((r) => r.url && r.title).map((r): RawItem => {
      const d = r.published_date ? new Date(r.published_date) : null;
      const dated = !!d && !isNaN(d.getTime());
      let host: string | null = null;
      try { host = new URL(r.url).hostname.replace(/^www\./, ''); } catch { /* keep null */ }
      return {
        url: r.url,
        title: r.title.trim(),
        snippet: snippetIfExtra(r.content ? stripTags(r.content) : '', r.title, null),
        source: 'tavily',
        source_name: host,
        published_at: dated ? d!.toISOString() : null,
        date_approx: !dated, // returned under the "last month" filter but undated (SPEC §9.2)
      };
    });
    return { items, ok: true };
  } catch (e) {
    return { items: [], ok: false, error: `tavily ${(e as Error).message}` };
  }
}

// Person RSS (vcs.rss_url) and firm RSS (firms.firm_rss). The window filter drops old items;
// firm-feed items are firm-level evidence, never assumed to be about the person.
export async function rssFeed(url: string, source: 'person_rss' | 'firm_rss'): Promise<CollectResult> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; vc-pipeline/1.0)' } });
    if (!res.ok) return { items: [], ok: false, error: `${source} HTTP ${res.status}` };
    const feed = await parser.parseString(await res.text());
    const items = (feed.items ?? []).filter((it) => it.link && it.title).map((it): RawItem => {
      const text = stripTags(it.contentSnippet ?? it.content ?? '');
      return {
        url: it.link!,
        title: it.title!.trim(),
        snippet: snippetIfExtra(text, it.title!, null),
        source,
        source_name: feed.title?.trim() || null,
        published_at: it.isoDate ?? (it.pubDate ? new Date(it.pubDate).toISOString() : null),
        date_approx: false,
      };
    });
    return { items, ok: true };
  } catch (e) {
    return { items: [], ok: false, error: `${source} ${(e as Error).message}` };
  }
}

export type Enrichment = { snippet: string; url: string };

// SPEC §9.2 enrichment: one Tavily basic search with the headline as the query; use the result whose title
// matches the headline (equal or containing, after normalisation) for a ≤300-char snippet and canonical URL.
export async function enrichHeadline(title: string, apiKey: string): Promise<{ ok: boolean; match: Enrichment | null; error?: string }> {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ query: title, search_depth: 'basic', max_results: 5, exclude_domains: TAVILY_EXCLUDE_DOMAINS }),
    });
    if (!res.ok) return { ok: false, match: null, error: `tavily enrich HTTP ${res.status}` };
    const j = (await res.json()) as { results?: Array<{ url: string; title: string; content?: string }> };
    return { ok: true, match: matchEnrichment(title, j.results ?? []) };
  } catch (e) {
    return { ok: false, match: null, error: `tavily enrich ${(e as Error).message}` };
  }
}

export function matchEnrichment(title: string, results: Array<{ url: string; title: string; content?: string }>): Enrichment | null {
  const want = normTitle(title);
  for (const r of results) {
    const got = normTitle(splitGoogleTitle(r.title ?? '').title);
    const matches = got === want || (Math.min(got.length, want.length) >= 20 && (got.includes(want) || want.includes(got)));
    const content = r.content ? stripTags(r.content) : '';
    if (matches && r.url && content) return { snippet: truncate(content), url: r.url };
  }
  return null;
}
