// Exports 60 varied classifier-seen items to /eval/to_label.jsonl (blind: no URL, no model labels)
// and freezes every collected item from the local run to /eval/fixtures/spike_items.jsonl.
import { readFileSync, writeFileSync } from 'node:fs';
import { VCS } from '../data/vcs.js';
import { firmHit } from '../lib/filter.js';
import type { Item } from '../lib/types.js';

const TARGET = 60;
const NAMESAKE_TARGET = 15;

const run = JSON.parse(readFileSync(new URL('../out/local.json', import.meta.url), 'utf8')) as { meta: { started_at: string }; items: Item[] };
const vcById = new Map(VCS.map((v) => [v.id, v]));

// Seeded PRNG so the selection is reproducible.
let seed = 20261011;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const shuffle = <T>(xs: T[]) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const seen = run.items.filter((i) => i.labels || i.status === 'unclassified'); // what the classifier saw
const text = (i: Item) => `${i.title} ${i.snippet ?? ''}`;
const likelyNamesake = (i: Item) => {
  const vc = vcById.get(i.vc_id)!;
  return i.labels?.about_this_vc === false || (vc.ambiguous && i.sources.includes('tavily')) || !firmHit(text(i), vc);
};

const bucketOf = (i: Item): string => {
  if (likelyNamesake(i)) return 'likely_namesake';
  const src = i.sources.includes('google_news') || i.sources.includes('google_news_appearance') ? 'gnews' : i.published_at ? 'tavily_dated' : 'tavily_undated';
  return `${i.status === 'accepted' ? 'accepted' : 'rejected'}_${src}`;
};

const chosen: Item[] = [];
const perVc = new Map<string, number>();
const take = (pool: Item[], n: number, maxPerVc: number) => {
  for (const it of pool) {
    if (n <= 0 || chosen.length >= TARGET) break;
    if (chosen.includes(it) || (perVc.get(it.vc_id) ?? 0) >= maxPerVc) continue;
    chosen.push(it); perVc.set(it.vc_id, (perVc.get(it.vc_id) ?? 0) + 1); n--;
  }
};

const buckets = new Map<string, Item[]>();
for (const it of shuffle(seen)) { const b = bucketOf(it); buckets.set(b, [...(buckets.get(b) ?? []), it]); }

take(buckets.get('likely_namesake') ?? [], NAMESAKE_TARGET, 2);
// Round-robin the remaining buckets, preferring VC diversity, then relax the per-VC cap.
for (const cap of [2, 3, 99]) {
  const rest = [...buckets.entries()].filter(([k]) => k !== 'likely_namesake').map(([, v]) => v);
  let progressed = true;
  while (chosen.length < TARGET && progressed) {
    progressed = false;
    for (const pool of rest) { const before = chosen.length; take(pool, 1, cap); if (chosen.length > before) progressed = true; }
  }
  if (chosen.length < TARGET) take(buckets.get('likely_namesake') ?? [], TARGET - chosen.length, cap);
}

const lines = chosen.map((i) => {
  const vc = vcById.get(i.vc_id)!;
  return JSON.stringify({
    item_id: i.item_id, vc_name: vc.name, vc_firm: vc.firm, vc_aliases: vc.aliases, firm_aliases: vc.firmAliases,
    title: i.title, snippet: i.snippet, source: i.sources[0],
  });
});
writeFileSync(new URL('../../eval/to_label.jsonl', import.meta.url), lines.join('\n') + '\n');

const chosenIds = new Set(chosen.map((i) => i.item_id));
const fixtures = run.items.map((i) => JSON.stringify({
  item_id: i.item_id, vc_id: i.vc_id, title: i.title, snippet: i.snippet, url: i.url, source_name: i.source_name,
  published_at: i.published_at, date_approx: i.date_approx, sources: i.sources, status: i.status,
  reject_reason: i.reject_reason, labels: i.labels, in_label_set: chosenIds.has(i.item_id),
  label_bucket: chosenIds.has(i.item_id) ? bucketOf(i) : null, captured_at: run.meta.started_at,
}));
writeFileSync(new URL('../../eval/fixtures/spike_items.jsonl', import.meta.url), fixtures.join('\n') + '\n');

const counts: Record<string, number> = {};
for (const i of chosen) counts[bucketOf(i)] = (counts[bucketOf(i)] ?? 0) + 1;
console.log(`to_label: ${chosen.length} items from ${new Set(chosen.map((i) => i.vc_id)).size} VCs (pool ${seen.length})`);
console.log(counts);
console.log(`fixtures: ${run.items.length} items`);
