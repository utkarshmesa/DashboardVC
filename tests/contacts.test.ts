import { describe, expect, it } from 'vitest';
import { domainOf, extractEmails, nameParts, pickContact } from '@/lib/contacts';

describe('contact emails', () => {
  it('extracts plain, mailto and obfuscated addresses and drops junk', () => {
    const html = '<a href="mailto:Alok@StellarisVP.com">Mail</a> pitch [at] stellarisvp [dot] com, logo@2x.png, x@sentry.io, team&#64;stellarisvp.com.';
    expect(extractEmails(html).sort()).toEqual(['alok@stellarisvp.com', 'pitch@stellarisvp.com', 'team@stellarisvp.com']);
  });
  it("prefers the partner's own address on the firm domain, then a firm inbox, never another domain", () => {
    const emails = ['pitch@stellarisvp.com', 'alok.goyal@stellarisvp.com', 'press@portfolio.io'];
    expect(pickContact(emails, 'Alok Goyal', 'stellarisvp.com', 'https://stellarisvp.com/team')).toMatchObject({ email: 'alok.goyal@stellarisvp.com', kind: 'personal' });
    expect(pickContact(['pitch@stellarisvp.com'], 'Alok Goyal', 'stellarisvp.com', null)).toMatchObject({ email: 'pitch@stellarisvp.com', kind: 'firm' });
    expect(pickContact(['agoyal@stellarisvp.com'], 'Alok Goyal', 'stellarisvp.com', null)).toMatchObject({ kind: 'personal' });
    expect(pickContact(['alok@otherfund.com', 'careers@stellarisvp.com'], 'Alok Goyal', 'stellarisvp.com', null)).toBeNull();
  });
  it('reads domains and name parts', () => {
    expect(domainOf('https://www.blume.vc')).toBe('blume.vc');
    expect(domainOf(null)).toBeNull();
    expect(nameParts('Co Founder Name')).toEqual({ first: 'Co', last: 'Name' });
  });
});
