// Review item 6: a plain-text weekly digest of the plan (follow-ups, new outreach, conflicts). Pure; delivered by
// GET /api/digest and, if DIGEST_WEBHOOK_URL is set, posted after each cron run (Slack/Discord-compatible JSON).
export type DigestVc = { name: string; firm: string; action: string; section: string; whyFit: string | null; daysSinceContact: number | null; fitScore: number };

export function buildDigest(vcs: DigestVc[], appUrl: string, now = new Date()): string {
  const pick = (s: string) => vcs.filter((v) => v.section === s);
  const followups = pick('followups').sort((a, b) => (b.daysSinceContact ?? 0) - (a.daysSinceContact ?? 0));
  const outreach = pick('thisWeek');
  const conflicts = pick('conflict');
  const day = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short' });
  const lines = [`VC pipeline: ${day}`, ''];
  if (followups.length) {
    lines.push(`Follow-ups due (${followups.length}):`);
    for (const v of followups) lines.push(`• ${v.name} (${v.firm}): ${v.action}${v.daysSinceContact !== null ? `, last contact ${v.daysSinceContact} days ago` : ''}`);
    lines.push('');
  }
  lines.push(outreach.length ? `New outreach this week (${outreach.length}):` : 'No new outreach suggested this week.');
  for (const v of outreach) lines.push(`• ${v.name} (${v.firm}), fit ${v.fitScore}: ${v.action}${v.whyFit ? ` — ${v.whyFit.split(/[;.]/)[0]}` : ''}`);
  if (conflicts.length) lines.push('', `Check before pitching (${conflicts.length}): ${conflicts.map((v) => `${v.name} (${v.firm})`).join(', ')}`);
  lines.push('', `Drafts, evidence and one-click logging: ${appUrl}`);
  return lines.join('\n');
}
