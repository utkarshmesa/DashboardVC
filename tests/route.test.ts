import { describe, expect, it } from 'vitest';
import { assembleDraft } from '@/lib/opener';
import { formAnswers, gmailCompose, outreachRoute } from '@/lib/route';

describe('outreachRoute (real research wording)', () => {
  it('forms with a link, forms without one (search fallback), bare domains', () => {
    expect(outreachRoute('Axilor Google Form https://docs.google.com/forms/d/e/1FAIp/viewform; site warns of Telegram scams', 'Axilor Ventures'))
      .toMatchObject({ kind: 'form', url: 'https://docs.google.com/forms/d/e/1FAIp/viewform', label: 'Apply via form' });
    const r = outreachRoute('Open founder application form with pitch-deck upload.', 'Arali Ventures');
    expect(r).toMatchObject({ kind: 'form', url: null, label: 'Find the application form' });
    expect(r.findUrl).toContain('Arali%20Ventures');
    expect(outreachRoute('Apply at mountjudi.com/apply', 'Mount Judi Ventures')).toMatchObject({ kind: 'form', url: 'https://mountjudi.com/apply' });
    expect(outreachRoute('Public Pitch to Us form linked from official site.', 'X').kind).toBe('form');
  });
  it('closed programmes and "no pitch form" are not forms', () => {
    expect(outreachRoute('Sonic programme application route exists, but observed February 2026 deadline has passed; do not label applications currently open.', 'X').kind).not.toBe('form');
    expect(outreachRoute('Contact page only (no pitch form)', 'X').kind).toBe('contact');
  });
  it('email, LinkedIn (only with a known handle), contact, unknown', () => {
    expect(outreachRoute("Alok's official biography explicitly invites founders to write to him.", 'Stellaris').kind).toBe('email');
    const li = 'Warm introduction fastest; explicitly reviews cold inbound via website or LinkedIn.';
    expect(outreachRoute(li, 'X', 'pranavpai')).toMatchObject({ kind: 'linkedin', url: 'https://www.linkedin.com/in/pranavpai' });
    expect(outreachRoute(li, 'X').kind).toBe('unknown');
    expect(outreachRoute('Contact page only https://www.aeravti.com/contact', 'Aeravti')).toMatchObject({ kind: 'contact', url: 'https://www.aeravti.com/contact' });
    expect(outreachRoute('not publicly verified', 'X').kind).toBe('unknown');
    expect(outreachRoute(null, 'X').kind).toBe('unknown');
  });
});

describe('form answers, Gmail compose, deck in drafts', () => {
  const s = { pitch: 'We build TMS software for Indian shippers. Early revenue; raising a seed.', ask: '', deckUrl: 'https://docsend.com/view/abc', senderName: 'Vikram' };
  it('form answers come only from Settings, with placeholders when empty', () => {
    const a = formAnswers(s);
    expect(a).toContain('One-line pitch: We build TMS software for Indian shippers.');
    expect(a).toContain('Deck: https://docsend.com/view/abc');
    expect(formAnswers({ pitch: '', ask: '', deckUrl: '', senderName: '' })).toContain('[Add your deck link in Settings]');
  });
  it('Gmail compose URL encodes subject and body', () => {
    const u = new URL(gmailCompose('Intro & seed', 'Hi A,\n\nLine 2'));
    expect(u.hostname).toBe('mail.google.com');
    expect(u.searchParams.get('su')).toBe('Intro & seed');
    expect(u.searchParams.get('body')).toBe('Hi A,\n\nLine 2');
  });
  it('the deck link goes into outreach and nudge drafts when set', () => {
    expect(assembleDraft({ vcName: 'A B', opener: null, hook: null, settings: s }).body).toContain('\n\nDeck: https://docsend.com/view/abc\n\n');
    expect(assembleDraft({ vcName: 'A B', opener: null, hook: null, settings: { ...s, deckUrl: '' } }).body).not.toContain('Deck:');
  });
});
