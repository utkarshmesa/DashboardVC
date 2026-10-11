import { ApiError, GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { CLASSIFY_CAP, COMPANY_PROFILE, MIN_CONFIDENCE } from './config.js';
import { sleep } from './text.js';
import type { Item, Labels, SpikeVc } from './types.js';

export const SYSTEM_INSTRUCTION = `You classify web items about venture capital investors for a startup founder.
Founder's company: ${COMPANY_PROFILE}

For each item, using ONLY the provided title and snippet:
- about_this_vc: true only if the item is about this specific person or their
  firm, not a namesake or an unrelated mention.
- confidence: 0 to 1.
- subject: person | firm
  person = the item names this specific person as the actor or speaker.
  firm   = the item is about the firm without naming the person as actor.
- signal_type: investment | authored | speaking | press | other | irrelevant
  investment = invested in or led a funding round.
  authored   = wrote, posted or published something.
  speaking   = spoke at, or appeared on, an event, panel or podcast.
  press      = quoted or profiled in the media.
  other      = any other news about the person or firm.
  (Type and subject are independent: a firm-level funding announcement is
   signal_type=investment, subject=firm.)
- relevance: 0 to 1, how related the item is to the founder's space.
- possible_competitor: true only for an investment in a company that the
  title or snippet itself describes as selling substantially the same product
  as the founder's company. If true, competitor_evidence must be the exact
  words from the title or snippet (max 12 words) that describe that product.
  If the text doesn't describe the product, set false. Never use outside
  knowledge for this field.
- role_change_hint: if the item says the person joined, left, or is "former"
  at a firm, a short phrase; otherwise null.
- event_key: a short lowercase slug for the underlying event, so different
  articles about the same event share it.
- summary: at most 20 words, factual, only from the item text.
- hook: if about_this_vc is true and signal_type is not irrelevant, ONE
  sentence (max 25 words) the founder could open a cold email with,
  referencing this item. Use only facts present in the title or snippet.
  No flattery, no claims about the founder's company. Otherwise null.

Never invent facts. Return every item_id exactly once.`;

const SIGNAL_TYPES = ['investment', 'authored', 'speaking', 'press', 'other', 'irrelevant'] as const;

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item_id: { type: Type.INTEGER },
          about_this_vc: { type: Type.BOOLEAN },
          confidence: { type: Type.NUMBER },
          subject: { type: Type.STRING, enum: ['person', 'firm'] },
          signal_type: { type: Type.STRING, enum: [...SIGNAL_TYPES] },
          relevance: { type: Type.NUMBER },
          possible_competitor: { type: Type.BOOLEAN },
          competitor_evidence: { type: Type.STRING, nullable: true },
          role_change_hint: { type: Type.STRING, nullable: true },
          event_key: { type: Type.STRING },
          summary: { type: Type.STRING },
          hook: { type: Type.STRING, nullable: true },
        },
        required: ['item_id', 'about_this_vc', 'confidence', 'subject', 'signal_type', 'relevance',
          'possible_competitor', 'competitor_evidence', 'role_change_hint', 'event_key', 'summary', 'hook'],
      },
    },
  },
  required: ['items'],
};

const LabelSchema = z.object({
  item_id: z.number().int(),
  about_this_vc: z.boolean(),
  confidence: z.number().min(0).max(1),
  subject: z.enum(['person', 'firm']),
  signal_type: z.enum(SIGNAL_TYPES),
  relevance: z.number().min(0).max(1),
  possible_competitor: z.boolean(),
  competitor_evidence: z.string().nullable(),
  role_change_hint: z.string().nullable(),
  event_key: z.string(),
  summary: z.string(),
  hook: z.string().nullable(),
});
const ResponseZ = z.object({ items: z.array(LabelSchema) });

export type GeminiStats = {
  calls: number; http429: number; keyRotations: number; invalidJson: number; latenciesMs: number[]; errors: string[];
};
export const newGeminiStats = (): GeminiStats => ({ calls: 0, http429: 0, keyRotations: 0, invalidJson: 0, latenciesMs: [], errors: [] });

export class GeminiFailed extends Error {}

export type GeminiCtx = { keys: string[]; model: string; stats: GeminiStats };
let keyIndex = 0;

function retryAfterMs(e: unknown): number | null {
  const m = String((e as Error)?.message ?? '').match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/);
  return m ? Math.ceil(Number(m[1]) * 1000) : null;
}

// One generateContent call with SPEC §9.4 error handling. Returns parsed labels,
// or null when the output stays invalid after one retry (items become `unclassified`).
async function callGemini(payload: unknown[], ctx: GeminiCtx): Promise<z.infer<typeof ResponseZ> | null> {
  const backoffs = [2000, 4000, 8000];
  let attempt = 0, invalidRetries = 0, authFailures = 0;
  for (;;) {
    const ai = new GoogleGenAI({ apiKey: ctx.keys[keyIndex % ctx.keys.length] });
    const t0 = Date.now();
    ctx.stats.calls++;
    try {
      const res = await ai.models.generateContent({
        model: ctx.model,
        contents: JSON.stringify(payload),
        config: { systemInstruction: SYSTEM_INSTRUCTION, responseMimeType: 'application/json', responseSchema, temperature: 0 },
      });
      ctx.stats.latenciesMs.push(Date.now() - t0);
      try {
        return ResponseZ.parse(JSON.parse(res.text ?? ''));
      } catch (e) {
        ctx.stats.invalidJson++;
        ctx.stats.errors.push(`invalid output: ${String((e as Error).message).slice(0, 200)}`);
        if (invalidRetries++ >= 1) return null;
      }
    } catch (e) {
      ctx.stats.latenciesMs.push(Date.now() - t0);
      const status = e instanceof ApiError ? e.status : 0;
      ctx.stats.errors.push(`gemini ${status || 'network'}: ${String((e as Error).message).slice(0, 200)}`);
      if (status === 401 || status === 403) {
        if (++authFailures >= ctx.keys.length) throw new GeminiFailed(`all Gemini keys rejected (${status})`);
        keyIndex++; ctx.stats.keyRotations++;
        continue;
      }
      if (status === 429) ctx.stats.http429++;
      if (status === 429 || status >= 500 || status === 0) {
        if (attempt >= backoffs.length) throw new GeminiFailed(`Gemini failed after retries (${status || 'network'})`);
        if (status === 429 && ctx.keys.length > 1) { keyIndex++; ctx.stats.keyRotations++; }
        await sleep(Math.min(retryAfterMs(e) ?? backoffs[attempt], 30_000));
        attempt++;
        continue;
      }
      throw new GeminiFailed(`Gemini error ${status}`);
    }
  }
}

const HOOK_STOPLIST = new Set(['i', "i'm", 'i’m', 'your', 'congrats', 'saw', 'loved', 'read']);

// SPEC §9.4 hook guard: every number and non-initial capitalised word must appear in the supporting text.
export function hookSupported(hook: string, support: string): boolean {
  const hay = support.toLowerCase();
  const words = hook.split(/\s+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    const initial = i === 0 || /[.!?:]["'”’)]*$/.test(words[i - 1]);
    const core = words[i].replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (!core) continue;
    if (/\d/.test(core)) {
      const num = core.replace(/[^\d.]/g, '');
      if (!hay.includes(core.toLowerCase()) && !hay.replace(/,/g, '').includes(num)) return false;
      continue;
    }
    if (/^\p{Lu}/u.test(core) && !initial && !HOOK_STOPLIST.has(core.toLowerCase())) {
      const w = core.replace(/['’]s$/i, '').toLowerCase();
      if (!hay.includes(w)) return false;
    }
  }
  return true;
}

export function applyLabels(item: Item, labels: Labels, vc: SpikeVc) {
  const text = `${item.title} ${item.snippet ?? ''}`;
  const l = { ...labels };
  if (l.possible_competitor && !(l.competitor_evidence && text.toLowerCase().includes(l.competitor_evidence.toLowerCase()))) {
    l.possible_competitor = false;
    item.competitor_cleared = true;
  }
  const accepted = l.about_this_vc && l.confidence >= MIN_CONFIDENCE && l.signal_type !== 'irrelevant';
  if (!accepted) l.hook = null;
  else if (l.hook && !hookSupported(l.hook, [text, vc.name, ...vc.aliases, vc.firm].join(' '))) {
    l.hook = null;
    item.hook_dropped = true;
  }
  item.labels = l;
  item.status = accepted ? 'accepted' : 'rejected';
  item.reject_reason = accepted ? null
    : !l.about_this_vc ? 'llm_not_about_vc'
    : l.signal_type === 'irrelevant' ? 'llm_irrelevant'
    : 'llm_low_confidence';
}

// Classifies items in chunks of ≤ CLASSIFY_CAP. Throws GeminiFailed on hard failure.
export async function classifyItems(items: Item[], vcById: Map<string, SpikeVc>, ctx: GeminiCtx): Promise<void> {
  for (let i = 0; i < items.length; i += CLASSIFY_CAP) {
    const chunk = items.slice(i, i + CLASSIFY_CAP);
    const payload = chunk.map((it) => {
      const vc = vcById.get(it.vc_id)!;
      return {
        item_id: it.item_id, vc_name: vc.name, vc_firm: vc.firm, vc_aliases: vc.aliases,
        firm_aliases: vc.firmAliases, title: it.title, snippet: it.snippet, source: it.sources[0],
      };
    });
    const out = await callGemini(payload, ctx);
    const byId = new Map(chunk.map((it) => [it.item_id, it]));
    const seen = new Set<number>();
    for (const l of out?.items ?? []) {
      const it = byId.get(l.item_id);
      if (!it || seen.has(l.item_id)) continue; // ignore unknown or duplicate ids
      seen.add(l.item_id);
      const { item_id: _id, ...labels } = l;
      applyLabels(it, labels, vcById.get(it.vc_id)!);
    }
    for (const it of chunk) {
      if (!seen.has(it.item_id)) { it.status = 'unclassified'; it.reject_reason = 'llm_missing_or_invalid'; }
    }
  }
}
