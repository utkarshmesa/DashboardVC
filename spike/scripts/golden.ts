// Captures each golden event with its own "Company" "Firm" Google News query (no when:),
// freezes the raw items to /eval/fixtures/golden/, and classifies them with a 700-day window.
import { mkdirSync, writeFileSync } from 'node:fs';
import { GOLDEN } from '../data/golden.js';
import { VCS } from '../data/vcs.js';
import { loadEnv } from '../lib/config.js';
import { runGolden } from '../lib/core.js';

let env;
try { env = loadEnv(['gemini']); } catch (e) { console.error(String((e as Error).message)); process.exit(1); }

const g = await runGolden(GOLDEN, VCS, env, { log: (m) => console.log(m) });
const capturedAt = g.meta.started_at;

const fixturesDir = new URL('../../eval/fixtures/golden/', import.meta.url);
mkdirSync(fixturesDir, { recursive: true });
for (const p of g.perEvent) {
  const vc = VCS.find((v) => v.name === p.event.tracked_vc && v.firm === p.event.firm)!;
  writeFileSync(new URL(`${p.event.id}.json`, fixturesDir), JSON.stringify({
    event_id: p.event.id,
    company: p.event.company,
    firm: p.event.firm,
    tracked_vc: p.event.tracked_vc,
    vc_aliases: vc.aliases,
    firm_aliases: vc.firmAliases,
    query: p.query,
    collector: 'google_news',
    captured_at: capturedAt,
    http_status: p.status ?? null,
    error: p.error ?? null,
    // Exactly what the classifier sees, plus link and source date. No article text.
    items: p.raw.map((r) => ({ title: r.title, snippet: r.snippet, url: r.url, source_name: r.source_name, published_at: r.published_at })),
  }, null, 2) + '\n');
}

const { perEvent: _raw, ...report } = g;
mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
writeFileSync(new URL('../out/golden.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report.summary, null, 2));
for (const r of report.results) {
  console.log(`${r.id}: raw=${r.raw_items} mentions=${r.company_mentions} found=${r.found} (type=${r.accepted_expected_type}, competitor_ok=${r.competitor_ok})`);
}
