// Investor brief (DECISIONS #50): the person and fund facts Vikram needs to decide whether and how to pitch, built in
// code from verified research, curated fund notes, structured verified deals and dated investment signals. No AI text:
// deal headlines come from source-article URLs (amounts dropped: URL slugs garble decimals, e.g. "3-3-million").

export type Deal = { label: string; round: string | null; year: string | null; url: string | null; inSpace: boolean; verified: boolean; competitor?: boolean };
export type Brief = {
  title: string | null; titleVerified: string | null; city: string | null; thesis: string | null; approach: string | null; linkedin: string | null;
  website: string | null; // the firm's own site, read from research source URLs whose domain carries the firm's name
  fund: string | null; fundStatus: { label: string; tone: 'accent' | 'info' | 'warn' } | null;
  stage: string | null; cheque: string | null; chequeNote: string | null;
  deals: Deal[]; dealCount: number; inSpaceCount: number; latestRelevant: string | null;
  competitorDeals: string[]; // deals naming a known competitor or the founder's own category: check before pitching
  caveats: string | null; trust: string | null; sourceCount: number;
};

// "In your space": logistics / supply-chain vocabulary (the persona's target space, in plain words).
const SPACE = /\b(logistic\w*|freight|supply[ -]?chain|fleet|truck\w*|warehous\w*|procure\w*|transport\w*|shipping|shipper\w*|cargo|delivery|last[ -]mile|packag\w*|mobility|tms|exim|customs|3pl|carrier\w*|dashcam|telematic\w*|cold[ -]chain|distribution|import|export|cross[ -]border)\b/i;
const DEAL = /\b(raises?|raised|bags|secures|lands|gets|funding|seed|series|invest(s|ed|ment|ing)?|led by|backs|backed|leads)\b/i;
// Lists, roundups, criteria pages and fund news (a VC raising a fund, an LP investing in one) are not deals by this VC.
const NOT_A_DEAL = /\b(top \d+|roundup|investors of|weekly funding|funding report|this (week|month)|investment criteria|indian startups|corpus|first close|final close|fund (i{1,3}|iv|v|vi))\b|\b(launch|close|raise|invest)(e?s|ed)?\b.{0,40}\bfund\b|\b[0-9a-f]{16,}\b/i;
// Words right before the funding verb that are part of a name ("Trupeer AI", "Wootz Work") rather than the name itself.
const NAME_SUFFIX = new Set(['ai', 'co', 'com', 'tech', 'labs', 'work', 'robotics', 'technologies', 'health', 'pay', 'hq', 'io']);
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
    .replace(/\bSeries([a-e])\b/gi, (_, l: string) => `Series ${l.toUpperCase()}`) // slug "seriesa"
    .replace(/\bSeries ([a-e])\b/gi, (_, l: string) => `Series ${l.toUpperCase()}`);
}

// Candidate company keys for de-duplication: the word(s) right before the funding verb ("...startup Inamo raises"),
// or right after "investment in" / "invested in" / "invests in"; plus the joined two-word form ("trupeer ai" → "trupeerai").
export function companyKeys(label: string): string[] {
  const w = label.toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean);
  const at = w.findIndex((x) => /^(raises?|raised|bags|secures|gets|lands)$/.test(x));
  const after = w.findIndex((x, i) => /^(invest(s|ed|ment)?)$/.test(x) && w[i + 1] === 'in');
  const keys: string[] = [];
  const add = (a: string | undefined, b?: string) => { if (a) keys.push(a); if (a && b) keys.push(b + a, a + b); };
  if (at > 0) { const last = w[at - 1]; add(last, NAME_SUFFIX.has(last) ? w[at - 2] : undefined); if (!NAME_SUFFIX.has(last)) add(w[at - 2] ? w[at - 2] + last : undefined); }
  if (after >= 0 && w[after + 2]) { add(w[after + 2]); if (w[after + 3]) keys.push(w[after + 2] + w[after + 3]); }
  if (w[1] === 'a' || w[1] === 'an') add(w[0]);                                  // "Superprocure, a unified TMS platform, secures…"
  const desc = w.findIndex((x) => /^(startup|firm|company|maker|platform|enabler|co)$/.test(x));
  if (desc >= 0 && w[desc + 1] && !/^(raises?|raised|bags|secures|gets|funding|seed)$/.test(w[desc + 1])) {
    add(w[desc + 1]); if (w[desc + 2] && !/^(raises?|raised|bags|secures|gets|funding|seed|round)$/.test(w[desc + 2])) keys.push(w[desc + 1] + w[desc + 2]); // "startup Zango funding…"
  }
  if (!keys.length) { const tail = w.filter((x) => x.length >= 4 && !COMMON.has(x)); add(tail[tail.length - 1]); }
  return [...new Set(keys.filter((k) => k.length >= 3 && !COMMON.has(k)))];
}

export function dealFromUrl(url: string): Deal | null {
  const s = slugOf(url);
  if (!s || s.text.split(' ').length < 3 || !DEAL.test(s.text) || NOT_A_DEAL.test(s.text)) return null;
  const round = s.text.match(ROUND)?.[0] ?? null;
  return { label: headline(s.text), round: round ? headline(round) : null, year: s.year, url, inSpace: SPACE.test(s.text), verified: false };
}

// Fund status from the curated fund note. Notes hold several dated clauses ("Fund III closed 2023; Fund IV launched
// January 2026 is a target, not a verified close"), so each clause is judged on its own:
//   1. a follow-on-only fund can't back a new company: warning, whatever else is said;
//   2. the most recent fund close/raise within 24 months (not negated) → "Fresh fund", with first/second close noted;
//   3. otherwise the latest fund target within 24 months → "Raising a new fund";
// a launch or announcement that only states a target is raising, never a close.
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
type Clause = { text: string; y: number; m: number | null };
function clauses(note: string): Clause[] {
  return note.toLowerCase().split(/;|\.\s+(?=[a-z0-9])/).map((text) => {
    const named = text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*(?:\d{1,2},?\s+)?(20\d\d)\b/);
    if (named) return { text, y: Number(named[2]), m: MONTHS.indexOf(named[1]) };
    const iso = text.match(/\b(20\d\d)-(\d\d)(?:-\d\d)?\b/);
    if (iso) return { text, y: Number(iso[1]), m: Number(iso[2]) - 1 };
    const year = text.match(/\b(20\d\d)\b/);
    return { text, y: year ? Number(year[1]) : NaN, m: null };
  }).filter((c) => Number.isFinite(c.y) && /\bfunds?\b|corpus|\bclose[sd]?\b|\btarget|\braising\b|commitment/.test(c.text)); // a dated portfolio deal ("CargoFL's 2025 seed") is not fund news
}
export function fundStatus(note: string | null, now = new Date()): Brief['fundStatus'] {
  if (!note) return null;
  const label = (c: Clause) => (c.m === null ? String(c.y) : `${MONTHS[c.m][0].toUpperCase()}${MONTHS[c.m].slice(1)} ${c.y}`);
  const age = (c: Clause) => (now.getUTCFullYear() - c.y) * 12 + (now.getUTCMonth() - (c.m ?? 6));
  const recent = clauses(note).filter((c) => age(c) <= 24).sort((a, b) => age(a) - age(b));
  const negated = (t: string) => /\bnot\b[^.;]{0,40}\b(close|closed|raised|completed|established)\b|\b(close|closed)\b[^.;]{0,40}\bnot\b/.test(t);
  const closedIn = (t: string) => !negated(t) && /\b(raised|closes|closed|close(?! to\b))\b/.test(t);
  const targetIn = (t: string) => /\b(target|targets|targeted|targeting|aims?|raising)\b/.test(t);
  if (/follow-on[- ]only|only for (its )?existing portfolio/i.test(note)) {
    const c = recent[0];
    return { label: `Follow-on-only fund${c ? ` · ${label(c)}` : ''}`, tone: 'warn' };
  }
  const closed = recent.find((c) => closedIn(c.text) || (/\b(announced|launch(es|ed)?)\b/.test(c.text) && !targetIn(c.text) && !negated(c.text)));
  if (closed) {
    const stage = closed.text.match(/\b(first|second|third) close\b/)?.[1];
    return { label: `Fresh fund · ${label(closed)}${stage && !/final close/.test(closed.text) ? ` (${stage} close)` : ''}`, tone: 'accent' };
  }
  const raising = recent.find((c) => targetIn(c.text));
  return raising ? { label: `Raising a new fund · ${label(raising)}`, tone: 'info' } : null;
}

// Top of the stated cheque range in USD, read from research text ("USD 250,000–600,000", "USD 0.5–3M",
// "Rs 4-8 Cr", "INR 1–15 crore"); null when no amount can be read unambiguously. INR at ~83 per USD.
const INR_PER_USD = 83;
export function chequeMaxUsd(text: string | null): number | null {
  if (!text) return null;
  const t = text.toLowerCase().replace(/,/g, '');
  const vals: number[] = [];
  const unit = (n: number, u: string | undefined) => (/^(m|mn|million)$/.test(u ?? '') ? n * 1e6 : /^(k|thousand)$/.test(u ?? '') ? n * 1e3 : n);
  // USD ranges and single amounts: "usd 0.5–3m", "usd 250000–600000", "$1m", "usd 138k to usd 1m"
  for (const m of t.matchAll(/(?:usd|\$)\s?(\d+(?:\.\d+)?)\s?(m|mn|million|k|thousand)?(?:\s?(?:–|-|to)\s?(?:usd|\$)?\s?(\d+(?:\.\d+)?)\s?(m|mn|million|k|thousand)?)?/g)) {
    const hiUnit = m[4] ?? m[2], loUnit = m[2] ?? m[4];
    vals.push(unit(Number(m[1]), loUnit));
    if (m[3]) vals.push(unit(Number(m[3]), hiUnit));
  }
  // INR crore: "rs 4-8 cr", "inr 1–15 crore", "inr 6–8 crore"
  for (const m of t.matchAll(/(?:inr|rs\.?|₹)\s?(\d+(?:\.\d+)?)(?:\s?(?:–|-|to)\s?(\d+(?:\.\d+)?))?\s?(crore|cr)\b/g)) vals.push(Number(m[2] ?? m[1]) * 1e7 / INR_PER_USD);
  const ok = vals.filter((v) => v >= 10_000 && v < 1e9);
  return ok.length ? Math.max(...ok) : null;
}
// The round is USD 1–3M: a cheque that tops out below USD 1M can join it but is unlikely to lead it.
export function chequeNoteFrom(text: string | null): string | null {
  const max = chequeMaxUsd(text);
  return max !== null && max < 1e6 ? `Cheques up to about ${usd(max)}: likely a co-investor, not your lead` : null;
}
const usd = (n: number) => (n >= 1e6 ? `$${(Math.round(n / 1e5) / 10).toString()}M` : `$${Math.round(n / 1e3)}K`);

const clean = (v: unknown) => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s && !/^(not (independently |publicly )?verified|not public|n\/a|unknown|none)\b/i.test(s) ? s : null;
};

// Words too generic to identify a firm by its domain.
const GENERIC = new Set(['capital', 'ventures', 'venture', 'partners', 'partner', 'fund', 'funds', 'investments', 'investors', 'india', 'group', 'advisors', 'management', 'the', 'and', 'global', 'labs', 'holdings']);
const NOT_FIRM_SITE = /\.(linkedin|twitter|x|facebook|youtube|medium|crunchbase|tracxn|pitchbook|google|wikipedia|economictimes|indiatimes|livemint|moneycontrol|yourstory|inc42|entrackr|vccircle|techcrunch|businessstandard|business-standard|thehindu|globenewswire|prnewswire|businesswire|forbes|bloomberg|reuters|substack|github)\./;

// The firm's website: the research source domain that best carries the firm's distinctive name ("stellarisvp.com" for
// Stellaris Venture Partners). Null when no source domain matches, so the UI never guesses a wrong site.
// Firms whose domain doesn't carry their name (checked by hand).
const KNOWN_SITES: Record<string, string> = { lightspeed: 'https://lsvp.com', 'inflection point ventures': 'https://ipventures.in' };

export function firmSite(urls: string[], firm: string | null | undefined): string | null {
  const known = KNOWN_SITES[(firm ?? '').trim().toLowerCase()];
  if (known) return known;
  const words = (firm ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !GENERIC.has(w));
  if (!words.length) return null;
  const hits = new Map<string, number>();
  for (const u of urls) {
    let host: string;
    try { host = new URL(u).hostname.toLowerCase().replace(/^www\./, ''); } catch { continue; }
    if (NOT_FIRM_SITE.test(`.${host}`)) continue;
    const label = host.split('.').slice(0, -1).join('.').replace(/[^a-z0-9]/g, '');
    if (words.some((w) => label.includes(w))) hits.set(host, (hits.get(host) ?? 0) + 1);
  }
  const best = [...hits.entries()].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0];
  return best ? `https://${best[0]}` : null;
}

// A personal LinkedIn profile among the research sources (used when no slug is stored).
export function linkedinFrom(urls: string[]): string | null {
  const slug = urls.map((u) => u.match(/linkedin\.com\/in\/([^/?#\s]+)/i)?.[1]).find(Boolean);
  return slug ? `https://www.linkedin.com/in/${slug.toLowerCase()}` : null;
}

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
  const firmWords = new Set((i.firmName ?? '').toLowerCase().split(/\W+/));
  // The research text names deals in prose ("Enmovil logistics SaaS"): a deal named in the same clause as a logistics
  // word is in space (clause-bounded, so "partnerships include Zango; industrial procurement…" doesn't leak).
  const proseClauses = `${String(r.fit_reason ?? '')}; ${String(r.latest_relevant_deal ?? '')}`.toLowerCase().split(/[;.]/);
  const inProseSpace = (keys: string[]) => proseClauses.some((c) => keys.some((k) => k.length >= 4 && c.replace(/\s+/g, '').includes(k)) && SPACE.test(c));
  const merged: { deal: Deal; keys: string[] }[] = [];
  for (const d of [...verified, ...urls.map(dealFromUrl).filter((x): x is Deal => !!x)]) {
    const keys = (d.verified ? [d.label.toLowerCase().replace(/[^a-z0-9]+/g, ''), ...companyKeys(d.label)] : companyKeys(d.label)).filter((k) => !firmWords.has(k));
    // Same company twice (two articles, or an article plus a verified deal): keep the first, merge rounds and year.
    const prev = merged.find((m) => m.keys.some((k) => keys.includes(k)));
    if (!prev) { merged.push({ deal: { ...d, inSpace: d.inSpace || inProseSpace(keys) }, keys }); continue; }
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
    linkedin: i.linkedinSlug ? `https://www.linkedin.com/in/${i.linkedinSlug}` : linkedinFrom(urls),
    website: firmSite(urls, i.firmName),
    fund, fundStatus: fundStatus(fund, now),
    stage: clean(r.stage_focus), cheque: clean(r.first_cheque),
    chequeNote: chequeFlag ? `${chequeFlag[0].toUpperCase()}${chequeFlag.slice(1)}` : chequeNoteFrom(clean(r.first_cheque)),
    deals: deals.slice(0, 6), dealCount: deals.length, inSpaceCount: deals.filter((d) => d.inSpace).length,
    latestRelevant: clean(r.latest_relevant_deal),
    competitorDeals: deals.filter((d) => d.competitor).map((d) => d.label),
    caveats: clean(r.conflicts), trust: i.trust, sourceCount: urls.length,
  };
}
