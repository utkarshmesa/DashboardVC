// Spreadsheet import (stress test from Vikram's POV, 2026-10-13): he keeps his 50 VCs in a spreadsheet (name, firm,
// thesis, last contact, waiting for a response or yet to reach out). This reads that sheet as he'd export it, with
// forgiving column names, status words and date formats. Pure; lib/import.ts writes it through the human path.
import { parseCsv } from './csv';

export type SheetRow = { line: number; name: string; firm: string; thesis?: string; status?: 'not_contacted' | 'awaiting_response' | 'in_conversation' | 'passed'; lastContact?: string; notes?: string };
export type SheetIssue = { line: number; reason: string };

const norm = (h: string) => h.toLowerCase().replace(/[^a-z]/g, '');
const COLUMNS: Record<keyof Omit<SheetRow, 'line'>, string[]> = {
  name: ['name', 'investor', 'partner', 'person', 'vcname', 'contact', 'investorname'],
  firm: ['firm', 'fund', 'company', 'vcfirm', 'firmname'],
  thesis: ['thesis', 'focus', 'investmentthesis'],
  status: ['status', 'stage', 'state', 'pipelinestatus'],
  lastContact: ['lastcontactdate', 'lastcontact', 'lastcontacted', 'lastcontactedon', 'contactdate', 'lasttouch'],
  notes: ['notes', 'note', 'comments', 'comment', 'remarks'],
};

export function toStatus(raw: string): SheetRow['status'] | null {
  const s = raw.trim().toLowerCase();
  if (!s) return null;
  if (/pass|declin|reject|not interested|no go/.test(s)) return 'passed';
  if (/conversation|meeting|call|replied|talking|engaged|diligence/.test(s)) return 'in_conversation';
  if (/wait|awaiting|pending|sent|emailed|contacted|follow/.test(s)) return 'awaiting_response';
  if (/yet to|not contacted|to reach|to contact|new|todo|to do|not started|^-$/.test(s)) return 'not_contacted';
  return null;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
// YYYY-MM-DD, DD/MM/YYYY or DD-MM-YYYY (day first, as in India), "12 Sep 2026", "Sep 12, 2026".
export function toDate(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  const iso = (y: number, m: number, d: number) => {
    const t = new Date(Date.UTC(y, m - 1, d));
    return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t.toISOString().slice(0, 10) : null;
  };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*,?\s+(\d{4})$/i);
  if (m && MONTHS.includes(m[2].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[2].toLowerCase()) + 1, +m[1]);
  m = s.match(/^([a-z]{3})[a-z]*\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (m && MONTHS.includes(m[1].toLowerCase())) return iso(+m[3], MONTHS.indexOf(m[1].toLowerCase()) + 1, +m[2]);
  return null;
}

export function readSheet(text: string, today = new Date()): { rows: SheetRow[]; issues: SheetIssue[]; missingColumns: string[] } {
  const raw = parseCsv(text);
  const headers = Object.keys(raw[0] ?? {});
  const col = (k: keyof typeof COLUMNS) => headers.find((h) => COLUMNS[k].includes(norm(h)));
  const missingColumns = (['name', 'firm'] as const).filter((k) => !col(k));
  if (missingColumns.length) return { rows: [], issues: [], missingColumns };
  const rows: SheetRow[] = [], issues: SheetIssue[] = [];
  const todayIso = today.toISOString().slice(0, 10);
  raw.forEach((r, i) => {
    const line = i + 2; // header is line 1
    const get = (k: keyof typeof COLUMNS) => { const c = col(k); return c ? (r[c] ?? '').trim() : ''; };
    const name = get('name'), firm = get('firm');
    if (!name || !firm) { issues.push({ line, reason: 'name and firm are both needed' }); return; }
    const row: SheetRow = { line, name: name.slice(0, 120), firm: firm.slice(0, 120) };
    if (get('thesis')) row.thesis = get('thesis').slice(0, 1000);
    if (get('notes')) row.notes = get('notes').slice(0, 4000);
    if (get('status')) {
      const st = toStatus(get('status'));
      if (st) row.status = st; else issues.push({ line, reason: `status "${get('status')}" not recognised (kept as is)` });
    }
    if (get('lastContact')) {
      const d = toDate(get('lastContact'));
      if (d && d <= todayIso) row.lastContact = d; else issues.push({ line, reason: `last contact "${get('lastContact')}" is not a past date (kept as is)` });
    }
    rows.push(row);
  });
  return { rows, issues, missingColumns };
}
