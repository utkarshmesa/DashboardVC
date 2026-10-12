// Review item 5 (docs/PLAN-NEXT.md): research-grounded cold-email openers and a code-assembled draft.
// Gemini turns the verified research note into ONE opener sentence; a code guard drops any opener with a name or number
// not present in the research text, VC name or firm, or that leaks a research caveat. The draft around it is assembled
// in code from Vikram's own pitch line, so the AI never makes claims about his company.
import { Type } from '@google/genai';
import { z } from 'zod';
import { geminiGenerate, hookSupported, type GenerateFn } from './classifier';
import { sha256 } from './text';

export const OPENER_PROMPT_VERSION = 'opener-v2';

export type OpenerInput = { key: number; vc_name: string; firm: string; thesis: string | null; fit_reason: string | null; latest_relevant_deal: string | null };

const SYSTEM = `You write the first sentence of a cold email from a startup founder to a venture capital investor.
For each item you get the investor, their firm, the firm's thesis and a verified research note about their relevant deals.

Write ONE sentence (max 30 words) that shows the founder knows why this investor is relevant, using ONLY facts in the
thesis or research note.
- If the note credits a deal to the firm (not the person), say "your firm" or the firm name, never "you backed".
- Use only positive, verified facts. Never mention caveats, uncertainties, conflicts, fund-size disputes or titles.
- Start with the specific fact (e.g. "Caret's backing of Enmovil…" or "Your firm's seed in …"), never with
  "I am reaching out", "I wanted to" or similar; vary the phrasing between items.
- No flattery, no claims about the founder's company, no questions, no greetings.
- If the note has no usable fact, return null.
Return every key exactly once.`;

const schema = {
  type: Type.OBJECT,
  properties: { items: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { key: { type: Type.INTEGER }, opener: { type: Type.STRING, nullable: true } }, required: ['key', 'opener'] } } },
  required: ['items'],
};
const OutZ = z.object({ items: z.array(z.object({ key: z.number().int(), opener: z.string().nullable() })) });

const CAVEAT = /\b(caveat|uncertain|unverified|not verified|ambiguous|conflict|discrepan|disagree|unproven|remain firm-level|preserve|must not)\b/i;

export const openerHash = (i: Omit<OpenerInput, 'key'>) =>
  sha256(JSON.stringify([OPENER_PROMPT_VERSION, i.vc_name, i.firm, i.thesis ?? '', i.fit_reason ?? '', i.latest_relevant_deal ?? '']));

export function openerSupported(opener: string, i: Omit<OpenerInput, 'key'>): boolean {
  const words = opener.trim().split(/\s+/).length;
  if (!opener.trim() || words > 35 || CAVEAT.test(opener)) return false;
  return hookSupported(opener, [i.fit_reason ?? '', i.latest_relevant_deal ?? '', i.thesis ?? '', i.vc_name, i.firm].join(' '));
}

export async function generateOpeners(items: OpenerInput[], opts: { keys: string[]; model: string; generate?: GenerateFn }) {
  const generate = opts.generate ?? geminiGenerate;
  const out = new Map<number, string | null>();
  const errors: string[] = [];
  let calls = 0;
  for (let i = 0; i < items.length; i += 25) {
    const chunk = items.slice(i, i + 25);
    let text = '';
    try {
      calls++;
      text = await generate({ apiKey: opts.keys[0], model: opts.model, system: SYSTEM, contents: JSON.stringify(chunk), schema });
    } catch (e) {
      errors.push(`opener generation: ${(e as Error).message.slice(0, 160)}`);
      continue;
    }
    let parsed: z.infer<typeof OutZ> | null = null;
    try { parsed = OutZ.parse(JSON.parse(text)); } catch { errors.push('opener generation: invalid JSON'); continue; }
    for (const r of parsed.items) {
      const src = chunk.find((c) => c.key === r.key);
      if (!src) continue;
      out.set(r.key, r.opener && openerSupported(r.opener, src) ? r.opener.trim() : null);
    }
  }
  return { openers: out, calls, errors };
}

// ---- Draft (code-assembled) ----

export type DraftSettings = { pitch: string; senderName: string; ask: string; deckUrl?: string };
export const DEFAULT_ASK = 'Would you be open to a 20-minute call in the next two weeks?';

export function assembleDraft(d: { vcName: string; opener: string | null; hook: string | null; settings: DraftSettings; nudgeSince?: string | null }): { subject: string; body: string } {
  const first = d.vcName.trim().split(/\s+/)[0];
  const subjectBase = d.settings.pitch.trim().split(/[.!?]/)[0].slice(0, 70) || 'Intro and seed round';
  const deck = d.settings.deckUrl?.trim() ? `Deck: ${d.settings.deckUrl.trim()}` : null;
  if (d.nudgeSince !== undefined) {
    // Follow-up nudge: short, references the earlier email and any fresh hook; no new claims.
    const lines = [`Hi ${first},`, '', `Following up on my note${d.nudgeSince ? ` from ${d.nudgeSince}` : ''}.${d.hook ? ` ${d.hook}` : ''}`, '',
      d.settings.pitch.trim() || '[Add your one-line pitch in Settings]', '', d.settings.ask.trim() || DEFAULT_ASK, '', 'Best,', d.settings.senderName.trim() || '[Your name]'];
    return { subject: `Re: ${subjectBase}`, body: lines.join('\n') };
  }
  const pitch = d.settings.pitch.trim() || '[Add your one-line pitch in Settings]';
  const lines = [`Hi ${first},`, '', // One personal line: the fit-grounded opener; the news hook only when there is no opener.
    d.opener ?? d.hook ?? '', '', pitch, ...(deck ? ['', deck] : []), '', d.settings.ask.trim() || DEFAULT_ASK, '', 'Best,', d.settings.senderName.trim() || '[Your name]'];
  return { subject: subjectBase, body: lines.join('\n').replace(/\n{3,}/g, '\n\n') };
}
