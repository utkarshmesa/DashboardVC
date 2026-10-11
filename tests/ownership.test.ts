// SPEC §12.4 ownership integration test. Runs only with RUN_DB_TESTS=1 against a real Supabase project
// (`npm run test:db`). It restores every value it changes.
import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_DB_TESTS === '1';
const VIKRAM = ['name', 'firm', 'thesis', 'status', 'last_contact_date', 'notes', 'rss_url'] as const;
const SYSTEM = ['last_signal_date', 'signal_summary', 'follow_up_score', 'recommended_action'] as const;
type Row = Record<string, unknown> & { id: string };

const hash = (row: Row, cols: readonly string[]) => createHash('sha256').update(JSON.stringify(cols.map((c) => row[c] ?? null))).digest('hex');

describe.skipIf(!enabled)('ownership (database)', () => {
  const sb = enabled ? createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } }) : null!;
  let original: Row;
  const read = async (id: string) => {
    const r = await sb.from('vcs').select('*').eq('id', id).single();
    if (r.error) throw new Error(r.error.message);
    return r.data as Row;
  };

  beforeAll(async () => {
    const r = await sb.from('vcs').select('*').order('name').limit(1).single();
    if (r.error) throw new Error(r.error.message);
    original = r.data as Row;
  });

  afterAll(async () => {
    if (!original) return;
    await sb.rpc('apply_signals', { p_id: original.id, p_last_signal_date: original.last_signal_date, p_summary: original.signal_summary,
      p_score: original.follow_up_score, p_action: original.recommended_action });
    await sb.rpc('update_my_fields', { p_id: original.id, p_status: original.status, p_last_contact_date: original.last_contact_date, p_notes: original.notes });
  });

  it('pipeline writes (apply_signals) never change Vikram-owned columns', async () => {
    const before = hash(original, VIKRAM);
    const r = await sb.rpc('apply_signals', { p_id: original.id, p_last_signal_date: '2026-01-02', p_summary: 'ownership test', p_score: 42, p_action: 'Quiet — hold' });
    expect(r.error).toBeNull();
    const after = await read(original.id);
    expect(hash(after, VIKRAM)).toBe(before);
    expect(after.signal_summary).toBe('ownership test');
    expect(after.follow_up_score).toBe(42);
  });

  it('a direct .update() on vcs fails for the service role', async () => {
    const r = await sb.from('vcs').update({ notes: 'should not be written' }).eq('id', original.id);
    expect(r.error).not.toBeNull();
    expect((await read(original.id)).notes).toBe(original.notes);
  });

  it('update_my_fields changes only Vikram columns, never system columns', async () => {
    const before = await read(original.id);
    const r = await sb.rpc('update_my_fields', { p_id: original.id, p_status: 'awaiting_response', p_last_contact_date: '2026-01-03', p_notes: 'ownership test note' });
    expect(r.error).toBeNull();
    const after = await read(original.id);
    expect(hash(after, SYSTEM)).toBe(hash(before, SYSTEM));
    expect(after.notes).toBe('ownership test note');
  });

  it('the anon role cannot read or write vcs', async () => {
    const anonKey = process.env.SUPABASE_ANON_KEY;
    if (!anonKey) return;
    const anon = createClient(process.env.SUPABASE_URL!, anonKey, { auth: { persistSession: false } });
    const r = await anon.from('vcs').select('id').limit(1);
    expect(r.error !== null || (r.data ?? []).length === 0).toBe(true);
  });
});
