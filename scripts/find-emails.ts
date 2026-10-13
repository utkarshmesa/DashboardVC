// npm run emails [-- --hunter-max N] [--force]
// Finds professional contact emails (DECISIONS #57):
//  1. firm-published pages: the firm's own pages among the research sources plus its home, /contact, /team, /about;
//  2. Hunter Email Finder (HUNTER_API_KEY in .env.local) for investors still without a personal address, skipping anyone
//     whose stated route is a form, and passed investors; highest-priority first, keeping a monthly reserve.
// Results go to vc_contact with their source. Never prints the API key.
import { firmSite } from '../lib/brief';
import { domainOf, extractEmails, HUNTER_MIN_SCORE, nameParts, pickContact, type Contact } from '../lib/contacts';
import { db } from '../lib/db';
import { outreachRoute } from '../lib/route';

const args = process.argv.slice(2);
const force = args.includes('--force');
const hunterMaxArg = Number(args[args.indexOf('--hunter-max') + 1]);
const KEY = process.env.HUNTER_API_KEY ?? '';
const RESERVE = 15; // searches kept for investors added later this month

const RANK = [/^(Nudge|Close the loop|Next step)/, /^Reach out/, /^If you have capacity|^Added by you/, /^Quiet — good fit/, /^Same firm/, /^Low|^Quiet/];
const rank = (a: string | null) => { const i = RANK.findIndex((re) => re.test(a ?? '')); return i < 0 ? RANK.length : i; };

async function getPage(url: string): Promise<string> {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; vc-pipeline contact lookup)' }, signal: AbortSignal.timeout(8000), redirect: 'follow' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('text/html')) return '';
    return (await r.text()).slice(0, 2_000_000);
  } catch { return ''; }
}

async function hunterRemaining(): Promise<number> {
  const r = await fetch(`https://api.hunter.io/v2/account?api_key=${KEY}`).then((x) => x.json()).catch(() => null);
  return r?.data?.requests?.searches?.remaining ?? 0;
}

async function hunterFind(domain: string, name: string): Promise<Contact | null | 'error'> {
  const { first, last } = nameParts(name);
  if (!first || !last) return null;
  const q = new URLSearchParams({ domain, first_name: first, last_name: last, api_key: KEY });
  const r = await fetch(`https://api.hunter.io/v2/email-finder?${q}`, { signal: AbortSignal.timeout(15000) }).catch(() => null);
  if (!r) return 'error';
  const j = await r.json().catch(() => null);
  if (!r.ok) return r.status === 404 ? null : 'error';
  const d = j?.data;
  if (!d?.email || (d.score ?? 0) < HUNTER_MIN_SCORE || !String(d.email).toLowerCase().endsWith(`@${domain}`)) return null;
  return { email: String(d.email).toLowerCase(), kind: 'personal', source: 'hunter', sourceUrl: d.sources?.[0]?.uri ?? null, confidence: d.score ?? null };
}

async function main() {
  const [vcsR, profR, contR] = await Promise.all([
    db().from('vcs').select('id, name, firm, status, recommended_action'),
    db().from('vc_profile').select('vc_id, research, linkedin_slug'),
    db().from('vc_contact').select('vc_id, email, kind, hunter_checked'),
  ]);
  for (const r of [vcsR, profR, contR]) if (r.error) throw new Error(r.error.message);
  const prof = new Map((profR.data ?? []).map((p) => [p.vc_id as string, p]));
  const prev = new Map((contR.data ?? []).map((c) => [c.vc_id as string, c]));
  const vcs = (vcsR.data ?? []).map((v) => {
    const research = (prof.get(v.id)?.research ?? {}) as Record<string, unknown>;
    const urls = String(research.source_urls ?? '').split(/;\s*/).filter(Boolean);
    return { ...v, urls, site: firmSite(urls, v.firm), route: outreachRoute(research.approach ? String(research.approach) : null, v.firm, (prof.get(v.id)?.linkedin_slug as string | null) ?? null) };
  });
  // A firm's website found through one partner serves every partner at that firm.
  const siteOfFirm = new Map(vcs.filter((v) => v.site).map((v) => [v.firm.toLowerCase(), v.site!]));
  for (const v of vcs) v.site ??= siteOfFirm.get(v.firm.toLowerCase()) ?? null;

  // 1. Firm-published pages, fetched once per firm.
  const pagesByFirm = new Map<string, { url: string; emails: string[] }[]>();
  const firms = [...new Set(vcs.filter((v) => v.site).map((v) => v.firm.toLowerCase()))];
  let i = 0;
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (i < firms.length) {
      const firm = firms[i++];
      const members = vcs.filter((v) => v.firm.toLowerCase() === firm);
      const site = members[0].site!, domain = domainOf(site)!;
      const pages = [...new Set([site, `${site}/contact`, `${site}/team`, `${site}/about`, ...members.flatMap((m) => m.urls).filter((u) => domainOf(u)?.endsWith(domain))])].slice(0, 8);
      const out: { url: string; emails: string[] }[] = [];
      for (const url of pages) out.push({ url, emails: extractEmails(await getPage(url)) });
      pagesByFirm.set(firm, out);
    }
  }));

  const results = new Map<string, Contact | null>();
  for (const v of vcs) {
    const domain = domainOf(v.site);
    if (!domain) { results.set(v.id, null); continue; }
    const pages = pagesByFirm.get(v.firm.toLowerCase()) ?? [];
    // Personal address first (any page), else a firm inbox.
    let best: Contact | null = null;
    for (const p of pages) { const c = pickContact(p.emails, v.name, domain, p.url); if (c?.kind === 'personal') { best = c; break; } best ??= c; }
    results.set(v.id, best);
  }

  // 2. Hunter for the rest: no personal address yet, not a form route, not passed; best-ranked first.
  let hunterUsed = 0, hunterFound = 0;
  const remaining = KEY ? await hunterRemaining() : 0;
  const budget = Math.max(0, Math.min(Number.isFinite(hunterMaxArg) ? hunterMaxArg : 30, remaining - RESERVE));
  const queue = vcs
    .filter((v) => domainOf(v.site) && results.get(v.id)?.kind !== 'personal' && v.route.kind !== 'form' && v.status !== 'passed' && (force || !prev.get(v.id)?.hunter_checked))
    .sort((a, b) => rank(a.recommended_action) - rank(b.recommended_action));
  const hunterChecked = new Set<string>();
  for (const v of queue) {
    if (hunterUsed >= budget) break;
    const c = await hunterFind(domainOf(v.site)!, v.name);
    hunterUsed++;
    if (c === 'error') continue;
    hunterChecked.add(v.id);
    if (c) { results.set(v.id, c); hunterFound++; }
  }

  // 3. Save: one row per VC, with source; "nothing found" is recorded too so lookups aren't repeated.
  const rows = vcs.map((v) => {
    const c = results.get(v.id) ?? null;
    return { vc_id: v.id, email: c?.email ?? null, kind: c?.kind ?? null, source: c?.source ?? null, source_url: c?.sourceUrl ?? null, confidence: c?.confidence ?? null,
      checked_at: new Date().toISOString(), hunter_checked: hunterChecked.has(v.id) || !!prev.get(v.id)?.hunter_checked };
  });
  const up = await db().from('vc_contact').upsert(rows, { onConflict: 'vc_id' });
  if (up.error) throw new Error(up.error.message);

  const personal = rows.filter((r) => r.kind === 'personal').length, inbox = rows.filter((r) => r.kind === 'firm').length;
  console.log(JSON.stringify({ firmsWithSite: firms.length, personal, firmInbox: inbox, none: rows.length - personal - inbox,
    fromFirmPages: rows.filter((r) => r.source === 'firm_page').length, hunter: { searched: hunterUsed, found: hunterFound, budget, remainingBefore: remaining } }, null, 2));
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
