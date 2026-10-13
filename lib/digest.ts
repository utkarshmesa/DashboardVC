// Review item 6: a plain-text weekly digest of the plan (follow-ups, new outreach, conflicts). Pure; delivered by
// GET /api/digest and, if DIGEST_WEBHOOK_URL is set, posted after each cron run (Slack/Discord-compatible JSON).
export type DigestVc = { name: string; firm: string; action: string; section: string; whyFit: string | null; daysSinceContact: number | null; fitScore: number; summary?: string | null };

export function buildDigest(vcs: DigestVc[], appUrl: string, now = new Date()): string {
  const pick = (s: string) => vcs.filter((v) => v.section === s);
  const followups = pick('followups').sort((a, b) => (b.daysSinceContact ?? 0) - (a.daysSinceContact ?? 0));
  // Plan V2: outreach = an observable in-space signal in the last 30 days (with that signal as the reason); optional =
  // good fit but no logistics activity lately.
  const outreach = pick('thisWeek'), optional = pick('capacity');
  const conflicts = pick('conflict');
  const day = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short' });
  const lines = [`VC pipeline: ${day}`, ''];
  if (followups.length) {
    lines.push(`Follow-ups due (${followups.length}):`);
    for (const v of followups) lines.push(`• ${v.name} (${v.firm}): ${v.action}${v.daysSinceContact !== null ? `, last contact ${v.daysSinceContact} days ago` : ''}`);
    lines.push('');
  }
  lines.push(outreach.length ? `Reach out: signal this week (${outreach.length}):` : 'No investor showed logistics activity in the last 30 days.');
  for (const v of outreach) lines.push(`• ${v.name} (${v.firm}): ${v.summary ?? v.action}`);
  const item = (v: DigestVc) => `• ${v.name} (${v.firm}), fit ${v.fitScore}${v.whyFit ? ` — ${v.whyFit.split(/[;.]/)[0]}` : ''}`;
  if (optional.length) lines.push('', `Optional, if you have capacity (${optional.length}):`, ...optional.map(item));
  if (conflicts.length) lines.push('', `Check before pitching (${conflicts.length}): ${conflicts.map((v) => `${v.name} (${v.firm})`).join(', ')}`);
  lines.push('', `Drafts, evidence and one-click logging: ${appUrl}`);
  return lines.join('\n');
}

// Post the digest once per run, and only for runs that processed VCs (the finisher's empty no-op runs never post).
export function shouldPostDigest(stats: Record<string, unknown> | null): boolean {
  const s = stats ?? {};
  if (s.digest_posted_at) return false;
  return Object.values(s).some((x) => typeof x === 'object' && x !== null && ((x as { processed?: number }).processed ?? 0) > 0);
}
