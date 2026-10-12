// npm run linkedin:handles -- draft | apply
// draft: one Tavily search per VC (plus one per firm still missing a page) restricted to linkedin.com, reading only
//        search-result titles/URLs, never LinkedIn itself. Writes seed/linkedin_handles.csv for human review.
//        Only VCs and firms still missing a handle are searched. If the reviewed file already exists, the draft goes to
//        seed/linkedin_handles_new.csv, so earlier reviews are never overwritten.
// apply [file]: writes the reviewed CSV (rows with confidence "ok") into vc_profile.linkedin_slug / firms.linkedin_slug.
// Credits used by draft are recorded as a finished manual run so the monthly Tavily budget stays accurate.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { db } from '../lib/db';
import { parseCsv } from './csv';

const FILE = 'seed/linkedin_handles.csv';
const NEW_FILE = 'seed/linkedin_handles_new.csv';
const mode = process.argv[2];
const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

type Result = { url: string; title?: string; content?: string };
async function search(query: string): Promise<Result[]> {
  const key = (process.env.TAVILY_API_KEY ?? '').split(',')[0];
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, search_depth: 'basic', topic: 'general', max_results: 10, include_domains: ['linkedin.com'] }),
  });
  if (!r.ok) throw new Error(`tavily HTTP ${r.status}`);
  return ((await r.json()) as { results?: Result[] }).results ?? [];
}

const slugOf = (url: string, kind: 'in' | 'company') => url.match(new RegExp(`linkedin\\.com/${kind}/([^/?#]+)`, 'i'))?.[1].toLowerCase() ?? null;

async function draft() {
  const vcs = (await db().from('vcs').select('id, name, firm').order('name')).data ?? [];
  const prof = (await db().from('vc_profile').select('vc_id, firm_key, linkedin_slug')).data ?? [];
  const firms = (await db().from('firms').select('firm_key, display_name, aliases, linkedin_slug')).data ?? [];
  const rows: string[] = ['kind,key,name,firm,slug,confidence,evidence'];
  const firmFound = new Map<string, { slug: string; evidence: string }>();
  let credits = 0;
  for (const v of vcs) {
    if (prof.find((p) => p.vc_id === v.id)?.linkedin_slug) continue; // already reviewed
    const fk = prof.find((p) => p.vc_id === v.id)?.firm_key ?? null;
    const f = firms.find((x) => x.firm_key === fk);
    const firmNames = [v.firm, f?.display_name, ...(f?.aliases ?? [])].filter(Boolean).map((s) => norm(s as string));
    const res = await search(`"${v.name}" ${v.firm} linkedin`); credits++;
    const nameTokens = norm(v.name).split(' ');
    let best: { slug: string; conf: string; ev: string } | null = null;
    for (const r of res) {
      const slug = slugOf(r.url, 'in');
      const t = norm(`${r.title ?? ''}`), all = norm(`${r.title ?? ''} ${r.content ?? ''}`);
      if (slug && nameTokens.every((tok) => t.includes(tok))) {
        const conf = firmNames.some((n) => all.includes(n)) ? 'ok' : 'check';
        if (!best || (best.conf === 'check' && conf === 'ok')) best = { slug, conf, ev: (r.title ?? '').slice(0, 120) };
      }
      const cslug = slugOf(r.url, 'company');
      if (cslug && fk && !firmFound.has(fk) && firmNames.some((n) => t.includes(n))) firmFound.set(fk, { slug: cslug, evidence: (r.title ?? '').slice(0, 120) });
    }
    rows.push(['vc', v.id, v.name, v.firm, best?.slug ?? '', best ? best.conf : 'missing', best?.ev ?? ''].map(esc).join(','));
    console.log(`${best ? best.conf.padEnd(7) : 'missing'} ${v.name} → ${best?.slug ?? '-'}`);
  }
  for (const f of firms) {
    if (!prof.some((p) => p.firm_key === f.firm_key) || f.linkedin_slug) continue; // tracked firms still missing a page
    if (!firmFound.has(f.firm_key)) {
      const res = await search(`"${f.display_name}" venture capital linkedin company page`); credits++;
      const names = [f.display_name, ...(f.aliases ?? [])].map(norm);
      const hit = res.find((r) => slugOf(r.url, 'company') && names.some((n) => norm(r.title ?? '').includes(n)));
      if (hit) firmFound.set(f.firm_key, { slug: slugOf(hit.url, 'company')!, evidence: (hit.title ?? '').slice(0, 120) });
    }
    const got = firmFound.get(f.firm_key);
    rows.push(['firm', f.firm_key, f.display_name, f.display_name, got?.slug ?? '', got ? 'ok' : 'missing', got?.evidence ?? ''].map(esc).join(','));
    console.log(`${got ? 'ok     ' : 'missing'} [firm] ${f.display_name} → ${got?.slug ?? '-'}`);
  }
  const out = existsSync(FILE) ? NEW_FILE : FILE;
  writeFileSync(out, rows.join('\n') + '\n');
  const now = new Date().toISOString();
  await db().from('runs').insert({ trigger: 'manual', status: 'done', started_at: now, heartbeat_at: now, finished_at: now, tavily_credits: credits, stats: { note: 'linkedin handle draft' } });
  console.log(`\nwrote ${out}; ${credits} Tavily credits recorded. Review it, then: npm run linkedin:handles -- apply ${out}`);
}

async function apply() {
  const rows = parseCsv(readFileSync(process.argv[3] ?? FILE, 'utf8')).filter((r) => r.confidence === 'ok' && r.slug);
  let n = 0;
  for (const r of rows) {
    const q = r.kind === 'vc'
      ? db().from('vc_profile').update({ linkedin_slug: r.slug }).eq('vc_id', r.key)
      : db().from('firms').update({ linkedin_slug: r.slug }).eq('firm_key', r.key);
    const res = await q;
    if (res.error) throw new Error(res.error.message);
    n++;
  }
  console.log(`applied ${n} handles (rows marked ok)`);
}

if (mode === 'draft') await draft();
else if (mode === 'apply') await apply();
else { console.error('usage: npm run linkedin:handles -- draft | apply'); process.exit(1); }
