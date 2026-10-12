import { describe, expect, it } from 'vitest';
import { cleanPostText, linkedinDue, parsePostUrl, postDate, toPostItems } from '@/lib/linkedin';

const vc = { name: 'Hemant Mohapatra', firm: 'Lightspeed', linkedinSlug: 'hemantmohapatra', firmLinkedinSlug: 'lightspeed-india' };
const url = (author: string) => `https://www.linkedin.com/posts/${author}_its-hard-to-understand-ai-activity-7505582179767193600-ICVt?utm_source=share`;

describe('LinkedIn post parsing', () => {
  it('reads the author and the activity id from a post URL', () => {
    expect(parsePostUrl(url('Lightspeed-India'))).toEqual({ author: 'lightspeed-india', id: '7505582179767193600' });
    expect(parsePostUrl('https://www.linkedin.com/in/hemantmohapatra')).toBeNull();
    expect(parsePostUrl('https://www.linkedin.com/pulse/some-article-x')).toBeNull();
  });
  it('dates a post from its id (top 41 bits = ms since epoch)', () => {
    expect(postDate('7505582179767193600')).toBe('2026-09-15T11:03:58.630Z');
    expect(postDate('123')).toBeNull();
  });
  it('strips LinkedIn sign-up boilerplate', () => {
    expect(cleanPostText('Agree & Join LinkedIn By clicking Continue to join or sign in, you agree to LinkedIn’s User Agreement, Privacy Policy, and Cookie Policy. Lightspeed India. 69,678 followers. We backed X.'))
      .toBe('Lightspeed India. . We backed X.');
  });
});

describe('toPostItems', () => {
  it('keeps only posts by the VC or their firm page, titled with the author and dated', () => {
    const items = toPostItems([
      { url: url('hemantmohapatra'), title: "Hemant's Post", content: 'AI is shifting how logistics software gets built.' },
      { url: url('lightspeed-india'), title: "Lightspeed India's Post", content: 'Second edition of Sarvam Guild, with Hemant Mohapatra.' },
      { url: url('ved-chaubey-2565172a9'), title: 'Pitching Lightspeed', content: 'We are pitching Lightspeed and Hemant Mohapatra today.' },
    ], vc);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ source: 'linkedin', source_name: 'LinkedIn (own post)', published_at: '2026-09-15T11:03:58.630Z' });
    expect(items[0].title).toMatch(/^LinkedIn post by Hemant Mohapatra: AI is shifting/);
    expect(items[0].url).not.toContain('?');
    expect(items[1]).toMatchObject({ source_name: 'LinkedIn (firm page)' });
    expect(items[1].title).toMatch(/^LinkedIn post by Lightspeed:/);
  });
  it('drops everything when no handle is known', () => {
    expect(toPostItems([{ url: url('hemantmohapatra'), content: 'x' }], { ...vc, linkedinSlug: null, firmLinkedinSlug: null })).toEqual([]);
  });
});

describe('weekly gating', () => {
  const now = new Date('2026-10-15T00:30:00Z');
  it('runs only with a known handle and at most every 6 days', () => {
    expect(linkedinDue({ linkedinSlug: null, firmLinkedinSlug: null, linkedinCheckedAt: null }, now)).toBe(false);
    expect(linkedinDue({ linkedinSlug: 'x', firmLinkedinSlug: null, linkedinCheckedAt: null }, now)).toBe(true);
    expect(linkedinDue({ linkedinSlug: 'x', firmLinkedinSlug: null, linkedinCheckedAt: '2026-10-12T00:30:00Z' }, now)).toBe(false); // Mon → Thu
    expect(linkedinDue({ linkedinSlug: null, firmLinkedinSlug: 'f', linkedinCheckedAt: '2026-10-08T00:30:00Z' }, now)).toBe(true);
  });
});
