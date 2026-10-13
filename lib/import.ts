import 'server-only';
// Spreadsheet import and export (stress test from Vikram's POV, 2026-10-13). Import writes ONLY Vikram's columns, through
// the human write path (update_my_fields, update_my_thesis), so the ownership guard still blocks any system column.
// A blank cell means "no change"; a row whose name and firm aren't on the list is added as a new investor.
import { toCsv } from './csv';
import { db } from './db';
import { rescoreMany } from './pipeline';
import { readSheet, type SheetIssue } from './spreadsheet';
import { supabaseStore } from './store';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
const MAX_ROWS = 500;

export type ImportResult = { updated: number; added: number; unchanged: number; issues: SheetIssue[]; error?: string };

export async function importSpreadsheet(text: string): Promise<ImportResult> {
  const sheet = readSheet(text);
  if (sheet.missingColumns.length) return { updated: 0, added: 0, unchanged: 0, issues: [], error: `The sheet needs ${sheet.missingColumns.join(' and ')} columns.` };
  if (sheet.rows.length > MAX_ROWS) return { updated: 0, added: 0, unchanged: 0, issues: [], error: `At most ${MAX_ROWS} rows per import.` };
  const cur = await db().from('vcs').select('id, name, firm, thesis, status, last_contact_date, notes');
  if (cur.error) throw new Error(cur.error.message);
  type Vc = { id: string; name: string; firm: string; thesis: string | null; status: string; last_contact_date: string | null; notes: string | null };
  const vcs = (cur.data ?? []) as Vc[];
  const issues = [...sheet.issues];
  const touched: string[] = [];
  let updated = 0, added = 0, unchanged = 0;
  for (const row of sheet.rows) {
    let vc = vcs.find((v) => norm(v.name) === norm(row.name) && norm(v.firm) === norm(row.firm));
    if (!vc) {
      // Same person under a slightly different firm spelling: match on name alone only when it is unambiguous.
      const byName = vcs.filter((v) => norm(v.name) === norm(row.name));
      if (byName.length === 1) vc = byName[0];
    }
    let isNew = false;
    if (!vc) {
      const ins = await db().from('vcs').insert({ name: row.name, firm: row.firm, status: 'not_contacted' }).select('id, name, firm, thesis, status, last_contact_date, notes').single();
      if (ins.error) { issues.push({ line: row.line, reason: `could not add: ${ins.error.message}` }); continue; }
      vc = ins.data as Vc; vcs.push(vc); added++; isNew = true;
    }
    const next = { status: row.status ?? vc.status, date: row.lastContact ?? vc.last_contact_date, notes: row.notes ?? vc.notes };
    let changed = false;
    if (next.status !== vc.status || next.date !== vc.last_contact_date || next.notes !== vc.notes) {
      const w = await db().rpc('update_my_fields', { p_id: vc.id, p_status: next.status, p_last_contact_date: next.date, p_notes: next.notes });
      if (w.error) { issues.push({ line: row.line, reason: `not saved: ${w.error.message}` }); continue; }
      changed = true;
    }
    if (row.thesis !== undefined && row.thesis !== vc.thesis) {
      const w = await db().rpc('update_my_thesis', { p_id: vc.id, p_thesis: row.thesis });
      if (w.error) { issues.push({ line: row.line, reason: `thesis not saved: ${w.error.message}` }); continue; }
      changed = true;
    }
    if (changed || isNew) touched.push(vc.id);
    if (!isNew) { if (changed) updated++; else unchanged++; }
  }
  if (added) await supabaseStore.ensureProfiles(); // new investors get a profile; the next run collects their signals
  await rescoreMany(touched);
  return { updated, added, unchanged, issues };
}

// Everything in his Supabase table, his columns first, as a spreadsheet he can open anywhere.
export async function exportCsv(): Promise<string> {
  const r = await db().from('vcs').select('name, firm, thesis, status, last_contact_date, notes, last_signal_date, signal_summary, follow_up_score, recommended_action').order('name');
  if (r.error) throw new Error(r.error.message);
  const cols = ['name', 'firm', 'thesis', 'status', 'last_contact_date', 'notes', 'last_signal_date', 'signal_summary', 'follow_up_score', 'recommended_action'] as const;
  return toCsv([...cols], (r.data ?? []).map((v) => cols.map((c) => (v as Record<string, unknown>)[c])));
}
