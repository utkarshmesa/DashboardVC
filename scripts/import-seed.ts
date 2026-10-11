// SPEC §8 seed import: firms, persona, then vc_profile for existing vcs rows. Never writes vcs.
import { readFileSync } from 'node:fs';
import { DEFAULT_MY_PRODUCT, DEFAULT_TARGET_SPACE } from '../lib/config';
import { db } from '../lib/db';
import { parseCsv } from './csv';

const read = (p: string) => parseCsv(readFileSync(new URL(`../seed/${p}`, import.meta.url), 'utf8'));
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const slug = (s: string) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const list = (s: string | undefined) => (s ?? '').split(';').map((x) => x.trim()).filter(Boolean);
const orNull = (s: string | undefined) => (s && s.trim() ? s.trim() : null);

async function main() {
  // 1. firms
  const firms = read('firms_seed.csv').map((f) => ({
    firm_key: slug(f.firm), display_name: f.firm.trim(), aliases: list(f.firm_aliases),
    firm_rss: orNull(f.firm_rss), fund_info_research: orNull(f.fund_info_research),
  }));
  const fr = await db().from('firms').upsert(firms, { onConflict: 'firm_key' });
  if (fr.error) throw new Error(`firms: ${fr.error.message}`);
  console.log(`firms: ${firms.length} upserted`);

  // 2. persona settings (kept if already edited)
  const sr = await db().from('settings').upsert([
    { key: 'target_space', value: DEFAULT_TARGET_SPACE }, { key: 'my_product', value: DEFAULT_MY_PRODUCT },
  ], { onConflict: 'key', ignoreDuplicates: true });
  if (sr.error) throw new Error(`settings: ${sr.error.message}`);
  console.log('settings: target_space and my_product present');

  // 3. the vcs import stays a separate action
  const vr = await db().from('vcs').select('id, name, firm');
  if (vr.error) throw new Error(`vcs: ${vr.error.message}`);
  if (!vr.data?.length) {
    console.log('Import seed/vcs_import_master.csv via the Supabase table editor, then rerun.');
    process.exit(0);
  }

  // 4. vc_profile by normalized name + firm; print unmatched, never guess
  const seed = read('vc_profile_seed.csv');
  const firmKey = (firm: string) =>
    firms.find((f) => norm(f.display_name) === norm(firm) || f.aliases.some((a) => norm(a) === norm(firm)))?.firm_key ?? null;
  const rows: Record<string, unknown>[] = [];
  const unmatched: string[] = [];
  for (const v of vr.data as { id: string; name: string; firm: string }[]) {
    const p = seed.find((s) => norm(s.name) === norm(v.name) && norm(s.firm) === norm(v.firm));
    if (!p) { unmatched.push(`${v.name} / ${v.firm}`); continue; }
    const { name: _n, firm: _f, aliases, ambiguous_name, trust, tier, research_as_of, ...research } = p;
    const tierNum = Number(tier);
    rows.push({
      vc_id: v.id,
      firm_key: firmKey(v.firm),
      aliases: list(aliases),
      ambiguous_name: ambiguous_name === 'True',
      trust: ['A', 'A-', 'B', 'C'].includes(trust) ? trust : null,
      tier: Number.isFinite(tierNum) && tier !== '' ? Math.round(tierNum) : null,
      research_as_of: orNull(research_as_of),
      research,
    });
  }
  const pr = await db().from('vc_profile').upsert(rows, { onConflict: 'vc_id' });
  if (pr.error) throw new Error(`vc_profile: ${pr.error.message}`);
  console.log(`vc_profile: ${rows.length} upserted`);
  if (unmatched.length) console.log(`Unmatched vcs rows (no profile written):\n  ${unmatched.join('\n  ')}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
