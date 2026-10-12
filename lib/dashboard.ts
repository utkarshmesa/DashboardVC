import 'server-only';
import { REVERIFY_ROLE_DAYS, SIGNAL_WINDOW_DAYS } from './config';
import { db } from './db';
import { scoreSignals, signalAge, type ScorableSignal } from './scoring';
import type { VcRow } from './types';

// SPEC §11 sections, in display order.
export const SECTIONS = [
  { key: 'thisWeek', title: 'This week', match: (a: string) => /^(Reach out|Nudge|Mention|Warm)/.test(a), open: true },
  { key: 'conflict', title: 'Check conflict', match: (a: string) => a.startsWith('Check conflict') },
  { key: 'sameFirm', title: 'Same firm', match: (a: string) => a.startsWith('Same firm') },
  { key: 'wait', title: 'Wait', match: (a: string) => a.startsWith('Wait') },
  { key: 'quiet', title: 'Quiet — hold', match: (a: string) => a.startsWith('Quiet') },
  { key: 'low', title: 'Low priority', match: (a: string) => a.startsWith('Low') },
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
  score: number | null;
  action: string;
  summary: string | null;
  lastSignalDate: string | null;
  trust: string | null;
  section: string;
  newest: { date: string; url: string } | null;
  badges: string[];
  hook: { text: string; signalId: number } | null;
  accepted: SignalView[];
  others: SignalView[]; // rejected and undated, collapsed in the drawer
};

type Sig = ScorableSignal & {
  vc_id: string; title: string; url: string; source_name: string | null; reject_reason: string | null; relevance_level: string | null;
  confidence: number | null; about_this_vc: boolean | null; hook: string | null; role_change_hint: string | null; created_at: string;
};

const verifiedDate = (research: Record<string, unknown> | null, asOf: string | null): string | null => {
  const m = String(research?.title_verified ?? '').match(/^\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : asOf;
};

export async function loadDashboard() {
  const now = new Date();
  const [vcsR, profR, sigR, fbR] = await Promise.all([
    db().from('vcs').select('*'),
    db().from('vc_profile').select('vc_id, trust, tier, research, research_as_of'),
    db().from('signals').select('id, vc_id, title, url, source_name, published_at, date_approx, status, reject_reason, subject, signal_type, relevance, relevance_level, confidence, about_this_vc, possible_competitor, event_key, summary, hook, role_change_hint, created_at')
      .order('published_at', { ascending: false, nullsFirst: false }),
    db().from('signal_feedback').select('signal_id, verdict'),
  ]);
  for (const r of [vcsR, profR, sigR, fbR]) if (r.error) throw new Error(r.error.message);
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
      hook: s.hook, roleHint: s.role_change_hint, competitor: s.possible_competitor === true, verdict: verdicts.get(s.id) ?? null,
    });
    const scored = accepted.filter((s) => signalAge(s, now, SIGNAL_WINDOW_DAYS) !== null);
    const newestDated = scored.filter((s) => s.published_at).sort((a, b) => b.published_at!.localeCompare(a.published_at!))[0];
    const top = result.top?.signal as Sig | undefined;
    const hookSignal = (top?.hook && !top.thumbs_down ? top : scored.find((s) => s.hook && !s.thumbs_down)) as Sig | undefined;
    const badges: string[] = [];
    if (accepted.some((s) => s.role_change_hint)) badges.push('Possible move — verify');
    const verified = verifiedDate(prof?.research as Record<string, unknown> | null, prof?.research_as_of ?? null);
    if (verified && (now.getTime() - Date.parse(verified)) / 86_400_000 > REVERIFY_ROLE_DAYS) badges.push('Re-verify role');
    const action = v.recommended_action ?? 'Quiet — hold';
    return {
      id: v.id, name: v.name, firm: v.firm, status: v.status, lastContactDate: v.last_contact_date, notes: v.notes,
      score: v.follow_up_score, action, summary: v.signal_summary, lastSignalDate: v.last_signal_date, trust: prof?.trust ?? null,
      section: SECTIONS.find((sec) => sec.match(action))?.key ?? 'low',
      newest: newestDated ? { date: newestDated.published_at!, url: newestDated.url } : null,
      badges,
      hook: hookSignal?.hook ? { text: hookSignal.hook, signalId: hookSignal.id } : null,
      accepted: accepted.map(view),
      others: mine.filter((s) => s.status !== 'accepted' || (!s.published_at && !s.date_approx)).slice(0, 25).map(view),
    };
  });
  vcs.sort((a, b) => (b.score ?? -1) - (a.score ?? -1) || a.name.localeCompare(b.name));
  return { vcs, generatedAt: now.toISOString() };
}

export async function loadHeader() {
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString();
  const [runR, creditsR] = await Promise.all([
    db().from('runs').select('id, status, trigger, started_at, finished_at, stats').order('started_at', { ascending: false }).limit(20),
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
