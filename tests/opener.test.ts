import { describe, expect, it } from 'vitest';
import type { GenerateFn } from '@/lib/classifier';
import { assembleDraft, DEFAULT_ASK, generateOpeners, openerHash, openerSupported, type OpenerInput } from '@/lib/opener';

const vc: Omit<OpenerInput, 'key'> = {
  vc_name: 'Prajakt Raut', firm: 'Caret Capital', thesis: 'Early-stage thematic fund: Distribution & Supply Chain',
  fit_reason: 'Supply-chain sector lead; firm backed Yantra Packs seed in 2026 and Enmovil logistics SaaS pre-Series A.', latest_relevant_deal: '2026-08',
};
const settings = { pitch: 'We build TMS software for Indian shippers. Raising a seed.', senderName: 'Vikram', ask: '' };

describe('opener guard', () => {
  it('keeps openers grounded in the research text', () => {
    expect(openerSupported("Caret's backing of Enmovil and Yantra Packs shows a clear supply-chain focus.", vc)).toBe(true);
  });
  it('drops unsupported names, caveats and overlong openers', () => {
    expect(openerSupported('Your investment in Delhivery shows supply-chain focus.', vc)).toBe(false);
    expect(openerSupported('Despite unverified deal credits, Caret backs Enmovil.', vc)).toBe(false);
    expect(openerSupported(Array(40).fill('word').join(' '), vc)).toBe(false);
  });
  it('hash changes with the research text or prompt', () => {
    expect(openerHash(vc)).not.toBe(openerHash({ ...vc, fit_reason: 'Different note' }));
  });
});

describe('generateOpeners', () => {
  it('applies the guard per item and maps results by key', async () => {
    const gen: GenerateFn = async () => JSON.stringify({ items: [
      { key: 0, opener: "Caret's backing of Enmovil shows a supply-chain focus." },
      { key: 1, opener: 'Your firm backed Delhivery.' },
    ] });
    const r = await generateOpeners([{ key: 0, ...vc }, { key: 1, ...vc }], { keys: ['k'], model: 'm', generate: gen });
    expect(r.openers.get(0)).toMatch(/^Caret/);
    expect(r.openers.get(1)).toBeNull();
  });
  it('a failed call produces no openers and an error, never a throw', async () => {
    const gen: GenerateFn = async () => { throw new Error('quota'); };
    const r = await generateOpeners([{ key: 0, ...vc }], { keys: ['k'], model: 'm', generate: gen });
    expect(r.openers.size).toBe(0);
    expect(r.errors[0]).toMatch(/quota/);
  });
});

describe('assembleDraft', () => {
  it('outreach: greeting with first name, hook then opener, the founder pitch, ask, sign-off', () => {
    const d = assembleDraft({ vcName: 'Prajakt Raut', opener: "Caret's backing of Enmovil stood out.", hook: null, settings });
    expect(d.subject).toBe('We build TMS software for Indian shippers');
    expect(d.body.split('\n')).toEqual(['Hi Prajakt,', '', "Caret's backing of Enmovil stood out.", '', settings.pitch, '', DEFAULT_ASK, '', 'Best,', 'Vikram']);
  });
  it('placeholders when the founder has not filled settings', () => {
    const d = assembleDraft({ vcName: 'A B', opener: null, hook: null, settings: { pitch: '', senderName: '', ask: '' } });
    expect(d.body).toContain('[Add your one-line pitch in Settings]');
    expect(d.body).toContain('[Your name]');
  });
  it('nudge: references the earlier note and a fresh hook', () => {
    const d = assembleDraft({ vcName: 'Prajakt Raut', opener: null, hook: 'Saw the Yantra Packs news.', settings, nudgeSince: '3 Oct' });
    expect(d.subject).toMatch(/^Re: /);
    expect(d.body).toContain('Following up on my note from 3 Oct. Saw the Yantra Packs news.');
  });
});
