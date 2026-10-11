import { describe, expect, it } from 'vitest';
import { filterReason } from '@/lib/filter';

const NOW = new Date('2026-10-12T00:00:00Z');
const vc = { name: 'Gowri Shankar', aliases: ['Gowri Shankar Nagarajan'], firm: 'Peak XV', firmAliases: ['Sequoia India', 'Peak XV Partners'] };
const item = (title: string, published_at: string | null = '2026-10-10T00:00:00Z', snippet: string | null = null) => ({ title, snippet, published_at });

describe('filter (SPEC §9.3, Phase 1 rules)', () => {
  it('accepts name, alias or firm alias mentions', () => {
    expect(filterReason(item('Gowri Shankar on AI'), vc, 30, NOW)).toBeNull();
    expect(filterReason(item('A chat with Gowri Shankar Nagarajan'), vc, 30, NOW)).toBeNull();
    expect(filterReason(item('Sequoia India backs startup'), vc, 30, NOW)).toBeNull();
    expect(filterReason(item('Startup raises', undefined, 'led by Peak XV'), vc, 30, NOW)).toBeNull();
  });
  it('rejects items naming neither person nor firm; whole words only', () => {
    expect(filterReason(item('Unrelated news'), vc, 30, NOW)).toBe('no_name_or_firm');
    expect(filterReason(item('Peak XVI summit'), vc, 30, NOW)).toBe('no_name_or_firm');
  });
  it('window boundary in UTC: exactly 30 days passes, older is rejected; undated passes', () => {
    expect(filterReason(item('Peak XV', '2026-09-12T00:00:00Z'), vc, 30, NOW)).toBeNull();
    expect(filterReason(item('Peak XV', '2026-09-11T23:59:59Z'), vc, 30, NOW)).toBe('out_of_window');
    expect(filterReason(item('Peak XV', null), vc, 30, NOW)).toBeNull();
  });
});
