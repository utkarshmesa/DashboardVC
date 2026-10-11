// SPEC §9.4 classifier (Phase 1 subset: no competitor, role-change or hook fields yet; see docs/DECISIONS.md).
import { ApiError, GoogleGenAI, Type } from '@google/genai';
import { z } from 'zod';
import { CLASSIFY_CAP, MIN_CONFIDENCE } from './config';
import { sleep } from './text';
import type { Labels, LabelUpdate, SignalStatus } from './types';

export const systemInstruction = (companyProfile: string) => `You classify web items about venture capital investors for a startup founder.
Founder's company: ${companyProfile}

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
- event_key: a short lowercase slug for the underlying event, so different
  articles about the same event share it.
- summary: at most 20 words, factual, only from the item text.

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
          event_key: { type: Type.STRING },
          summary: { type: Type.STRING },
        },
        required: ['item_id', 'about_this_vc', 'confidence', 'subject', 'signal_type', 'relevance', 'event_key', 'summary'],
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
  relevance: z.number().min(0).max(1),
  event_key: z.string(),
  summary: z.string(),
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

export type GenerateFn = (args: { apiKey: string; model: string; system: string; contents: string }) => Promise<string>;

export const geminiGenerate: GenerateFn = async ({ apiKey, model, system, contents }) => {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model,
    contents,
    config: { systemInstruction: system, responseMimeType: 'application/json', responseSchema, temperature: 0 },
  });
  return res.text ?? '';
};

export type ClassifyOptions = {
  keys: string[];
  model: string;
  companyProfile: string;
  generate?: GenerateFn;
  backoffMs?: number[];
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

export function acceptance(l: Labels): { status: SignalStatus; reject_reason: string | null } {
  if (l.about_this_vc && l.confidence >= MIN_CONFIDENCE && l.signal_type !== 'irrelevant') return { status: 'accepted', reject_reason: null };
  return {
    status: 'rejected',
    reject_reason: !l.about_this_vc ? 'llm_not_about_vc' : l.signal_type === 'irrelevant' ? 'llm_irrelevant' : 'llm_low_confidence',
  };
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
  const system = systemInstruction(opts.companyProfile);
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
          if (status === 401 || status === 403) {
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
    const seen = new Set<number>();
    for (const l of parsed?.items ?? []) {
      if (!ids.has(l.item_id) || seen.has(l.item_id)) continue; // ignore unknown or repeated ids
      seen.add(l.item_id);
      const { item_id, ...labels } = l;
      out.updates.push({ id: item_id, ...labels, ...acceptance(labels) });
    }
    for (const c of chunk) if (!seen.has(c.item_id)) out.unclassified.push(c.item_id);
  }
  out.failedVcIds = [...new Set(out.failedVcIds)];
  return out;
}
