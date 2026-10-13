// Contact emails (DECISIONS #57): code extracts addresses that a firm publishes on its own pages, or that the Hunter API
// returns with a confidence score. Only addresses on the firm's own domain are kept, so a portfolio company's or a
// press contact's address never ends up in a draft. Pure; scripts/find-emails.ts does the fetching.

export type Contact = { email: string; kind: 'personal' | 'firm'; source: 'firm_page' | 'hunter'; sourceUrl: string | null; confidence: number | null };

// Firm inboxes founders are invited to use.
const FIRM_INBOX = /^(pitch|pitches|pitching|hello|hi|info|contact|contactus|founders|founder|invest|investments|deals|dealflow|team|submissions?|apply|startups|partners|connect|ideas|bizplans?|plans)$/;
const JUNK = /\.(png|jpe?g|gif|svg|webp|css|js)$|@(example|sentry|wixpress|domain|email|yourcompany)\./i;

export function extractEmails(html: string): string[] {
  const text = html
    .replace(/&#64;|&#x40;|\s*\[\s*at\s*\]\s*|\s*\(\s*at\s*\)\s*/gi, '@')
    .replace(/&#46;|\s*\[\s*dot\s*\]\s*|\s*\(\s*dot\s*\)\s*/gi, '.')
    .replace(/%40/g, '@');
  const found = text.match(/[a-z0-9][a-z0-9._%+-]{0,63}@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi) ?? [];
  return [...new Set(found.map((e) => e.toLowerCase().replace(/\.+$/, '')))].filter((e) => !JUNK.test(e));
}

const onDomain = (email: string, domain: string) => { const d = email.split('@')[1] ?? ''; return d === domain || d.endsWith(`.${domain}`); };
const tokens = (name: string) => name.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((t) => t.length >= 3);

// The partner's own address (local part names them: alok, alok.goyal, agoyal, goyal) beats a firm inbox.
export function pickContact(emails: string[], person: string, domain: string, sourceUrl: string | null): Contact | null {
  const mine = emails.filter((e) => onDomain(e, domain));
  const [first, ...rest] = tokens(person);
  const last = rest.at(-1);
  const local = (e: string) => e.split('@')[0].replace(/[._-]/g, '');
  const personal = mine.find((e) => {
    const l = local(e);
    return (!!first && l.includes(first)) || (!!last && (l.includes(last) || (!!first && l === `${first[0]}${last}`)));
  });
  if (personal) return { email: personal, kind: 'personal', source: 'firm_page', sourceUrl, confidence: null };
  const inbox = mine.find((e) => FIRM_INBOX.test(e.split('@')[0]));
  return inbox ? { email: inbox, kind: 'firm', source: 'firm_page', sourceUrl, confidence: null } : null;
}

export const domainOf = (site: string | null) => { try { return site ? new URL(site).hostname.replace(/^www\./, '') : null; } catch { return null; } };
export const nameParts = (name: string) => { const t = name.trim().split(/\s+/); return { first: t[0] ?? '', last: t.length > 1 ? t[t.length - 1] : '' }; };
export const HUNTER_MIN_SCORE = 70;
