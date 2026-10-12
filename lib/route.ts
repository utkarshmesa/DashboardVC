// REVIEW-2 item 3: how to reach a VC, read from the verified research "approach" note (code only, no AI).
// Many VCs ask for a form (pitch fields, deck upload) rather than an email, so the card adapts.
export type RouteKind = 'form' | 'email' | 'linkedin' | 'contact' | 'unknown';
export type Route = { kind: RouteKind; url: string | null; findUrl: string | null; label: string };

const URL_RE = /\bhttps?:\/\/[^\s;,)]+|\b(?:[a-z0-9-]+\.)+(?:com|in|vc|co|io|capital|ventures|fund)(?:\/[^\s;,)]*)?/i;

export function outreachRoute(approach: string | null, firm: string, linkedinSlug: string | null = null): Route {
  const text = (approach ?? '').trim();
  const raw = text.match(URL_RE)?.[0] ?? null;
  const url = raw ? (raw.startsWith('http') ? raw : `https://${raw}`).replace(/[.]$/, '') : null;
  const find = (what: string) => `https://www.google.com/search?q=${encodeURIComponent(`${firm} ${what}`)}`;
  const closed = /deadline has passed|do not label applications currently open|no pitch form/i.test(text);
  if (!closed && /\b(form|apply|application|pitch to us|get investment|founder application)\b/i.test(text)) {
    return { kind: 'form', url, findUrl: url ? null : find('pitch form apply'), label: url ? 'Apply via form' : 'Find the application form' };
  }
  if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text) || /\b(write to (him|her|them)|email|inbox)\b/i.test(text)) {
    return { kind: 'email', url: null, findUrl: find('contact email'), label: 'Email' };
  }
  if (/\bLinkedIn\b/.test(text) && linkedinSlug) {
    return { kind: 'linkedin', url: `https://www.linkedin.com/in/${linkedinSlug}`, findUrl: null, label: 'Message on LinkedIn' };
  }
  if (/\b(contact|get in touch|write to us)\b/i.test(text)) {
    return { kind: 'contact', url, findUrl: url ? null : find('contact'), label: url ? 'Contact page' : 'Find the contact page' };
  }
  return { kind: 'unknown', url: null, findUrl: null, label: 'Route not verified' };
}

// Copy-ready answers for a pitch form, from Vikram's own Settings (never AI-written).
export function formAnswers(s: { pitch: string; ask: string; deckUrl: string; senderName: string }): string {
  const pitch = s.pitch.trim();
  const oneLiner = pitch.split(/(?<=[.!?])\s/)[0] ?? '';
  return [
    `One-line pitch: ${oneLiner || '[Add your pitch in Settings]'}`,
    `Short description: ${pitch || '[Add your pitch in Settings]'}`,
    `Round: Seed, USD 1–3M`,
    `Deck: ${s.deckUrl.trim() || '[Add your deck link in Settings]'}`,
    `Contact: ${s.senderName.trim() || '[Your name]'}`,
  ].join('\n');
}

// Gmail web compose with subject and body filled in; Vikram adds the address (research stores none).
export function gmailCompose(subject: string, body: string, to = ''): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body });
  return `https://mail.google.com/mail/?${q.toString()}`;
}
