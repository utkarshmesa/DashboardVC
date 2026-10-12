import { describe, expect, it } from 'vitest';
import { buildDigest, shouldPostDigest } from '@/lib/digest';
import { computeFunnel, statusEvent, type OutreachEvent } from '@/lib/funnel';

const ev = (vc: string, event: string, at: string, fit = 'strong', hook = false): OutreachEvent => ({ vc_id: vc, event, at, fit_label: fit, had_hook: hook });

describe('outcome funnel', () => {
  it('maps status changes to events', () => {
    expect(statusEvent('not_contacted', 'awaiting_response')).toBe('emailed');
    expect(statusEvent('awaiting_response', 'awaiting_response')).toBeNull();
    expect(statusEvent('awaiting_response', 'in_conversation')).toBe('replied');
    expect(statusEvent('in_conversation', 'passed')).toBe('passed');
  });
  it('counts replies and meetings after the first email, by fit and by hook', () => {
    const f = computeFunnel([
      ev('a', 'emailed', '2026-10-01', 'strong', true), ev('a', 'replied', '2026-10-05'), ev('a', 'meeting', '2026-10-07'),
      ev('b', 'emailed', '2026-10-01', 'strong', false), ev('b', 'nudged', '2026-10-09'),
      ev('c', 'emailed', '2026-10-02', 'good', false), ev('c', 'replied', '2026-10-03'),
      ev('d', 'replied', '2026-10-01'), // no email logged: not an attempt
    ]);
    expect(f.total).toMatchObject({ emailed: 3, replied: 2, meeting: 1 });
    expect(f.byFit.find((r) => r.group === 'strong')).toMatchObject({ emailed: 2, replied: 1, meeting: 1, replyRate: 0.5 });
    expect(f.byHook.find((r) => r.group === 'without news hook')).toMatchObject({ emailed: 2, replied: 1 });
  });
});

describe('digest', () => {
  it('lists follow-ups (longest waiting first), new outreach and conflicts, with the app link', () => {
    const t = buildDigest([
      { name: 'A', firm: 'FA', action: 'Nudge due — follow up on your email', section: 'followups', whyFit: null, daysSinceContact: 9, fitScore: 80 },
      { name: 'B', firm: 'FB', action: 'Close the loop — no reply in 3 weeks', section: 'followups', whyFit: null, daysSinceContact: 22, fitScore: 70 },
      { name: 'C', firm: 'FC', action: 'Reach out — strong fit', section: 'thisWeek', whyFit: 'Supply-chain sector lead; more', daysSinceContact: null, fitScore: 92 },
      { name: 'D', firm: 'FD', action: 'Check conflict — backed a TMS company', section: 'conflict', whyFit: null, daysSinceContact: null, fitScore: 78 },
    ], 'https://app.example/', new Date('2026-10-15T01:00:00Z'));
    expect(t).toMatch(/Follow-ups due \(2\):\n• B .*22 days ago\n• A /);
    expect(t).toContain('• C (FC), fit 92: Reach out — strong fit — Supply-chain sector lead');
    expect(t).toContain('Check before pitching (1): D (FD)');
    expect(t).toContain('https://app.example/');
  });
  it('lists Warm cards separately as optional', () => {
    const t = buildDigest([
      { name: 'C', firm: 'FC', action: 'Reach out — strong fit', section: 'thisWeek', whyFit: null, daysSinceContact: null, fitScore: 90 },
      { name: 'W', firm: 'FW', action: 'Warm — reach out if capacity', section: 'thisWeek', whyFit: null, daysSinceContact: null, fitScore: 60 },
    ], 'https://app.example/');
    expect(t).toContain('New outreach this week (1):\n• C ');
    expect(t).toContain('Optional, if you have capacity (1):\n• W ');
  });
  it('posts once per run, only when the run processed VCs', () => {
    expect(shouldPostDigest({ step_a: { processed: 10 } })).toBe(true);
    expect(shouldPostDigest({})).toBe(false);
    expect(shouldPostDigest({ step_a: { processed: 0 } })).toBe(false);
    expect(shouldPostDigest({ step_a: { processed: 10 }, digest_posted_at: '2026-10-15T01:00:00Z' })).toBe(false);
  });
});
