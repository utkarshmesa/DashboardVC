// SPEC §12.1 recall test: every golden event's frozen item must be accepted for the expected VC with an expected
// signal_type, and competitor events must be flagged. Runs the real classifier (Gemini) on frozen fixture text,
// with SIGNAL_WINDOW_DAYS overridden to 700 and "now" fixed at the capture time. Mirrors production enrichment:
// accepted snippet-less items get their frozen enrichment snippet and are reclassified.
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify, type ClassifyInput } from '@/lib/classifier';
import { DEFAULT_COMPANY_PROFILE } from '@/lib/config';
import { filterReason } from '@/lib/filter';
import type { LabelUpdate } from '@/lib/types';

const RECALL_WINDOW_DAYS = 700;
const keys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter((k): k is string => !!k);
const model = process.env.GEMINI_MODEL ?? '';
const live = keys.length > 0 && !!model;
if (!live && process.env.CI) throw new Error('recall test needs GEMINI_API_KEY and GEMINI_MODEL in CI');

type FxItem = { title: string; snippet: string | null; url: string; published_at: string | null; enrichment?: { snippet: string; url: string } | null };
type Fixture = { event_id: string; company: string; firm: string; tracked_vc: string; vc_aliases: string[]; firm_aliases: string[]; captured_at: string; items: FxItem[] };
type GoldenEvent = { id: string; expected_types: string[]; competitor_under_default_persona: boolean };

const dir = new URL('../eval/fixtures/golden/', import.meta.url);
const fixtures: Fixture[] = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(new URL(f, dir), 'utf8')));
const golden: GoldenEvent[] = JSON.parse(readFileSync(new URL('../seed/golden_events.json', import.meta.url), 'utf8')).events;

describe.skipIf(!live)('recall on frozen golden fixtures', () => {
  let byEvent: Map<string, { item: FxItem; label: LabelUpdate; enriched: boolean }[]>;

  const run = async () => {
    if (byEvent) return byEvent;
    let nextId = 1;
    const index = new Map<number, { fx: Fixture; item: FxItem }>();
    const inputs: ClassifyInput[] = [];
    for (const fx of fixtures) {
      const vc = { name: fx.tracked_vc, aliases: fx.vc_aliases, firm: fx.firm, firmAliases: fx.firm_aliases, ambiguous: false };
      for (const item of fx.items) {
        if (filterReason(item, vc, RECALL_WINDOW_DAYS, new Date(fx.captured_at))) continue;
        const id = nextId++;
        index.set(id, { fx, item });
        inputs.push({ item_id: id, vc_id: fx.event_id, vc_name: fx.tracked_vc, vc_firm: fx.firm, vc_aliases: fx.vc_aliases,
          firm_aliases: fx.firm_aliases, title: item.title, snippet: item.snippet, source: 'google_news' });
      }
    }
    const opts = { keys, model, companyProfile: DEFAULT_COMPANY_PROFILE };
    const first = await classify(inputs, opts);
    expect(first.failedVcIds).toEqual([]);
    const labels = new Map(first.updates.map((u) => [u.id, u]));
    // Enrichment pass (SPEC §9.2): accepted, snippet-less items with a frozen enrichment snippet.
    const again = inputs.filter((i) => labels.get(i.item_id)?.status === 'accepted' && !i.snippet && index.get(i.item_id)!.item.enrichment)
      .map((i) => ({ ...i, snippet: index.get(i.item_id)!.item.enrichment!.snippet }));
    const enrichedIds = new Set(again.map((i) => i.item_id));
    if (again.length) {
      const second = await classify(again, opts);
      expect(second.failedVcIds).toEqual([]);
      for (const u of second.updates) labels.set(u.id, u);
    }
    byEvent = new Map();
    for (const [id, { fx, item }] of index) {
      const label = labels.get(id);
      if (!label) continue;
      byEvent.set(fx.event_id, [...(byEvent.get(fx.event_id) ?? []), { item, label, enriched: enrichedIds.has(id) }]);
    }
    return byEvent;
  };

  for (const ev of golden) {
    it(`${ev.id}: accepted with an expected type${ev.competitor_under_default_persona ? ' and flagged as a competitor' : ''}`, async () => {
      const results = (await run()).get(ev.id) ?? [];
      const hits = results.filter((r) => r.label.status === 'accepted' && ev.expected_types.includes(r.label.signal_type));
      expect(hits.length, `no accepted ${ev.expected_types.join('/')} item; candidates: ${JSON.stringify(results.map((r) => [r.item.title, r.label.status, r.label.signal_type]))}`).toBeGreaterThan(0);
      if (ev.competitor_under_default_persona) {
        expect(hits.some((r) => r.label.possible_competitor), `not flagged: ${JSON.stringify(hits.map((r) => [r.item.title, r.enriched]))}`).toBe(true);
      }
    }, 180_000);
  }
});
