import { describe, expect, it } from 'vitest';
import { parseCsv, toCsv } from '@/lib/csv';
import { readSheet, toDate, toStatus } from '@/lib/spreadsheet';

const TODAY = new Date('2026-10-13T06:00:00Z');

describe('spreadsheet import', () => {
  it('reads the problem statement words for status', () => {
    expect(toStatus('Waiting for a response')).toBe('awaiting_response');
    expect(toStatus('Yet to reach out')).toBe('not_contacted');
    expect(toStatus('Had a call')).toBe('in_conversation');
    expect(toStatus('Passed')).toBe('passed');
    expect(toStatus('maybe later?')).toBeNull();
  });
  it('reads common date formats, day first', () => {
    expect(toDate('2026-09-12')).toBe('2026-09-12');
    expect(toDate('12/09/2026')).toBe('2026-09-12');
    expect(toDate('12-9-26')).toBe('2026-09-12');
    expect(toDate('12 Sep 2026')).toBe('2026-09-12');
    expect(toDate('Sep 12, 2026')).toBe('2026-09-12');
    expect(toDate('31/02/2026')).toBeNull();
  });
  it('maps forgiving column names, keeps blanks as "no change" and reports issues', () => {
    const csv = '﻿Investor,Fund,Focus,Status,Last contacted,Comments\r\n'
      + 'Alok Goyal,Stellaris Venture Partners,Enterprise SaaS,Waiting for a response,28/09/2026,"Emailed deck, ""warm"" intro"\r\n'
      + 'New Person,New Fund,,Yet to reach out,,\r\n'
      + ',Orphan Fund,,,,\r\n'
      + 'Odd Row,Odd Fund,,someday,2027-01-01,\r\n';
    const r = readSheet(csv, TODAY);
    expect(r.missingColumns).toEqual([]);
    expect(r.rows[0]).toEqual({ line: 2, name: 'Alok Goyal', firm: 'Stellaris Venture Partners', thesis: 'Enterprise SaaS', status: 'awaiting_response', lastContact: '2026-09-28', notes: 'Emailed deck, "warm" intro' });
    expect(r.rows[1]).toEqual({ line: 3, name: 'New Person', firm: 'New Fund', status: 'not_contacted' });
    expect(r.rows.find((x) => x.name === 'Odd Row')).toEqual({ line: 5, name: 'Odd Row', firm: 'Odd Fund' });
    expect(r.issues.map((i) => i.line)).toEqual([4, 5, 5]);
  });
  it('needs name and firm columns', () => {
    expect(readSheet('Who,Notes\r\nA,b\r\n', TODAY).missingColumns).toEqual(['name', 'firm']);
  });
  it('round-trips through the CSV writer', () => {
    const text = toCsv(['name', 'notes'], [['A', 'has, comma'], ['B', 'has "quotes"\nand newline']]);
    expect(parseCsv(text)).toEqual([{ name: 'A', notes: 'has, comma' }, { name: 'B', notes: 'has "quotes"\nand newline' }]);
  });
});
