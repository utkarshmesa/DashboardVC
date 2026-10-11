// npm run diagnose — explains current scores: per VC, the top signal's type, subject, relevance, age and date_approx,
// plus counts of accepted signals by type, subject and date_approx. Writes eval/score_diagnosis.md.
import { writeFileSync } from 'node:fs';
import { HALF_LIFE_DAYS, SIGNAL_WINDOW_DAYS, SUBJECT_WEIGHT, TYPE_WEIGHT } from '../lib/config';
import { db } from '../lib/db';
import { scoreSignals, signalAge, type ScorableSignal } from '../lib/scoring';

type Sig = ScorableSignal & { vc_id: string; title: string; source: string; relevance_level: string | null };

async function main() {
  const now = new Date();
  const vcs = (await db().from('vcs').select('id, name, firm, follow_up_score, recommended_action').order('follow_up_score', { ascending: false, nullsFirst: false })).data ?? [];
  const sres = await db().from('signals').select('id, vc_id, title, source, status, signal_type, subject, relevance, relevance_level, published_at, date_approx, possible_competitor, event_key, summary').eq('status', 'accepted');
  if (sres.error) throw new Error(sres.error.message);
  const down = new Set(((await db().from('signal_feedback').select('signal_id').eq('verdict', 'down')).data ?? []).map((f) => f.signal_id));
  const signals: Sig[] = (sres.data as Sig[]).map((s) => ({ ...s, relevance: s.relevance === null ? null : Number(s.relevance), thumbs_down: down.has(s.id) }));
  const inWindow = signals.filter((s) => signalAge(s, now, SIGNAL_WINDOW_DAYS) !== null);

  const rows: string[] = [];
  for (const v of vcs) {
    const r = scoreSignals(signals.filter((s) => s.vc_id === v.id), now);
    if (!r.top) { rows.push(`| ${v.name} | ${v.firm} | 0 | — | — | — | — | — | — | — | ${v.recommended_action} |`); continue; }
    const s = r.top.signal as Sig;
    rows.push(`| ${v.name} | ${v.firm} | ${r.score} | ${s.signal_type} | ${s.subject} | ${s.relevance_level ?? '—'} | ${s.relevance?.toFixed(2)} | ${r.top.daysOld.toFixed(1)} | ${s.date_approx ? 'yes' : 'no'} | ${r.groups.length} | ${v.recommended_action} |`);
  }

  const count = <K extends string>(xs: Sig[], key: (s: Sig) => K) => xs.reduce<Record<string, number>>((m, s) => { const k = key(s); m[k] = (m[k] ?? 0) + 1; return m; }, {});
  const fmtCounts = (m: Record<string, number>) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(' · ');
  const rel = inWindow.map((s) => s.relevance ?? 0).sort((a, b) => a - b);
  const q = (p: number) => rel.length ? rel[Math.min(rel.length - 1, Math.floor(p * rel.length))].toFixed(2) : 'n/a';
  const relBuckets = count(inWindow, (s) => { const r = s.relevance ?? 0; return r < 0.4 ? '<0.4' : r < 0.6 ? '0.4–0.6' : '≥0.6'; });
  const strong = inWindow.filter((s) => ['investment', 'authored', 'speaking'].includes(s.signal_type ?? '') && (s.relevance ?? 0) >= 0.6);

  const md = `# Score diagnosis

Generated ${now.toISOString()} from the live database (accepted signals only; same scoring code as the pipeline).
Formula (SPEC §9.5): value = TYPE × SUBJECT × relevance × 0.5^(age / ${HALF_LIFE_DAYS}); score = round(100 × (top + 0.25 × other groups)), capped at 100.
TYPE = ${JSON.stringify(TYPE_WEIGHT)}; SUBJECT = ${JSON.stringify(SUBJECT_WEIGHT)}; undated date_approx items are aged ${SIGNAL_WINDOW_DAYS} days.

## Accepted, in-window signals (${inWindow.length} of ${signals.length} accepted)

- By type: ${fmtCounts(count(inWindow, (s) => s.signal_type ?? 'null'))}
- By subject: ${fmtCounts(count(inWindow, (s) => s.subject ?? 'null'))}
- By date_approx: ${fmtCounts(count(inWindow, (s) => (s.date_approx ? 'date_approx' : 'dated')))}
- By source: ${fmtCounts(count(inWindow, (s) => s.source))}
- By relevance_level: ${fmtCounts(count(inWindow, (s) => s.relevance_level ?? 'null'))}
- Relevance buckets: ${fmtCounts(relBuckets)} (median ${q(0.5)}, 90th percentile ${q(0.9)}, max ${rel.length ? rel[rel.length - 1].toFixed(2) : 'n/a'})
- Signals meeting the evidence floor (investment/authored/speaking, relevance ≥ 0.6): ${strong.length}

## Per VC (top signal)

| VC | Firm | Score | Top type | Subject | Level | Relevance | Age (days) | date_approx | Event groups | Current action |
|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}
`;
  writeFileSync(new URL('../eval/score_diagnosis.md', import.meta.url), md);
  console.log(md);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
