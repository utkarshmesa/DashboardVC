// SPEC §9.4 classifier, including the hook and its code guard. funded_company is an addition
// (docs/DECISIONS.md) so the conflict action can name the company; a code guard keeps it verbatim.
// Relevance is judged against target_space only, as a fixed level that code maps to a number; possible_competitor is
// judged against my_product only (never flagged when my_product is empty).
import { ApiError, GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { CLASSIFY_CAP, MIN_CONFIDENCE, MIN_RELEVANCE, RELEVANCE_LEVELS, RELEVANCE_VALUE, type RelevanceLevel } from './config';
import { sleep } from './text';
import type { Labels, LabelUpdate, SignalStatus } from './types';

export type Persona = { targetSpace: string; myProduct: string };

export const systemInstruction = (p: Persona) => `You classify web items about venture capital investors for a startup founder.
Founder's target space (judge relevance_level against this only): ${p.targetSpace}
Founder's product (judge possible_competitor against this only): ${p.myProduct.trim() || '(none: always set possible_competitor to false)'}

For each item, using ONLY the provided title and snippet:
- about_this_vc: true only if the item is about this specific person or their
  firm, not a namesake or an unrelated mention. False when the person or firm
  appears only as one entry in a list, directory, registry or ranking of many
  entities, or only in passing in someone else's content.
- confidence: 0 to 1.
- subject: person | firm
  person = the item names this specific person as the actor or speaker.
  firm   = the item is about the firm without naming the person as actor.
- signal_type: investment | authored | speaking | press | other | irrelevant
  investment = invested in or led a funding round.
  authored   = wrote, posted or published something.
  speaking   = spoke at, or appeared on, an event, panel or podcast.
  press      = quoted or profiled in the media.
  other      = any other news about the person or firm (e.g. a hire,
               promotion, fund launch or office opening).
  irrelevant = not an activity or news item: a profile, bio, "about us",
               team or social-media profile page, an investor directory or
               database entry, a contact list or registry, or text with no
               identifiable action by the person or firm.
  (Type and subject are independent: a firm-level funding announcement is
   signal_type=investment, subject=firm.)
- relevance_level: core | logistics_non_software | adjacent | unrelated,
  judged against the founder's target space only.
  core                   = the item's subject (the funded company, the topic
                           written or spoken about) is software squarely in the
                           target space.
  logistics_non_software = logistics or supply-chain business that is not
                           software (e.g. carriers, 3PLs, warehousing, freight
                           forwarding, packaging, logistics hardware).
  adjacent               = related but outside the target space: other B2B or
                           enterprise software, manufacturing or industrial tech,
                           commerce enablement, generic fintech or AI tooling.
  unrelated              = anything else (consumer, D2C, health, generic
                           investing or startup advice, personal news).
- possible_competitor: true only for an investment in a company that the
  title or snippet itself describes as selling substantially the same product
  as the founder's product. If true, competitor_evidence must be the exact
  words from the title or snippet (max 12 words) that describe that product.
  If the text doesn't describe the product, set false. Never use outside
  knowledge for this field.
- funded_company: for signal_type investment, the name of the funded company
  exactly as written in the title or snippet; otherwise null.
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

export const responseSchema = {
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
          relevance_level: { type: Type.STRING, enum: [...RELEVANCE_LEVELS] },
          possible_competitor: { type: Type.BOOLEAN },
          competitor_evidence: { type: Type.STRING, nullable: true },
          funded_company: { type: Type.STRING, nullable: true },
          role_change_hint: { type: Type.STRING, nullable: true },
          event_key: { type: Type.STRING },
          summary: { type: Type.STRING },
          hook: { type: Type.STRING, nullable: true },
        },
        required: ['item_id', 'about_this_vc', 'confidence', 'subject', 'signal_type', 'relevance_level', 'possible_competitor',
          'competitor_evidence', 'funded_company', 'role_change_hint', 'event_key', 'summary', 'hook'],
      },
    },
  },
  required: ['items'],
};

export const LabelItemZ = z.object({
  item_id: z.number().int(),
  about_this_vc: z.boolean(),
  confidence: z.number().min(0).max(1),
  subject: z.enum(['person', 'firm']),
  signal_type: z.enum(SIGNAL_TYPES),
  relevance_level: z.enum(RELEVANCE_LEVELS),
  possible_competitor: z.boolean(),
  competitor_evidence: z.string().nullable(),
  funded_company: z.string().nullable(),
  role_change_hint: z.string().nullable(),
  event_key: z.string(),
  summary: z.string(),
  hook: z.string().nullable(),
});
export const ResponseZ = z.object({ items: z.array(LabelItemZ) });

export class GeminiFailed extends Error {}

export type ClassifyInput = {
  item_id: number;
  vc_id: string;
  vc_name: string;
  vc_firm: string;
  vc_aliases: string[];
  firm_aliases: string[];
  title: string;
  snippet: string | null;
  source: string;
};

// `schema` defaults to the classifier response schema; other callers (openers) pass their own.
export type GenerateFn = (args: { apiKey: string; model: string; system: string; contents: string; schema?: unknown }) => Promise<string>;

export const geminiGenerate: GenerateFn = async ({ apiKey, model, system, contents, schema }) => {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction: system, responseMimeType: 'application/json', responseSchema: (schema ?? responseSchema) as typeof responseSchema, temperature: 0 },
  });
  return res.text ?? '';
};

export type ClassifyOptions = {
  keys: string[];
  model: string;
  persona: Persona;
  generate?: GenerateFn;
  backoffMs?: number[];
  thresholds?: Thresholds;
};

export type ClassifyResult = {
  updates: LabelUpdate[];
  unclassified: number[];   // item_ids left without labels after an invalid-output retry
  failedVcIds: string[];    // VCs whose items were in a call that failed after retries
  calls: number;
  http429: number;
  errors: string[];
};

function retryAfterMs(e: unknown): number | null {
  const m = String((e as Error)?.message ?? '').match(/retryDelay"?\s*:\s*"?(\d+(?:\.\d+)?)s/);
  return m ? Math.ceil(Number(m[1]) * 1000) : null;
}

export type Thresholds = { minConfidence: number; minRelevance: number };
export const DEFAULT_THRESHOLDS: Thresholds = { minConfidence: MIN_CONFIDENCE, minRelevance: MIN_RELEVANCE };

export function acceptance(l: Labels, t: Thresholds = DEFAULT_THRESHOLDS): { status: SignalStatus; reject_reason: string | null } {
  if (!l.about_this_vc) return { status: 'rejected', reject_reason: 'llm_not_about_vc' };
  if (l.signal_type === 'irrelevant') return { status: 'rejected', reject_reason: 'llm_irrelevant' };
  if (l.confidence < t.minConfidence) return { status: 'rejected', reject_reason: 'llm_low_confidence' };
  if (l.relevance < t.minRelevance) return { status: 'rejected', reject_reason: 'llm_low_relevance' };
  return { status: 'accepted', reject_reason: null };
}

const HOOK_STOPLIST = new Set(['i', "i'm", 'i’m', 'your', 'congrats', 'saw', 'loved', 'read']);

// SPEC §9.4 hook guard: every number and every capitalised word in the hook must appear (case-insensitive) in the
// item's title, snippet, VC name, VC aliases or firm name; sentence-initial words and a small stoplist are exempt.
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
      if (!hay.includes(core.replace(/['’]s$/i, '').toLowerCase())) return false;
    }
  }
  return true;
}

// Model output → stored labels: the relevance number is mapped in code from the fixed level.
export function toLabels(raw: Omit<z.infer<typeof LabelItemZ>, 'item_id'>): Labels {
  return { ...raw, relevance: RELEVANCE_VALUE[raw.relevance_level as RelevanceLevel] };
}

// SPEC §9.4 competitor guard, plus the same verbatim rule for funded_company. No product → never a competitor.
export function applyGuards(l: Labels, item: { title: string; snippet: string | null; vc_name?: string; vc_aliases?: string[]; vc_firm?: string }, myProduct = 'x'): Labels {
  const text = `${item.title} ${item.snippet ?? ''}`.toLowerCase();
  const inText = (s: string | null) => !!s && !!s.trim() && text.includes(s.trim().toLowerCase());
  const out = { ...l };
  if (!myProduct.trim()) out.possible_competitor = false;
  if (out.possible_competitor && !inText(out.competitor_evidence)) { out.possible_competitor = false; out.competitor_evidence = null; }
  if (!out.possible_competitor) out.competitor_evidence = null;
  if (!inText(out.funded_company)) out.funded_company = null;
  if (out.hook) {
    const support = [item.title, item.snippet ?? '', item.vc_name ?? '', ...(item.vc_aliases ?? []), item.vc_firm ?? ''].join(' ');
    if (!out.hook.trim() || !hookSupported(out.hook, support)) out.hook = null;
  }
  return out;
}

// Parses model output; returns null if it is not valid against the schema.
export function parseResponse(text: string): z.infer<typeof ResponseZ> | null {
  try {
    const r = ResponseZ.safeParse(JSON.parse(text));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export async function classify(items: ClassifyInput[], opts: ClassifyOptions): Promise<ClassifyResult> {
  const generate = opts.generate ?? geminiGenerate;
  const backoffs = opts.backoffMs ?? [2000, 4000, 8000];
  const out: ClassifyResult = { updates: [], unclassified: [], failedVcIds: [], calls: 0, http429: 0, errors: [] };
  const system = systemInstruction(opts.persona);
  let keyIndex = 0;

  for (let i = 0; i < items.length; i += CLASSIFY_CAP) {
    const chunk = items.slice(i, i + CLASSIFY_CAP);
    const contents = JSON.stringify(chunk.map(({ vc_id: _vc, ...rest }) => rest));
    let parsed: z.infer<typeof ResponseZ> | null = null;
    let attempt = 0, invalid = 0, authFailures = 0;
    try {
      for (;;) {
        out.calls++;
        let text: string;
        try {
          text = await generate({ apiKey: opts.keys[keyIndex % opts.keys.length], model: opts.model, system, contents });
        } catch (e) {
          const status = e instanceof ApiError ? e.status : ((e as { status?: number }).status ?? 0);
          out.errors.push(`gemini ${status || 'network'}: ${String((e as Error).message).slice(0, 200)}`);
          // An invalid key comes back as 400 API_KEY_INVALID (not 401), so treat it as an auth failure and rotate keys.
          const badKey = status === 400 && /API_KEY_INVALID|API key not valid/i.test(String((e as Error).message));
          if (status === 401 || status === 403 || badKey) {
            if (++authFailures >= opts.keys.length) throw new GeminiFailed(`all Gemini keys rejected (${status})`);
            keyIndex++;
            continue;
          }
          if (status === 429) out.http429++;
          if (status === 429 || status >= 500 || status === 0) {
            if (attempt >= backoffs.length) throw new GeminiFailed(`Gemini failed after retries (${status || 'network'})`);
            if (status === 429 && opts.keys.length > 1) keyIndex++;
            await sleep(Math.min(retryAfterMs(e) ?? backoffs[attempt], 30_000));
            attempt++;
            continue;
          }
          throw new GeminiFailed(`Gemini error ${status}`);
        }
        parsed = parseResponse(text);
        if (parsed) break;
        out.errors.push('gemini invalid JSON output');
        if (invalid++ >= 1) break; // retry once, then mark unclassified
      }
    } catch (e) {
      if (!(e instanceof GeminiFailed)) throw e;
      out.errors.push(e.message);
      out.failedVcIds.push(...new Set(chunk.map((c) => c.vc_id)));
      continue;
    }

    const ids = new Set(chunk.map((c) => c.item_id));
    const byItem = new Map(chunk.map((c) => [c.item_id, c]));
    const seen = new Set<number>();
    for (const l of parsed?.items ?? []) {
      if (!ids.has(l.item_id) || seen.has(l.item_id)) continue; // ignore unknown or repeated ids
      seen.add(l.item_id);
      const { item_id, ...raw } = l;
      const labels = applyGuards(toLabels(raw), byItem.get(item_id)!, opts.persona.myProduct);
      const verdict = acceptance(labels, opts.thresholds);
      out.updates.push({ id: item_id, ...labels, hook: verdict.status === 'accepted' ? labels.hook : null, ...verdict });
    }
    for (const c of chunk) if (!seen.has(c.item_id)) out.unclassified.push(c.item_id);
  }
  out.failedVcIds = [...new Set(out.failedVcIds)];
  return out;
}
