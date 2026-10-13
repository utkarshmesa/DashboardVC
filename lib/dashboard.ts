import 'server-only';
import { daysSince } from './actions';
import { EVIDENCE_MIN_RELEVANCE, OUTREACH_PER_WEEK, REVERIFY_ROLE_DAYS, SIGNAL_WINDOW_DAYS } from './config';
import { db } from './db';
import { competitorTerms, fitScore, researchConflict, type Research } from './fit';
import { assembleDraft, type DraftSettings } from './opener';
import { buildBrief, type Brief } from './brief';
import golden from '../seed/golden_events.json';
import { formAnswers, gmailCompose, outreachRoute, type Route } from './route';
import { loadDraftSettings, loadPersona } from './store';
import { scoreSignals, signalAge, type ScorableSignal } from './scoring';
import type { VcRow } from './types';

// SPEC §11 sections, in display order (Phase 5: follow-ups and fit-first outreach first).
// Plan V2 (DECISIONS #55): the week is follow-ups, then signal-backed outreach, then optional (fit-backed) outreach.
export const SECTIONS = [
  { key: 'followups', title: 'Follow-ups due', match: (a: string) => /^(Nudge due|Close the loop|Next step due|Nudge — reference)/.test(a), open: true },
  { key: 'thisWeek', title: 'Reach out — signal this week', match: (a: string) => a.startsWith('Reach out'), open: true },
  { key: 'conflict', title: 'Check before pitching', match: (a: string) => a.startsWith('Check conflict') },
  { key: 'capacity', title: 'If you have capacity', match: (a: string) => a.startsWith('If you have capacity') || a.startsWith('Added by you') },
  { key: 'sameFirm', title: 'Same firm', match: (a: string) => a.startsWith('Same firm') },
  { key: 'wait', title: 'Waiting / in conversation', match: (a: string) => a.startsWith('Wait') || a.startsWith('In conversation') || a.startsWith('Mention') },
  { key: 'snoozed', title: 'Snoozed', match: (a: string) => a.startsWith('Snoozed') },
  { key: 'quiet', title: 'Not worth chasing this week', match: (a: string) => a.startsWith('Quiet') || a.startsWith('Low') },
  { key: 'unavailable', title: 'Data unavailable', match: (a: string) => a.startsWith('Data unavailable') },
  { key: 'passed', title: 'Passed', match: (a: string) => a.startsWith('Passed') },
] as const;

export type SignalView = {
  id: number;
  title: string;
  url: string;
  sourceName: string | null;
  date: string | null;
  dateApprox: boolean;
  status: string;
  rejectReason: string | null;
  type: string | null;
  subject: string | null;
  relevanceLevel: string | null;
  confidence: number | null;
  aboutThisVc: boolean | null;
  contribution: number | null; // points this signal adds to the score (0 if superseded within its event)
  hook: string | null;
  context: string | null; // the snippet sentence naming this VC, when the headline doesn't
  roleHint: string | null;
  competitor: boolean;
  verdict: 'up' | 'down' | null;
};

export type VcView = {
  id: string;
  name: string;
  firm: string;
  status: VcRow['status'];
  lastContactDate: string | null;
  notes: string | null;
  thesis: string | null;
  score: number | null;
  action: string;
  summary: string | null;
  lastSignalDate: string | null;
  trust: string | null;
  section: string;
  newest: { date: string; url: string } | null;
  badges: string[];
  hook: { text: string; signalId: number } | null;
  fit: { score: number; label: 'strong' | 'good' | 'weak'; reasons: string[]; flags: string[] };
  priority: number;
  whyFit: string | null;     // research fit_reason (verified research, not AI output)
  approach: { text: string; url: string | null } | null;
  cheque: string | null;
  stage: string | null;
  daysSinceContact: number | null;
  snoozedUntil: string | null;
  conflict: { evidence: string; dismissed: boolean } | null; // standing research conflict (firm-level)
  opener: string | null;     // research-grounded opener (AI, guarded against the research text)
  draft: { subject: string; body: string } | null; // code-assembled email draft (outreach or nudge)
  route: Route;               // how to reach them, from the research approach note (REVIEW-2 item 3)
  formAnswers: string | null; // copy-ready pitch-form answers when the route is a form
  gmailUrl: string | null;    // Gmail compose with the draft filled in (To = the published address, when known)
  contact: { email: string; kind: 'personal' | 'firm'; source: 'firm_page' | 'hunter'; sourceUrl: string | null; confidence: number | null } | null;
  linkedin: { own: number; firm: number; latestUrl: string } | null;
  brief: Brief;               // investor brief: person, fund, cheque, track record (DECISIONS #50) // posts by the VC / firm page in 30 days (DECISIONS #45)
  accepted: SignalView[];
  othersCount: number; // rejected and undated items; the list itself loads on demand (GET /api/vc/[id]/others)
};

type Sig = ScorableSignal & {
  vc_id: string; title: string; snippet: string | null; url: string; source: string; source_name: string | null; funded_company: string | null; reject_reason: string | null; relevance_level: string | null;
  confidence: number | null; about_this_vc: boolean | null; hook: string | null; role_change_hint: string | null; created_at: string;
};

const verifiedDate = (research: Record<string, unknown> | null, asOf: string | null): string | null => {
  const m = String(research?.title_verified ?? '').match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : asOf;
};

export async function loadDashboard() {
  const now = new Date();
  const [vcsR, profR, sigR, fbR, firmsR, contactR] = await Promise.all([
    db().from('vcs').select('*'),
    db().from('vc_profile').select('vc_id, trust, tier, research, research_as_of, snoozed_until, conflict_dismissed_at, opener, linkedin_slug, firm_key'),
    db().from('signals').select('id, vc_id, title, snippet, url, source, source_name, published_at, date_approx, status, reject_reason, subject, signal_type, relevance, relevance_level, confidence, about_this_vc, possible_competitor, event_key, summary, hook, role_change_hint, created_at, funded_company')
      .order('published_at', { ascending: false, nullsFirst: false }),
    db().from('signal_feedback').select('signal_id, verdict'),
    db().from('firms').select('firm_key, fund_info_research'),
    db().from('vc_contact').select('vc_id, email, kind, source, source_url, confidence').not('email', 'is', null),
  ]);
  for (const r of [vcsR, profR, sigR, fbR, firmsR]) if (r.error) throw new Error(r.error.message);
  // Contact emails (DECISIONS #57) are optional: a missing table or failed read just means no addresses.
  type ContactRow = { vc_id: string; email: string; kind: 'personal' | 'firm'; source: 'firm_page' | 'hunter'; source_url: string | null; confidence: number | null };
  const contacts = new Map(((contactR.error ? [] : contactR.data ?? []) as ContactRow[]).map((c) => [c.vc_id, c]));
  const fundNote = new Map(((firmsR.data ?? []) as { firm_key: string; fund_info_research: string | null }[]).map((f) => [f.firm_key, f.fund_info_research]));
  const [persona, draftSettings] = await Promise.all([loadPersona(), loadDraftSettings()]);
  const terms = competitorTerms(persona.myProduct);
  const allVcs = vcsR.data as VcRow[];
  const verdicts = new Map((fbR.data ?? []).map((f) => [f.signal_id as number, f.verdict as 'up' | 'down']));
  const signals = (sigR.data as Sig[]).map((s) => ({ ...s, relevance: s.relevance === null ? null : Number(s.relevance), confidence: s.confidence === null ? null : Number(s.confidence), thumbs_down: verdicts.get(s.id) === 'down' }));

  const vcs: VcView[] = (vcsR.data as VcRow[]).map((v) => {
    const prof = (profR.data ?? []).find((p) => p.vc_id === v.id);
    const mine = signals.filter((s) => s.vc_id === v.id);
    const accepted = mine.filter((s) => s.status === 'accepted');
    const result = scoreSignals(accepted, now);
    const points = new Map<number, number>();
    result.groups.forEach((g, i) => points.set(g.signal.id, Math.round(100 * g.value * (i === 0 ? 1 : 0.25) * 10) / 10));
    const view = (s: (typeof mine)[number]): SignalView => ({
      id: s.id, title: s.title, url: s.url, sourceName: s.source_name, date: s.published_at, dateApprox: s.date_approx, status: s.status,
      rejectReason: s.reject_reason, type: s.signal_type, subject: s.subject, relevanceLevel: s.relevance_level, confidence: s.confidence,
      aboutThisVc: s.about_this_vc, contribution: s.status === 'accepted' && signalAge(s, now, SIGNAL_WINDOW_DAYS) !== null ? (points.get(s.id) ?? 0) : null,
      hook: s.hook, context: namingLine(s.title, s.snippet, v.name, v.firm), roleHint: s.role_change_hint, competitor: s.possible_competitor === true, verdict: verdicts.get(s.id) ?? null,
    });
    const scored = accepted.filter((s) => signalAge(s, now, SIGNAL_WINDOW_DAYS) !== null);
    const newestDated = scored.filter((s) => s.published_at).sort((a, b) => b.published_at!.localeCompare(a.published_at!))[0];
    const top = result.top?.signal as Sig | undefined;
    void top;
    // Hooks come only from in-space signals (the reason to write); off-topic activity never becomes an opener.
    const inSpace = result.groups.map((g) => g.signal as Sig).filter((s) => (s.relevance ?? 0) >= EVIDENCE_MIN_RELEVANCE && s.published_at && !s.thumbs_down);
    const hookSignal = inSpace.find((s) => s.hook);
    const lead = inSpace[0] ?? newestDated;
    const badges: string[] = [];
    if (accepted.some((s) => s.role_change_hint)) badges.push('Possible move — verify');
    const verified = verifiedDate(prof?.research as Record<string, unknown> | null, prof?.research_as_of ?? null);
    if (verified && (now.getTime() - Date.parse(verified)) / 86_400_000 > REVERIFY_ROLE_DAYS) badges.push('Re-verify role');
    const action = v.recommended_action ?? 'Quiet — hold';
    const research = (prof?.research ?? null) as Research | null;
    const fit = fitScore({ tier: prof?.tier ?? null, trust: prof?.trust ?? null, thesis: v.thesis, research }, persona.targetSpace, now);
    const peers = allVcs.filter((x) => x.firm === v.firm).map((x) => ((profR.data ?? []).find((p) => p.vc_id === x.id)?.research ?? null) as Research | null);
    const standing = researchConflict(peers, terms);
    const posts = mine.filter((s) => s.source === 'linkedin' && s.published_at && (now.getTime() - Date.parse(s.published_at)) / 86_400_000 <= 30);
    const draft = draftFor(v, action, (prof?.opener as string | null) ?? null, hookSignal?.hook ?? null, draftSettings);
    const route = outreachRoute(research?.approach ? String(research.approach) : null, v.firm, (prof?.linkedin_slug as string | null) ?? null);
    const approachText = research?.approach ? String(research.approach) : null;
    return {
      id: v.id, name: v.name, firm: v.firm, status: v.status, lastContactDate: v.last_contact_date, notes: v.notes, thesis: v.thesis,
      score: v.follow_up_score, action, summary: v.signal_summary, lastSignalDate: v.last_signal_date, trust: prof?.trust ?? null,
      section: SECTIONS.find((sec) => sec.match(action))?.key ?? 'low',
      newest: lead ? { date: lead.published_at!, url: lead.url } : null,
      badges,
      hook: hookSignal?.hook ? { text: hookSignal.hook, signalId: hookSignal.id } : null,
      fit,
      priority: fit.score + 0.5 * (v.follow_up_score ?? 0),
      whyFit: research?.fit_reason ? String(research.fit_reason) : null,
      approach: approachText ? { text: approachText, url: approachText.match(/https?:\/\/\S+/)?.[0] ?? null } : null,
      cheque: research?.first_cheque ? String(research.first_cheque) : null,
      stage: research?.stage_focus ? String(research.stage_focus) : null,
      daysSinceContact: daysSince(v.last_contact_date, now),
      snoozedUntil: prof?.snoozed_until ?? null,
      conflict: standing ? { evidence: standing.evidence, dismissed: !!prof?.conflict_dismissed_at } : null,
      opener: (prof?.opener as string | null) ?? null,
      draft,
      route,
      formAnswers: draft && route.kind === 'form' && v.status === 'not_contacted' ? formAnswers(draftSettings) : null,
      // New outreach goes to the published address; a nudge is a reply in his existing thread (no To needed there).
      gmailUrl: draft ? gmailCompose(draft.subject, draft.body, v.status === 'not_contacted' ? contacts.get(v.id)?.email ?? '' : '') : null,
      contact: contacts.has(v.id) ? { email: contacts.get(v.id)!.email, kind: contacts.get(v.id)!.kind, source: contacts.get(v.id)!.source, sourceUrl: contacts.get(v.id)!.source_url, confidence: contacts.get(v.id)!.confidence } : null,
      brief: buildBrief({
        research: prof?.research as Record<string, unknown> | null, thesis: v.thesis, trust: prof?.trust ?? null, linkedinSlug: (prof?.linkedin_slug as string | null) ?? null,
        firmFund: fundNote.get(prof?.firm_key as string) ?? null, firmName: v.firm, fitFlags: fit.flags, roundSize: draftSettings.roundSize,
        // Competitor flags only when Vikram has described his product (the golden set's competitor labels assume one).
        competitors: terms.length ? [...golden.events.filter((g) => g.competitor_under_default_persona).map((g) => g.company), ...terms] : [],
        // Verified deals: the structured golden events for this VC/firm, plus accepted investment signals naming the company verbatim.
        verifiedDeals: [
          ...golden.events.filter((g) => g.tracked_vc === v.name || g.firm === v.firm).map((g) => ({ company: g.company, round: g.round, date: g.approx_date, url: g.sources[0] ?? null })),
          ...accepted.filter((s) => s.signal_type === 'investment' && s.funded_company && !s.thumbs_down).map((s) => ({ company: s.funded_company!, round: null, date: s.published_at, url: s.url })),
        ],
      }),
      linkedin: posts.length ? { own: posts.filter((s) => s.source_name === 'LinkedIn (own post)').length, firm: posts.filter((s) => s.source_name !== 'LinkedIn (own post)').length, latestUrl: posts[0].url } : null,
      accepted: accepted.map(view),
      othersCount: Math.min(25, mine.filter((s) => s.status !== 'accepted' || (!s.published_at && !s.date_approx)).length),
    };
  });
  // A firm's website found through one partner's research serves every partner at that firm.
  const sites = new Map(vcs.filter((v) => v.brief.website).map((v) => [v.firm.toLowerCase(), v.brief.website]));
  for (const v of vcs) v.brief.website ??= sites.get(v.firm.toLowerCase()) ?? null;
  // Follow-ups: longest-waiting first; everything else by priority (fit + 0.5 × recent-signal score).
  vcs.sort((a, b) => (a.section === 'followups' && b.section === 'followups' ? (b.daysSinceContact ?? 0) - (a.daysSinceContact ?? 0) : 0)
    || b.priority - a.priority || a.name.localeCompare(b.name));
  // Runway (REVIEW-2 item 2): firms still to contact with a fit-based outreach action, in weeks at the weekly cap.
  const firmsLeft = new Set(vcs.filter((v) => v.status === 'not_contacted' && /^(Reach out|If you have capacity|Quiet — good fit|Added by you)/.test(v.action)).map((v) => v.firm.toLowerCase())).size;
  const runway = { firms: firmsLeft, weeks: Math.round((firmsLeft / OUTREACH_PER_WEEK) * 10) / 10, perWeek: OUTREACH_PER_WEEK };
  return { vcs, runway, generatedAt: now.toISOString() };
}

export async function loadHeader() {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [runR, creditsR] = await Promise.all([
    db().from('runs').select('id, status, trigger, started_at, finished_at, stats').order('started_at', { ascending: false }).limit(300), // wide enough that empty finisher/test runs never hide the last real run
    db().from('runs').select('tavily_credits').gte('started_at', monthStart),
  ]);
  // Show the latest run that processed VCs (finisher/no-op runs that found nothing due would otherwise hide it).
  type RunRow = { id: string; status: string; trigger: string; started_at: string; finished_at: string | null; stats: Record<string, { processed?: number }> | null };
  const processed = (r: RunRow) => Object.values(r.stats ?? {}).reduce((n, st) => n + (st?.processed ?? 0), 0);
  const runs = (runR.data ?? []) as RunRow[];
  const real = runs.find((r) => processed(r) > 0) ?? runs[0] ?? null;
  return {
    lastRun: real ? { ...real, processed: processed(real) } : null,
    credits: (creditsR.data ?? []).reduce((s, r) => s + (r.tavily_credits ?? 0), 0),
  };
}

// Next Vercel Cron slot (30 0 * * 1,4 UTC = Mon/Thu 06:00 IST).
export function nextScheduledRun(now = new Date()): Date {
  for (let d = 0; d < 8; d++) {
    const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + d, 0, 30));
    if ([1, 4].includes(t.getUTCDay()) && t > now) return t;
  }
  return now;
}

// The sentence of a snippet that names the VC (last name or the firm's first word), shown when the headline doesn't, so
// a passing mention ("…raised from Stellaris last year…") is visibly about this VC.
function namingLine(title: string, snippet: string | null, name: string, firm: string): string | null {
  const keys = [name.trim().split(/\s+/).at(-1)!, firm.trim().split(/\s+/)[0]].filter((k) => k.length >= 3).map((k) => k.toLowerCase());
  const has = (t: string) => keys.some((k) => new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(t));
  if (has(title) || !snippet) return null;
  const sentence = snippet.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).find(has);
  return sentence ? sentence.slice(0, 220) : null;
}

// Outreach draft for new-outreach / queued VCs, nudge draft for follow-ups; none for conflicts, passed or waiting.
function draftFor(v: VcRow, action: string, opener: string | null, hook: string | null, settings: DraftSettings) {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  if (/^(Nudge|Close the loop)/.test(action)) {
    const since = v.last_contact_date ? `${Number(v.last_contact_date.slice(8, 10))} ${MONTHS[Number(v.last_contact_date.slice(5, 7)) - 1]}` : null;
    return assembleDraft({ vcName: v.name, opener: null, hook, settings: { ...settings, ask: settings.ask }, nudgeSince: since });
  }
  // Signal tier: the signal is the reason to write, so it is the personal line. Otherwise the research opener.
  if (action.startsWith('Reach out') && v.status === 'not_contacted') return assembleDraft({ vcName: v.name, opener: hook ?? opener, hook: null, settings });
  if (/^(If you have capacity|Quiet — good fit|Added by you)/.test(action) && v.status === 'not_contacted') return assembleDraft({ vcName: v.name, opener, hook: null, settings });
  return null;
}
