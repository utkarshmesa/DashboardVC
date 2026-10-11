// SPEC §12.1 recall test: every golden event's frozen item must be accepted for the expected VC with an expected
// signal_type, and competitor events must be flagged. Classifies frozen fixture text with "now" fixed at capture time
// and a per-event window (lib/eval.ts recallWindowDays). Mirrors production enrichment: accepted snippet-less items
// get their frozen enrichment snippet and are reclassified.
//
// Modes (RECALL_MODE): replay (default, used by CI) answers from eval/fixtures/gemini_responses.json; live calls Gemini
// (npm run test:recall:live); record calls Gemini and rewrites the recording (npm run test:recall:record). Re-record
// whenever the classifier prompt, schema or golden fixtures change: replay fails on any request it has not seen.
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, it } from 'vitest';
import { classify, geminiGenerate, responseSchema, type ClassifyInput, type GenerateFn } from '@/lib/classifier';
import { DEFAULT_COMPANY_PROFILE } from '@/lib/config';
import { recallWindowDays } from '@/lib/eval';
import { filterReason } from '@/lib/filter';
import type { LabelUpdate } from '@/lib/types';

type Mode = 'replay' | 'live' | 'record';
const mode = (process.env.RECALL_MODE ?? 'replay') as Mode;
const RECORDING = new URL('../eval/fixtures/gemini_responses.json', import.meta.url);
const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter((k): k is string => !!k);
const model = process.env.GEMINI_MODEL ?? '';
if (mode !== 'replay' && (!keys.length || !model)) throw new Error(`RECALL_MODE=${mode} needs GEMINI_API_KEY and GEMINI_MODEL`);

type Recording = { model: string; recorded_at: string; responses: Record<string, string> };
const requestKey = (system: string, contents: string) =>
  createHash('sha256').update(JSON.stringify([system, contents, responseSchema])).digest('hex');

const recorded: Recording | null = existsSync(RECORDING) ? JSON.parse(readFileSync(RECORDING, 'utf8')) : null;
const fresh: Recording = { model, recorded_at: new Date().toISOString(), responses: {} };

const generate: GenerateFn = async (args) => {
  const k = requestKey(args.system, args.contents);
  if (mode === 'replay') {
    const text = recorded?.responses[k];
    if (text === undefined) throw new Error('No recorded Gemini response for this request: the prompt, schema or fixtures changed. Re-record with npm run test:recall:record.');
    return text;
  }
  const text = await geminiGenerate(args);
  if (mode === 'record') fresh.responses[k] = text;
  return text;
};

type FxItem = { title: string; snippet: string | null; url: string; published_at: string | null; enrichment?: { snippet: string; url: string } | null };
type Fixture = { event_id: string; company: string; firm: string; tracked_vc: string; vc_aliases: string[]; firm_aliases: string[]; captured_at: string; items: FxItem[] };
type GoldenEvent = { id: string; approx_date: string; expected_types: string[]; competitor_under_default_persona: boolean };

const dir = new URL('../eval/fixtures/golden/', import.meta.url);
const fixtures: Fixture[] = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const golden: GoldenEvent[] = JSON.parse(readFileSync(new URL('../seed/golden_events.json', import.meta.url), 'utf8')).events;

describe(`recall on frozen golden fixtures (${mode})`, () => {
  let byEvent: Map<string, { item: FxItem; label: LabelUpdate; enriched: boolean }[]> | undefined;

  afterAll(() => {
    if (mode === 'record') writeFileSync(RECORDING, JSON.stringify(fresh, null, 2) + '\n');
  });

  const run = async () => {
    if (byEvent) return byEvent;
    let nextId = 1;
    const index = new Map<number, { fx: Fixture; item: FxItem }>();
    const inputs: ClassifyInput[] = [];
    for (const fx of fixtures) {
      const ev = golden.find((e) => e.id === fx.event_id);
      if (!ev) throw new Error(`fixture ${fx.event_id} has no golden event`);
      const vc = { name: fx.tracked_vc, aliases: fx.vc_aliases, firm: fx.firm, firmAliases: fx.firm_aliases, ambiguous: false };
      const windowDays = recallWindowDays(ev.approx_date, fx.captured_at);
      for (const item of fx.items) {
        if (filterReason(item, vc, windowDays, new Date(fx.captured_at))) continue;
        const id = nextId++;
        index.set(id, { fx, item });
        inputs.push({ item_id: id, vc_id: fx.event_id, vc_name: fx.tracked_vc, vc_firm: fx.firm, vc_aliases: fx.vc_aliases,
          firm_aliases: fx.firm_aliases, title: item.title, snippet: item.snippet, source: 'google_news' });
      }
    }
    const opts = { keys: keys.length ? keys : ['replay'], model: model || recorded?.model || 'replay', companyProfile: DEFAULT_COMPANY_PROFILE, generate, backoffMs: [2000, 4000, 8000] };
    const first = await classify(inputs, opts);
    expect(first.failedVcIds, first.errors.join('; ')).toEqual([]);
    const labels = new Map(first.updates.map((u) => [u.id, u]));
    // Enrichment pass (SPEC §9.2): accepted, snippet-less items with a frozen enrichment snippet.
    const again = inputs.filter((i) => labels.get(i.item_id)?.status === 'accepted' && !i.snippet && index.get(i.item_id)!.item.enrichment)
      .map((i) => ({ ...i, snippet: index.get(i.item_id)!.item.enrichment!.snippet }));
    const enrichedIds = new Set(again.map((i) => i.item_id));
    if (again.length) {
      const second = await classify(again, opts);
      expect(second.failedVcIds, second.errors.join('; ')).toEqual([]);
      for (const u of second.updates) labels.set(u.id, u);
    }
    const out = new Map<string, { item: FxItem; label: LabelUpdate; enriched: boolean }[]>();
    for (const [id, { fx, item }] of index) {
      const label = labels.get(id);
      if (label) out.set(fx.event_id, [...(out.get(fx.event_id) ?? []), { item, label, enriched: enrichedIds.has(id) }]);
    }
    byEvent = out;
    return out;
  };

  it('every golden event has a frozen fixture', () => {
    expect(golden.map((e) => e.id).sort()).toEqual(fixtures.map((f) => f.event_id).sort());
  });

  it('the competitor path stays covered by at least one golden event', () => {
    expect(golden.some((e) => e.competitor_under_default_persona)).toBe(true);
  });

  for (const ev of golden) {
    it(`${ev.id}: accepted with an expected type${ev.competitor_under_default_persona ? ' and flagged as a competitor' : ''}`, async () => {
      const results = (await run()).get(ev.id) ?? [];
      const hits = results.filter((r) => r.label.status === 'accepted' && ev.expected_types.includes(r.label.signal_type));
      expect(hits.length, `no accepted ${ev.expected_types.join('/')} item; candidates: ${JSON.stringify(results.map((r) => [r.item.title, r.label.status, r.label.signal_type]))}`).toBeGreaterThan(0);
      if (ev.competitor_under_default_persona) {
        expect(hits.some((r) => r.label.possible_competitor), `not flagged: ${JSON.stringify(hits.map((r) => [r.item.title, r.enriched]))}`).toBe(true);
      }
    }, 300_000);
  }
});
