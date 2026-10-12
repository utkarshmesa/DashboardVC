import { describe, expect, it } from 'vitest';
import { cleanPostText, linkedinDue, linkedinHookSafe, parsePostUrl, postDate, toPostItems } from '@/lib/linkedin';

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
      .toBe('Lightspeed India. We backed X.');
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

describe('stress: adversarial inputs', () => {
  it('author must match exactly: prefixes, look-alikes and other people are dropped', () => {
    const mk = (author: string) => ({ url: url(author), content: 'We backed a freight startup.' });
    expect(toPostItems([mk('hemantmohapatra2'), mk('xhemantmohapatra'), mk('lightspeed-india-fan'), mk('lightspeed')], vc)).toEqual([]);
    expect(toPostItems([mk('HemantMohapatra')], vc)).toHaveLength(1); // case-insensitive
  });
  it('handles subdomains, ugcPost/share ids, and rejects malformed or feed URLs', () => {
    expect(parsePostUrl('https://in.linkedin.com/posts/hemantmohapatra_x-ugcPost-7505582179767193600-Ab')?.id).toBe('7505582179767193600');
    expect(parsePostUrl('https://www.linkedin.com/posts/hemantmohapatra_x-share-7505582179767193600-Ab')?.author).toBe('hemantmohapatra');
    expect(parsePostUrl('https://www.linkedin.com/feed/update/urn:li:activity:7505582179767193600/')).toBeNull();
    expect(parsePostUrl('https://www.linkedin.com/posts/hemantmohapatra_x-activity-750558217976-Ab')).toBeNull(); // short id
    expect(parsePostUrl('https://evil.example/linkedin.com/posts/x')).toBeNull();
  });
  it('a future-dated or garbage id gives no date rather than a wrong one', () => {
    expect(postDate('9999999999999999999')).toBeNull();
    expect(postDate('0000000000000000000')).toBeNull();
  });
  it('strips profile headers, timestamps and UI text', () => {
    expect(cleanPostText("Mitesh Shah's Post. View profile for Mitesh Shah · Mitesh Shah. Partner. 3one4 Capital 1w · Engineering value. Report this post"))
      .toBe('Mitesh Shah. Partner. 3one4 Capital Engineering value.');
    expect(cleanPostText('Our team’s Postgres migration went well')).toBe('Our team’s Postgres migration went well');
  });
  it('drops items with no text left after cleaning', () => {
    expect(toPostItems([{ url: url('hemantmohapatra'), content: "Hemant's Post. View profile for Hemant Mohapatra · 69,678 followers" }], vc)).toEqual([]);
  });
});

describe('stress: hooks from LinkedIn must be the VC’s own words', () => {
  it('blocks profile headlines and comments by others; allows real post text', () => {
    expect(linkedinHookSafe('LinkedIn post by Dev Khare: Dev Khare Partner at Lightspeed | Backing founders', 'Dev Khare')).toBe(false);
    expect(linkedinHookSafe('Thank you Gowri for the shoutout! Would love to chat', 'Gowri Shankar')).toBe(false);
    expect(linkedinHookSafe('Rohit Bansal is an Influencer. Titan capital is stellar as always!', 'Rohit Bansal')).toBe(false);
    expect(linkedinHookSafe('Hi Kushal, loved this', 'Kushal Bhagia')).toBe(false);
    expect(linkedinHookSafe('ani Amit Somani Managing Partner, Prime Ventures (Backing insightful entrepreneurs)', 'Amit Somani')).toBe(false);
    expect(linkedinHookSafe('Siddarth Pai and Anurag Ramdasan on Public Markets and Software Infrastructure at GFF 2026.', 'Anurag Ramdasan')).toBe(true);
    expect(linkedinHookSafe('Nishit Garg. Partner at RTP Global || ex-Flipkart', 'Nishit Garg')).toBe(false);
    expect(linkedinHookSafe('Congrats Rohit on the new fund!', 'Rohit Bansal')).toBe(false);
    // not false positives: posts about the person, and posts thanking others
    expect(linkedinHookSafe('Anurag Ramdasan, Partner at 3one4 Capital, joined Dinesh Pai to map fintech capital.', 'Anurag Ramdasan')).toBe(true);
    expect(linkedinHookSafe('Thank you to everyone who joined our founder summit. Congratulations to the Accel portfolio on the IPO.', 'Shekhar Kirani')).toBe(true);
    expect(linkedinHookSafe('I started looking at logistics space at the beginning of 2017 when we started Stellaris.', 'Alok Goyal')).toBe(true);
  });
});

describe('stress: classifier drops unsafe LinkedIn hooks in code', () => {
  it('keeps the label but nulls a hook taken from a profile header', async () => {
    const { classify } = await import('@/lib/classifier');
    const gen = async ({ contents }: { contents: string }) => JSON.stringify({ items: (JSON.parse(contents) as { item_id: number }[]).map((i) => ({
      item_id: i.item_id, about_this_vc: true, confidence: 0.9, subject: 'person', signal_type: 'authored', relevance_level: 'adjacent', possible_competitor: false,
      competitor_evidence: null, funded_company: null, role_change_hint: null, event_key: `e${i.item_id}`, summary: 'Posted', hook: 'I noticed your post on backing founders in India.' })) });
    const base = { vc_id: 'v', vc_name: 'Dev Khare', vc_firm: 'Lightspeed', vc_aliases: [], firm_aliases: [], title: 'LinkedIn post by Dev Khare: x' };
    const r = await classify([
      { ...base, item_id: 1, source: 'linkedin', snippet: 'Dev Khare Partner at Lightspeed | Backing founders in India' },
      { ...base, item_id: 2, source: 'linkedin', snippet: 'We are backing founders in India building AI services.' },
    ], { keys: ['k'], model: 'm', generate: gen, persona: { targetSpace: 'logistics software', myProduct: '' } });
    expect(r.updates.find((u) => u.id === 1)).toMatchObject({ status: 'accepted', hook: null });
    expect(r.updates.find((u) => u.id === 2)?.hook).toMatch(/backing founders/);
  });
});
