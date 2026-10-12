// Investor brief (DECISIONS #50): the person and fund facts Vikram needs to decide whether and how to pitch, built in
// code from verified research, curated fund notes, structured verified deals and dated investment signals. No AI text:
// deal headlines come from source-article URLs (amounts dropped: URL slugs garble decimals, e.g. "3-3-million").

export type Deal = { label: string; round: string | null; year: string | null; url: string | null; inSpace: boolean; verified: boolean; competitor?: boolean };
export type Brief = {
  title: string | null; titleVerified: string | null; city: string | null; thesis: string | null; approach: string | null; linkedin: string | null;
  fund: string | null; fundStatus: { label: string; tone: 'accent' | 'info' } | null;
  stage: string | null; cheque: string | null; chequeNote: string | null;
  deals: Deal[]; dealCount: number; inSpaceCount: number; latestRelevant: string | null;
  competitorDeals: string[]; // deals naming a known competitor or the founder's own category: check before pitching
  caveats: string | null; trust: string | null; sourceCount: number;
};

// "In your space": logistics / supply-chain vocabulary (the persona's target space, in plain words).
const SPACE = /\b(logistic\w*|freight|supply[ -]?chain|fleet|truck\w*|warehous\w*|procure\w*|transport\w*|shipping|shipper\w*|cargo|delivery|last[ -]mile|packag\w*|mobility|tms|exim|customs|3pl|carrier\w*|dashcam|telematic\w*|cold[ -]chain|distribution)\b/i;
const DEAL = /\b(raises?|raised|bags|secures|lands|gets|funding|seed|series|invest(s|ed|ment|ing)?|led by|backs|backed|leads)\b/i;
// Lists, roundups and fund announcements are not deals by this VC.
const NOT_A_DEAL = /\b(top \d+|roundup|investors of|weekly funding|funding report|corpus|first close|final close|fund (i{1,3}|iv|v|vi))\b|\b(launch|close)(e?s|ed)?\b.{0,40}\bfund\b/i;
const ROUND = /\b(pre[ -]?seed|seed|pre[ -]?series [a-c]|series [a-e])\b/i;
const SMALL = new Set(['a', 'an', 'the', 'in', 'of', 'for', 'to', 'from', 'by', 'with', 'and', 'or', 'at', 'on', 'as', 'its', 'via']);
const ACRONYMS: Record<string, string> = { ai: 'AI', saas: 'SaaS', b2b: 'B2B', d2c: 'D2C', ev: 'EV', tms: 'TMS', exim: 'EXIM', iot: 'IoT', llm: 'LLM', llmops: 'LLMOps', iit: 'IIT', us: 'US', uk: 'UK', sea: 'SEA', vc: 'VC' };
// Words too common to identify a company when de-duplicating deal headlines.
const COMMON = new Set(['funding', 'raises', 'raised', 'round', 'seed', 'series', 'startup', 'startups', 'logistics', 'supply', 'chain', 'platform', 'capital', 'ventures', 'venture', 'partners', 'invests', 'investment', 'invested', 'announcing', 'smarter', 'enterprise', 'early', 'stage', 'based', 'others', 'from', 'with', 'leads', 'backs', 'bags', 'secures', 'tech', 'technology', 'india', 'indian', 'bengaluru', 'mumbai', 'delhi', 'chennai', 'pune', 'hyderabad', 'maker', 'company', 'solutions', 'network', 'expand', 'scale', 'growth', 'productising', 'lifecycle', 'lending', 'robotics', 'speciality', 'specialty', 'chemical', 'physical', 'drone', 'delivery', 'why', 'funding']);

function slugOf(url: string): { text: string; year: string | null } | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let seg = u.pathname.split('/').filter(Boolean).pop() ?? '';
    if (host.endsWith('linkedin.com')) seg = (seg.split('_')[1] ?? '').replace(/-activity-\d+.*$/, '');
    seg = decodeURIComponent(seg).replace(/\.(html?|cms|php|aspx)$/i, '').replace(/[-_]?\d{6,}(_\d+)?$/, '');
    return { text: seg.replace(/[-_]+/g, ' ').trim(), year: u.pathname.match(/\/(20\d\d)\//)?.[1] ?? null };
  } catch {
    return null;
  }
}

// A readable headline from a URL slug: amounts removed, stray symbols tidied, acronyms restored, title case.
export function headline(text: string): string {
  const t = text.toLowerCase()
    .replace(/(\b(rs|inr|usd|dollars?)\s?|\$\s?)?\b\d+([.,\s]\d+)*\s?(million|mn|m|crore|cr|lakh|k|bn|billion)?\b/g, ' ')
    .replace(/[$₹]/g, ' ')
    .replace(/\s[.,]+(?=\s|$)/g, ' ')
    .replace(/\b(raises|raised|bags|secures|lands|gets)\s+in\s+/g, '$1 ')
    .replace(/\s+/g, ' ').trim();
  return t.split(' ')
    .map((w, i) => ACRONYMS[w] ?? (i > 0 && SMALL.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ')
    .replace(/\bPre Seed\b/g, 'Pre-Seed')
    .replace(/\bSeries ([a-e])\b/gi, (_, l: string) => `Series ${l.toUpperCase()}`);
}

export function dealFromUrl(url: string): Deal | null {
  const s = slugOf(url);
  if (!s || s.text.split(' ').length < 3 || !DEAL.test(s.text) || NOT_A_DEAL.test(s.text)) return null;
  const round = s.text.match(ROUND)?.[0] ?? null;
  return { label: headline(s.text), round: round ? headline(round) : null, year: s.year, url, inSpace: SPACE.test(s.text), verified: false };
}

// Fund status from the curated fund note: "Fresh fund" only when it says raised / closed / announced within 24 months
// (and doesn't negate it); a target alone reads as "Raising a new fund". Never upgrades a target to a close.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
export function fundStatus(note: string | null, now = new Date()): Brief['fundStatus'] {
  if (!note) return null;
  const n = note.toLowerCase();
  const m = n.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(?:\d{1,2},?\s+)?(20\d\d)\b/);
  const y = m ? Number(m[2]) : Number(n.match(/\b(20\d\d)\b/)?.[1] ?? NaN);
  if (!Number.isFinite(y)) return null;
  const month = m ? MONTHS.indexOf(m[1]) : 6;
  if ((now.getUTCFullYear() - y) * 12 + (now.getUTCMonth() - month) > 24) return null;
  const when = m ? `${m[1][0].toUpperCase()}${m[1].slice(1)} ${y}` : String(y);
  const negated = /\bnot (yet )?(verified as |confirmed as )?(a )?(final )?(close|closed|raised)\b|\bnot a completed raise\b|\bdo not label\b/.test(n);
  const closed = !negated && /\b(raised|closes|closed|final close|first close|announced|launch(es|ed)?)\b/.test(n);
  const target = /\b(target|targeting|aims?|raising)\b/.test(n);
  if (closed) return { label: `Fresh fund · ${when}${/first close/.test(n) && !/final close/.test(n) ? ' (first close)' : ''}`, tone: 'accent' };
  if (target) return { label: `Raising a new fund · ${when}`, tone: 'info' };
  return null;
}

const clean = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && !/^(not (independently |publicly )?verified|not public|n\/a|unknown|none)\b/i.test(s) ? s : null;
};

export function buildBrief(i: {
  research: Record<string, unknown> | null; thesis: string | null; trust: string | null; linkedinSlug: string | null;
  firmFund: string | null; firmName?: string | null; fitFlags: string[];
  competitors?: string[];      // known competitor companies (verified deals marked competitor) and category terms from my product
  verifiedDeals: { company: string; round: string | null; date: string | null; url: string | null }[];
}, now = new Date()): Brief {
  const r = i.research ?? {};
  const urls = String(r.source_urls ?? '').split(/;\s*/).filter(Boolean);
  const verified: Deal[] = i.verifiedDeals.map((d) => ({
    label: d.company, round: d.round, year: d.date?.slice(0, 7) ?? null, url: d.url, inSpace: SPACE.test(`${d.company} ${d.url ?? ''}`), verified: true,
  }));
  // Same company twice (two articles, or an article plus a verified deal): keep the first, merge rounds and year.
  const firmWords = new Set((i.firmName ?? '').toLowerCase().split(/\W+/));
  const tokensOf = (d: Deal) => d.label.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length >= 4 && !COMMON.has(w) && !firmWords.has(w));
  // The research text names deals in prose ("Enmovil logistics SaaS"): a deal named next to a logistics word is in space.
  const prose = `${String(r.fit_reason ?? '')} ${String(r.latest_relevant_deal ?? '')}`.toLowerCase();
  const inProseSpace = (key: string) => { const at = prose.indexOf(key); return at >= 0 && SPACE.test(prose.slice(Math.max(0, at - 40), at + key.length + 40)); };
  const merged: { deal: Deal; key: string; tokens: Set<string> }[] = [];
  for (const d of [...verified, ...urls.map(dealFromUrl).filter((x): x is Deal => !!x)]) {
    const tokens = tokensOf(d), key = tokens[0] ?? d.label.toLowerCase();
    // Same company twice (two articles, or an article plus a verified deal): keep the first, merge rounds and year.
    const prev = merged.find((m) => m.tokens.has(key) || tokens.includes(m.key));
    if (!prev) { merged.push({ deal: { ...d, inSpace: d.inSpace || inProseSpace(key) }, key, tokens: new Set(tokens) }); continue; }
    const p = prev.deal;
    if (d.round && p.round && !p.round.toLowerCase().includes(d.round.toLowerCase())) p.round = `${p.round}, ${d.round}`;
    p.round ??= d.round; p.year ??= d.year; p.inSpace ||= d.inSpace;
  }
  // A deal naming a known competitor (or the founder's category, e.g. TMS) is surfaced as a warning, not hidden.
  const comp = (i.competitors ?? []).filter(Boolean).map((c) => c.toLowerCase());
  for (const m of merged) m.deal.competitor = comp.some((c) => m.deal.label.toLowerCase().includes(c) || (m.deal.url ?? '').toLowerCase().includes(c.replace(/\s+/g, '-')));
  const deals = merged.map((m) => m.deal).sort((a, b) => Number(!!b.competitor) - Number(!!a.competitor) || Number(b.verified) - Number(a.verified) || Number(b.inSpace) - Number(a.inSpace) || (b.year ?? '').localeCompare(a.year ?? ''));
  const fund = clean(i.firmFund) ?? clean(r.fund);
  const chequeFlag = i.fitFlags.find((f) => /cheque|larger than this round/i.test(f));
  return {
    title: clean(r.title), titleVerified: clean(r.title_verified)?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? null,
    city: clean(r.city), thesis: clean(i.thesis), approach: clean(r.approach),
    linkedin: i.linkedinSlug ? `https://www.linkedin.com/in/${i.linkedinSlug}` : null,
    fund, fundStatus: fundStatus(fund, now),
    stage: clean(r.stage_focus), cheque: clean(r.first_cheque),
    chequeNote: chequeFlag ? `${chequeFlag[0].toUpperCase()}${chequeFlag.slice(1)}` : null,
    deals: deals.slice(0, 6), dealCount: deals.length, inSpaceCount: deals.filter((d) => d.inSpace).length,
    latestRelevant: clean(r.latest_relevant_deal),
    competitorDeals: deals.filter((d) => d.competitor).map((d) => d.label),
    caveats: clean(r.conflicts), trust: i.trust, sourceCount: urls.length,
  };
}
