// SPEC §12.3 ranking review.
//   npm run ranking:export     → eval/ranking_review.csv (50 VCs with their evidence, no scores)
//   (a human fills the would_contact column with yes/no)
//   npm run ranking:calibrate  → grid over half-life 10/15/20/30 and REACH in steps of 5; writes eval/calibration.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SIGNAL_WINDOW_DAYS } from '../lib/config';
import { db } from '../lib/db';
import { calibrate, type ReviewRow } from '../lib/eval';
import { scoreSignals, signalAge, type ScorableSignal } from '../lib/scoring';
import { fmtDay } from '../lib/text';
import { parseCsv } from './csv';

const CSV = new URL('../eval/ranking_review.csv', import.meta.url);
const csvCell = (s: string) => `"${s.replace(/"/g, '""')}"`;

type Sig = ScorableSignal & { vc_id: string; title: string; url: string; source: string };

async function load() {
  const vcs = await db().from('vcs').select('id, name, firm, status').order('name');
  if (vcs.error) throw new Error(vcs.error.message);
  const sig = await db().from('signals').select('id, vc_id, title, url, source, status, signal_type, subject, relevance, published_at, date_approx, possible_competitor, event_key, summary').eq('status', 'accepted');
  if (sig.error) throw new Error(sig.error.message);
  const fb = await db().from('signal_feedback').select('signal_id').eq('verdict', 'down');
  const down = new Set((fb.data ?? []).map((f) => f.signal_id));
  const signals = (sig.data as Sig[]).map((s) => ({ ...s, relevance: s.relevance === null ? null : Number(s.relevance), thumbs_down: down.has(s.id) }));
  return { vcs: vcs.data as { id: string; name: string; firm: string; status: string }[], signals };
}

async function exportCsv() {
  const { vcs, signals } = await load();
  const now = new Date();
  const lines = ['vc_id,name,firm,status,evidence,would_contact'];
  for (const v of vcs) {
    const ev = signals
      .filter((s) => s.vc_id === v.id && signalAge(s, now, SIGNAL_WINDOW_DAYS) !== null)
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
      .slice(0, 6)
      .map((s) => `[${s.signal_type}${s.possible_competitor ? ', possible competitor' : ''}] ${s.published_at ? fmtDay(s.published_at) : 'date approx'} — ${s.title} (${s.url})`);
    lines.push([v.id, v.name, v.firm, v.status, ev.length ? ev.join(' | ') : 'No public activity found in 30 days.', ''].map(csvCell).join(','));
  }
  if (existsSync(CSV) && parseCsv(readFileSync(CSV, 'utf8')).some((r) => r.would_contact?.trim()) && !process.argv.includes('--overwrite')) {
    console.error('eval/ranking_review.csv already has answers; pass --overwrite to replace it.');
    process.exit(1);
  }
  writeFileSync(CSV, lines.join('\n') + '\n');
  console.log(`wrote eval/ranking_review.csv (${vcs.length} VCs). Fill would_contact with yes/no, then run npm run ranking:calibrate.`);
}

async function runCalibration() {
  const rows = parseCsv(readFileSync(CSV, 'utf8'));
  const answered = rows.filter((r) => /^(y|yes|1|true|n|no|0|false)$/i.test(r.would_contact?.trim() ?? ''));
  if (answered.length < rows.length) { console.error(`${rows.length - answered.length} rows lack a yes/no in would_contact.`); process.exit(1); }
  const { signals } = await load();
  const now = new Date();
  const review: ReviewRow[] = answered.map((r) => {
    const mine = signals.filter((s) => s.vc_id === r.vc_id);
    const scores: Record<number, number> = {};
    for (const hl of [10, 15, 20, 30]) scores[hl] = scoreSignals(mine, now, { halfLifeDays: hl }).score;
    return { vc_id: r.vc_id, would_contact: /^(y|yes|1|true)$/i.test(r.would_contact.trim()), scores };
  });
  const result = calibrate(review);
  const out = { generated_at: now.toISOString(), reviewed: review.length, would_contact: review.filter((r) => r.would_contact).length, ...result };
  writeFileSync(new URL('../eval/calibration.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log(`HALF_LIFE_DAYS=${result.halfLife} REACH=${result.reach} WARM=${result.warm} agreement=${(result.agreement * 100).toFixed(1)}%`);
  console.log('Update lib/config.ts and the README with these values.');
}

const cmd = process.argv[2];
(cmd === 'calibrate' ? runCalibration() : exportCsv()).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
