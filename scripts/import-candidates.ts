// npm run candidates:import — researched-but-untracked investors from seed/vc_profile_seed.csv into vc_candidates
// (REVIEW-2 item 2). Same field mapping as scripts/import-seed.ts. Never writes vcs; existing candidates are kept.
import { readFileSync } from 'node:fs';
import { db } from '../lib/db';
import { parseCsv } from './csv';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const list = (s: string | undefined) => (s ?? '').split(';').map((x) => x.trim()).filter(Boolean);
const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

const seed = parseCsv(readFileSync(new URL('../seed/vc_profile_seed.csv', import.meta.url), 'utf8'));
const tracked = ((await db().from('vcs').select('name, firm')).data ?? []) as { name: string; firm: string }[];
const rows = seed
  .filter((s) => !tracked.some((t) => norm(t.name) === norm(s.name) && norm(t.firm) === norm(s.firm)))
  .map((p) => {
    const { name, firm, aliases, ambiguous_name, trust, tier, research_as_of, ...research } = p;
    const t = Number(tier);
    return {
      name: name.trim(), firm: firm.trim(), aliases: list(aliases), ambiguous_name: ambiguous_name === 'True',
      trust: ['A', 'A-', 'B', 'C'].includes(trust) ? trust : null, tier: Number.isFinite(t) && tier !== '' ? Math.round(t) : null,
      research_as_of: orNull(research_as_of), research,
    };
  });
const r = await db().from('vc_candidates').upsert(rows, { onConflict: 'name,firm', ignoreDuplicates: true });
if (r.error) { console.error(r.error.message); process.exit(1); }
console.log(`vc_candidates: ${rows.length} untracked researched investors offered (existing rows kept)`);
