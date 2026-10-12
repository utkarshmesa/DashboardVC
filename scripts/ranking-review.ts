// SPEC §12.3 ranking review (v2, Phase 5: fit-first model).
//   npm run ranking:export     → eval/ranking_review.csv: 50 VCs with their fit evidence (thesis, research, stage, cheque,
//                                portfolio notes) and recent public evidence. No scores, no actions.
//   (a reviewer fills would_contact with yes/no: "would a freight/TMS seed founder email this VC this week?")
//   npm run ranking:calibrate  → simulates the full decision (actions + plan pass) over a grid of half-life, REACH, WARM,
//                                FIT_STRONG and FIT_GOOD; writes eval/calibration.json
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { meetsEvidenceFloor } from '../lib/actions';
import { SIGNAL_WINDOW_DAYS } from '../lib/config';
import { db } from '../lib/db';
import { calibratePlan, type PlanReviewRow } from '../lib/eval';
import { competitorTerms, fitScore, researchConflict, type Research } from '../lib/fit';
import { scoreSignals, signalAge, type ScorableSignal } from '../lib/scoring';
import { loadPersona } from '../lib/store';
import { fmtDay } from '../lib/text';
import { parseCsv } from './csv';

const CSV = new URL('../eval/ranking_review.csv', import.meta.url);
const csvCell = (s: string) => `"${String(s ?? '').replace(/"/g, '""')}"`;

type Sig = ScorableSignal & { vc_id: string; title: string; url: string; source: string };
type Vc = { id: string; name: string; firm: string; status: string; thesis: string | null };
type Prof = { vc_id: string; tier: number | null; trust: string | null; research: Research | null };

async function load() {
  const [vcs, prof, sig, fb] = await Promise.all([
    db().from('vcs').select('id, name, firm, status, thesis').order('name'),
    db().from('vc_profile').select('vc_id, tier, trust, research'),
    db().from('signals').select('id, vc_id, title, url, source, status, signal_type, subject, relevance, published_at, date_approx, possible_competitor, event_key, summary').eq('status', 'accepted'),
    db().from('signal_feedback').select('signal_id').eq('verdict', 'down'),
  ]);
  for (const r of [vcs, prof, sig, fb]) if (r.error) throw new Error(r.error.message);
  const down = new Set((fb.data ?? []).map((f) => f.signal_id));
  const signals = (sig.data as Sig[]).map((s) => ({ ...s, relevance: s.relevance === null ? null : Number(s.relevance), thumbs_down: down.has(s.id) }));
  return { vcs: vcs.data as Vc[], prof: prof.data as Prof[], signals };
}

async function exportCsv() {
  const { vcs, prof, signals } = await load();
  const now = new Date();
  const lines = ['vc_id,name,firm,thesis,research_fit,latest_relevant_deal,stage,cheque,how_to_reach,recent_evidence,would_contact'];
  for (const v of vcs) {
    const r = prof.find((p) => p.vc_id === v.id)?.research ?? {};
    const ev = signals
      .filter((s) => s.vc_id === v.id && signalAge(s, now, SIGNAL_WINDOW_DAYS) !== null)
      .sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
      .slice(0, 5)
      .map((s) => `[${s.signal_type}${s.possible_competitor ? ', possible competitor' : ''}] ${s.published_at ? fmtDay(s.published_at) : 'date approx'} — ${s.title}`);
    lines.push([v.id, v.name, v.firm, v.thesis ?? '', r.fit_reason ?? '', r.latest_relevant_deal ?? '', r.stage_focus ?? '', r.first_cheque ?? '', r.approach ?? '',
      ev.length ? ev.join(' | ') : 'No public activity found in 30 days.', ''].map(csvCell).join(','));
  }
  if (existsSync(CSV) && parseCsv(readFileSync(CSV, 'utf8')).some((x) => x.would_contact?.trim()) && !process.argv.includes('--overwrite')) {
    console.error('eval/ranking_review.csv already has answers; pass --overwrite to replace it.');
    process.exit(1);
  }
  writeFileSync(CSV, lines.join('\n') + '\n');
  console.log(`wrote eval/ranking_review.csv (${vcs.length} VCs). Fill would_contact with yes/no, then run npm run ranking:calibrate.`);
}

async function runCalibration() {
  const answers = parseCsv(readFileSync(CSV, 'utf8'));
  const answered = answers.filter((r) => /^(y|yes|1|true|n|no|0|false)$/i.test(r.would_contact?.trim() ?? ''));
  if (answered.length < answers.length) { console.error(`${answers.length - answered.length} rows lack a yes/no in would_contact.`); process.exit(1); }
  const { vcs, prof, signals } = await load();
  const persona = await loadPersona();
  const terms = competitorTerms(persona.myProduct);
  const now = new Date();
  const rows: PlanReviewRow[] = answered.map((a) => {
    const v = vcs.find((x) => x.id === a.vc_id)!;
    const p = prof.find((x) => x.vc_id === a.vc_id);
    const peers = vcs.filter((x) => x.firm === v.firm).map((x) => prof.find((y) => y.vc_id === x.id)?.research ?? null);
    const mine = signals.filter((s) => s.vc_id === a.vc_id);
    const byHalfLife: PlanReviewRow['byHalfLife'] = {};
    for (const hl of [10, 15, 20, 30]) {
      const r = scoreSignals(mine, now, { halfLifeDays: hl });
      byHalfLife[hl] = { score: r.score, topRelevance: r.top?.signal.relevance ?? null, hasEvidence: meetsEvidenceFloor(r.counted.map((c) => c.signal)) };
    }
    const competitorSignal = mine.some((s) => s.possible_competitor === true && !s.thumbs_down);
    const fit = fitScore({ tier: p?.tier ?? null, trust: p?.trust ?? null, thesis: v.thesis, research: p?.research ?? null }, persona.targetSpace, now);
    return {
      id: v.id, name: v.name, firm: v.firm, trust: p?.trust ?? null, tier: p?.tier ?? null,
      fitScore: fit.score, fitFlags: fit.flags,
      conflict: competitorSignal || !!researchConflict(peers, terms),
      would_contact: /^(y|yes|1|true)$/i.test(a.would_contact.trim()), byHalfLife,
    };
  });
  const result = calibratePlan(rows, now);
  const out = { generated_at: now.toISOString(), model: 'fit-first (Phase 5)', reviewed: rows.length, would_contact: rows.filter((r) => r.would_contact).length,
    ...result.g, agreement: result.agreement, contact_precision: result.tp / Math.max(1, result.tp + result.fp), contact_recall: result.tp / Math.max(1, result.tp + result.fn),
    previous_constants: result.current };
  writeFileSync(new URL('../eval/calibration.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
  console.log(`HALF_LIFE_DAYS=${result.g.halfLife} REACH=${result.g.reach} WARM=${result.g.warm} FIT_STRONG=${result.g.fitStrong} FIT_GOOD=${result.g.fitGood}`);
  console.log(`agreement ${(result.agreement * 100).toFixed(1)}% · contact precision ${out.contact_precision.toFixed(2)} · recall ${out.contact_recall.toFixed(2)} (tp ${result.tp}, fp ${result.fp}, fn ${result.fn})`);
}

const cmd = process.argv[2];
(cmd === 'calibrate' ? runCalibration() : exportCsv()).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
