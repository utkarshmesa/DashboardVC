// One-off: freezes SPEC §9.2 enrichment (Tavily headline search → ≤300-char snippet + canonical URL) into the golden
// fixtures for snippet-less items that pass the filter at the 700-day recall window. The recall test then mirrors
// production: classify, enrich accepted snippet-less items, reclassify. Raw items are not modified.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { enrichHeadline } from '../lib/collectors';
import { filterReason } from '../lib/filter';

const DIR = new URL('../eval/fixtures/golden/', import.meta.url);
const key = process.env.TAVILY_API_KEY;
if (!key) { console.error('Missing required env: TAVILY_API_KEY'); process.exit(1); }

type FxItem = { title: string; snippet: string | null; url: string; published_at: string | null; enrichment?: { snippet: string; url: string; captured_at: string } | null };

let credits = 0;
for (const file of readdirSync(DIR).filter((f) => f.endsWith('.json'))) {
  const fx = JSON.parse(readFileSync(new URL(file, DIR), 'utf8'));
  const vc = { name: fx.tracked_vc, aliases: fx.vc_aliases ?? [], firm: fx.firm, firmAliases: fx.firm_aliases ?? [], ambiguous: false };
  const now = new Date(fx.captured_at);
  for (const it of fx.items as FxItem[]) {
    if (it.snippet || it.enrichment !== undefined) continue;
    if (filterReason(it, vc, 700, now)) continue;
    credits++;
    const r = await enrichHeadline(it.title, key);
    it.enrichment = r.match ? { ...r.match, captured_at: new Date().toISOString() } : null;
    console.log(`${fx.event_id}: ${r.match ? 'matched' : r.ok ? 'no match' : r.error} — ${it.title.slice(0, 70)}`);
  }
  writeFileSync(new URL(file, DIR), JSON.stringify(fx, null, 2) + '\n');
}
console.log(`Tavily credits used: ${credits}`);
