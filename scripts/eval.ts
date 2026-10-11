// npm run eval — SPEC §12.2. Classifies the hand-labelled items with the current classifier, splits once into
// tune/test (persisted in eval/split.json), tunes MIN_CONFIDENCE and MIN_RELEVANCE on tune, reports the gate on test.
// Predictions are cached in eval/predictions.json per model; pass --refresh to reclassify.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { classify, type ClassifyInput } from '../lib/classifier';
import { DEFAULT_COMPANY_PROFILE, MIN_CONFIDENCE, MIN_RELEVANCE } from '../lib/config';
import { evaluateLabels, GATE, splitIds, tuneThresholds, type GoldLabel } from '../lib/eval';
import type { Labels } from '../lib/types';

const path = (p: string) => new URL(`../eval/${p}`, import.meta.url);
const readJsonl = <T>(p: string): T[] => readFileSync(path(p), 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));

if (!existsSync(path('labels.jsonl'))) {
  console.log('eval/labels.jsonl not found. Label eval/to_label.jsonl as described in SETUP.md, save it as eval/labels.jsonl, then rerun.');
  process.exit(1);
}

const gold = readJsonl<GoldLabel>('labels.jsonl');
const items = new Map(readJsonl<ClassifyInput & { vc_name: string }>('to_label.jsonl').map((i) => [i.item_id, i]));
const missing = gold.filter((g) => !items.has(g.item_id)).map((g) => g.item_id);
if (missing.length) { console.error(`labels reference unknown item_ids: ${missing.join(', ')}`); process.exit(1); }
console.log(`labels: ${gold.length} items (${gold.filter((g) => !g.about_this_vc).length} not about this VC)`);

// Split once.
let split: { tune: number[]; test: number[] };
if (existsSync(path('split.json'))) split = JSON.parse(readFileSync(path('split.json'), 'utf8'));
else { split = splitIds(gold.map((g) => g.item_id)); writeFileSync(path('split.json'), JSON.stringify(split, null, 2) + '\n'); console.log('created eval/split.json'); }

// Classify (cached per model).
const model = process.env.GEMINI_MODEL ?? '';
const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter((k): k is string => !!k);
type Cache = { model: string; persona: string; labels: Record<string, Labels> };
let cache: Cache | null = existsSync(path('predictions.json')) ? JSON.parse(readFileSync(path('predictions.json'), 'utf8')) : null;
const needed = gold.map((g) => g.item_id).filter((id) => !cache || cache.model !== model || cache.persona !== DEFAULT_COMPANY_PROFILE || !cache.labels[id] || process.argv.includes('--refresh'));
if (needed.length) {
  if (!keys.length || !model) { console.error('Missing required env: GEMINI_API_KEY, GEMINI_MODEL'); process.exit(1); }
  const res = await classify(needed.map((id) => ({ ...items.get(id)!, item_id: id, vc_id: items.get(id)!.vc_name })),
    { keys, model, companyProfile: DEFAULT_COMPANY_PROFILE, thresholds: { minConfidence: 0, minRelevance: 0 } });
  if (res.failedVcIds.length) { console.error(`Gemini failed: ${res.errors.join('; ')}`); process.exit(1); }
  const fresh = cache && cache.model === model && cache.persona === DEFAULT_COMPANY_PROFILE ? cache.labels : {};
  for (const u of res.updates) {
    const { id, status: _s, reject_reason: _r, ...labels } = u;
    fresh[id] = labels;
  }
  cache = { model, persona: DEFAULT_COMPANY_PROFILE, labels: fresh };
  writeFileSync(path('predictions.json'), JSON.stringify(cache, null, 2) + '\n');
  console.log(`classified ${needed.length} items with ${model} (${res.calls} calls)`);
}
const pred = new Map(Object.entries(cache!.labels).map(([k, v]) => [Number(k), v]));

const pick = (ids: number[]) => gold.filter((g) => ids.includes(g.item_id));
const tuneGold = pick(split.tune), testGold = pick(split.test);
const fmt = (x: number | null) => (x === null ? 'n/a' : x.toFixed(3));

const current = { minConfidence: MIN_CONFIDENCE, minRelevance: MIN_RELEVANCE };
const { best, metGate } = tuneThresholds(tuneGold, pred);
const testAtBest = evaluateLabels(testGold, pred, best.t);
const testAtCurrent = evaluateLabels(testGold, pred, current);
const passes = (testAtBest.acceptance.precision ?? 0) >= GATE.acceptancePrecision && (testAtBest.about.precision ?? 0) >= GATE.aboutPrecision;

const report = {
  model, generated_at: new Date().toISOString(), labels: gold.length, tune: tuneGold.length, test: testGold.length,
  tuned: { ...best.t, tune_metrics: best.m, met_gate_on_tune: metGate },
  test_at_tuned: testAtBest, test_at_current_constants: { thresholds: current, metrics: testAtCurrent },
  gate: GATE, gate_passed_on_test: passes,
};
writeFileSync(path('eval_report.json'), JSON.stringify(report, null, 2) + '\n');

console.log(`\nTuned on ${tuneGold.length} items: MIN_CONFIDENCE=${best.t.minConfidence} MIN_RELEVANCE=${best.t.minRelevance}${metGate ? '' : ' (no setting met the gate on tune)'}`);
console.log(`Test (${testGold.length} items) at tuned thresholds:`);
console.log(`  acceptance precision ${fmt(testAtBest.acceptance.precision)}  recall ${fmt(testAtBest.acceptance.recall)}  (gate ≥ ${GATE.acceptancePrecision})`);
console.log(`  about_this_vc precision ${fmt(testAtBest.about.precision)}  recall ${fmt(testAtBest.about.recall)}  (gate ≥ ${GATE.aboutPrecision})`);
console.log(`  type accuracy ${fmt(testAtBest.typeAccuracy)}`);
console.log(`Gate on test: ${passes ? 'PASSED' : 'NOT MET'}. Report: eval/eval_report.json`);
