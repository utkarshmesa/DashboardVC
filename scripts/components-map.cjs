/* eslint-disable */
// Regenerate the components map: node scripts/components-map.cjs docs/components-map.svg
// (PNG: render the SVG at 2000x1840, e.g. msedge --headless=new --screenshot=docs/components-map.png --window-size=2000,1840 <svg>)
// Generates docs/components-map.svg in the style of the reference "MVP Components Map".
const fs = require('fs');
const out = process.argv[2];

const W = 2000, LEFT = 22, LABEL_W = 245, COL_W = 285, X0 = LEFT + LABEL_W, HEAD_Y = 93, HEAD_H = 67, ROW_H = 130, ROW0 = HEAD_Y + HEAD_H;
const COLS = ['Trigger', 'Input', 'Context', 'Processing', 'AI', 'Output'];
const ROWS = [
  ['Vikram', '(Founder · user)', '#eef0fd'],
  ['Scheduler', '(Vercel Cron + GitHub)', '#f1f5f9'],
  ['Public sources', '(News · Tavily · RSS · LinkedIn)', '#fffbeb'],
  ['Research KB', '(Verified research + funds)', '#effcf3'],
  ['Settings', '(Persona + draft settings)', '#f5fbe9'],
  ['Runner', '(Vercel functions · code)', '#f4f6f9'],
  ['Gemini Flash', '(Labels + openers)', '#f7f0fe'],
  ['Supabase', '(Database + owner guard)', '#ecfbf4'],
  ['Follow-up engine', '(Code · Vikram\'s status)', '#eef7fd'],
  ['Dashboard', '(Next.js on Vercel)', '#fefce8'],
  ['Vikram', '(Human gate · sends)', '#fff7ed'],
  ['Digest & Quality', '(Webhook + funnel)', '#fdf2f8'],
];
const H = ROW0 + ROWS.length * ROW_H + 120;
const TAG = { RC1: ['#2563eb', 'No fit filter'], RC2: ['#ca8a04', 'No reason to write now'], RC3: ['#ea580c', 'No follow-through'], GUARD: ['#dc2626', 'AI never decides or writes facts'] };

const colX = (c) => X0 + c * COL_W;
const rowY = (r) => ROW0 + r * ROW_H;
const box = (c, r) => ({ x: colX(c) + 20, y: rowY(r) + 14, w: 245, h: 102 });
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// [col, row, lines, fill, stroke, tags]
const BOXES = {
  vikram: [0, 0, ['Opens the dashboard', 'Mon & Thu mornings', 'Run now: any time'], '#e9e7fd', '#6d5bd0', []],
  sched: [0, 1, ['Vercel Cron Mon/Thu 06:00 IST', 'GitHub finisher 07:00 & 08:00', 'completes any overflow'], '#e8edf3', '#475569', ['RC2']],
  sources: [1, 2, ['Google News · Tavily · firm RSS', 'LinkedIn posts by VC / firm', 'Headline + 300 chars + link', '(never full text, never X)'], '#fef3c7', '#b45309', ['RC2']],
  research: [2, 3, ['Verified research per VC:', 'thesis · cheque · stage · fund', 'deals · how to reach · caveats', 'LinkedIn handles (reviewed)'], '#dcfce7', '#16a34a', ['RC1']],
  settings: [2, 4, ['target_space · my_product', 'pitch · ask · deck link', '(Vikram\'s own words)'], '#ecfccb', '#4d7c0f', ['RC1']],
  runner: [3, 5, ['Batch of 10 · filter · dedupe', 'Score (20-day half-life) + fit', 'Action table · plan pass:', '7/week · 1 per firm · conflicts'], '#e2e8f0', '#334155', ['RC1']],
  gemini: [4, 6, ['Labels each item: about VC,', 'type · relevance · competitor', 'Writes hook + research opener', 'Code checks names & numbers'], '#f3e8ff', '#9333ea', ['GUARD']],
  supabase: [3, 7, ['vcs: 4 system columns only', '(apply_signals · owner guard)', 'signals · runs · outreach log', 'RLS deny-all for outsiders'], '#d1fae5', '#059669', ['GUARD']],
  follow: [3, 8, ['Nudge on day 8', 'Close the loop on day 21', 'Next step on day 10 · snooze', 'Idempotent one-click logging'], '#e0f2fe', '#0284c7', ['RC3']],
  dash: [5, 9, ['This-week plan · runway', 'Person-first cards · fit ring', 'Investor brief · route + draft', 'Evidence + thumbs'], '#fef9c3', '#ca8a04', ['RC1', 'RC2']],
  gate: [5, 10, ['Opens form / Gmail / LinkedIn', 'Edits and sends own email', 'Confirms “Sent it?”', 'Rates signals · edits notes'], '#ffedd5', '#ea580c', ['RC3']],
  digest: [5, 11, ['Digest → Slack / Discord', 'after each finished run', 'Quality: emailed → replied', '→ meeting funnel'], '#fce7f3', '#db2777', ['RC3']],
};
const B = Object.fromEntries(Object.entries(BOXES).map(([k, v]) => [k, box(v[0], v[1])]));
const L = (k) => [B[k].x, B[k].y + B[k].h / 2], R = (k) => [B[k].x + B[k].w, B[k].y + B[k].h / 2];
const T = (k, dx = 0) => [B[k].x + B[k].w / 2 + dx, B[k].y], Bt = (k, dx = 0) => [B[k].x + B[k].w / 2 + dx, B[k].y + B[k].h];

// Arrows: [points..., label, labelX, labelY, anchor]
const A = [
  { p: [[409, B.vikram.y + B.vikram.h / 2], [B.vikram.x + B.vikram.w, B.vikram.y + B.vikram.h / 2]], hidden: true },
  { p: [R('vikram'), [1236, R('vikram')[1]], T('runner', -28)], label: 'Run now → manual run', at: [548, R('vikram')[1] - 10] },
  { p: [Bt('sched'), [Bt('sched')[0], L('sources')[1]], L('sources')], label: 'Collect · 10 per step', at: [418, L('sources')[1] - 10] },
  { p: [Bt('sources'), [Bt('sources')[0], 890], [B.runner.x, 890]], label: 'Raw items', at: [Bt('sources')[0] + 10, 872] },
  { p: [[B.research.x + B.research.w, B.research.y + 38], [T('runner', -68)[0], B.research.y + 38], T('runner', -68)], label: 'Fit · routes', at: [1112, B.research.y + 28] },
  { p: [[B.research.x + B.research.w, B.research.y + 72], [T('gemini', 77)[0], B.research.y + 72], T('gemini', 77)], label: 'Research text → openers', at: [1300, B.research.y + 62] },
  { p: [R('settings'), [T('gemini', 0)[0], R('settings')[1]], T('gemini', 0)], label: 'Target space · my product', at: [1252, R('settings')[1] - 10] },
  { p: [[B.runner.x + B.runner.w, B.runner.y + 36], [T('gemini', -80)[0], B.runner.y + 36], T('gemini', -80)], label: 'Pending items (batched)', at: [1395, B.runner.y + 26] },
  { p: [[B.gemini.x, B.gemini.y + 70], [1330, B.gemini.y + 70], Bt('runner', 65)], label: 'Labels → code guards', at: [1418, B.gemini.y + 96], anchor: 'end' },
  { p: [Bt('runner', -42), T('supabase', -42)], label: 'apply_signals (4 columns)', at: [1214, 1048], anchor: 'end' },
  { p: [R('supabase'), [1690, R('supabase')[1]], [1690, B.dash.y + 34], [B.dash.x, B.dash.y + 34]], label: 'Plan · evidence · brief', at: [1395, R('supabase')[1] - 10] },
  { p: [Bt('supabase'), T('follow')], label: 'Status · last contact', at: [B.supabase.x + B.supabase.w / 2 - 10, B.supabase.y + B.supabase.h + 19], anchor: 'end' },
  { p: [R('follow'), [1666, R('follow')[1]], [1666, B.dash.y + 70], [B.dash.x, B.dash.y + 70]], label: 'Nudge · close-the-loop cards', at: [1395, R('follow')[1] - 10] },
  { p: [Bt('dash'), T('gate')], label: 'Route + draft', at: [B.dash.x + B.dash.w / 2 - 10, B.dash.y + B.dash.h + 19], anchor: 'end' },
  { p: [L('gate'), [1078, L('gate')[1]], [1078, B.supabase.y + 74], [B.supabase.x, B.supabase.y + 74]], label: 'Sent it? · thumbs · notes → logged', at: [1360, L('gate')[1] - 10] },
  { p: [[B.supabase.x, B.supabase.y + 30], [1104, B.supabase.y + 30], [1104, L('digest')[1]], L('digest')], label: 'After each run · outcomes', at: [1120, L('digest')[1] - 10] },
];

const parts = [];
parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Helvetica, Arial, sans-serif">`);
parts.push(`<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="#64748b"/></marker></defs>`);
parts.push(`<rect width="${W}" height="${H}" fill="#ffffff"/>`);
parts.push(`<text x="${W / 2}" y="56" text-anchor="middle" font-size="32" font-weight="700" fill="#0f1e3d">VC Fundraising Pipeline Intelligence — MVP Components Map</text>`);
// header
parts.push(`<rect x="${LEFT}" y="${HEAD_Y}" width="${LABEL_W}" height="${HEAD_H}" fill="#0f1e3d"/>`);
parts.push(`<text x="${LEFT + LABEL_W / 2}" y="${HEAD_Y + 42}" text-anchor="middle" font-size="22" fill="#fff">Actor / Tool</text>`);
COLS.forEach((c, i) => {
  parts.push(`<rect x="${colX(i)}" y="${HEAD_Y}" width="${COL_W}" height="${HEAD_H}" fill="#1e2a44" stroke="#2c3a58"/>`);
  parts.push(`<text x="${colX(i) + COL_W / 2}" y="${HEAD_Y + 42}" text-anchor="middle" font-size="22" fill="#fff">${c}</text>`);
});
// rows
ROWS.forEach(([name, sub, tint], r) => {
  const y = rowY(r);
  parts.push(`<rect x="${X0}" y="${y}" width="${COL_W * 6}" height="${ROW_H}" fill="${tint}"/>`);
  parts.push(`<rect x="${LEFT}" y="${y}" width="${LABEL_W}" height="${ROW_H}" fill="#0f1e3d" stroke="#22314f"/>`);
  parts.push(`<text x="${LEFT + LABEL_W / 2}" y="${y + 60}" text-anchor="middle" font-size="22" font-weight="700" fill="#fff">${esc(name)}</text>`);
  parts.push(`<text x="${LEFT + LABEL_W / 2}" y="${y + 88}" text-anchor="middle" font-size="16" fill="#cbd5e1">${esc(sub)}</text>`);
});
for (let i = 1; i < 6; i++) parts.push(`<line x1="${colX(i)}" y1="${ROW0}" x2="${colX(i)}" y2="${rowY(ROWS.length)}" stroke="#ffffff" stroke-width="2"/>`);
// human-gate band (row 10)
parts.push(`<rect x="${X0 + 2}" y="${rowY(10) + 2}" width="${COL_W * 6 - 4}" height="${ROW_H - 4}" fill="none" stroke="#f59e0b" stroke-width="3" stroke-dasharray="12 8"/>`);
parts.push(`<text x="${X0 + 22}" y="${rowY(10) + 30}" font-size="15" font-style="italic" fill="#b45309">Human gate: the AI never sends anything; Vikram reviews, edits and sends every message himself</text>`);
// arrows (under boxes)
for (const a of A) {
  if (a.hidden) continue;
  const d = a.p.map((pt, i) => `${i ? 'L' : 'M'}${pt[0]},${pt[1]}`).join(' ');
  parts.push(`<path d="${d}" fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="7 5" marker-end="url(#arr)"/>`);
  parts.push(`<circle cx="${a.p[0][0]}" cy="${a.p[0][1]}" r="3.5" fill="#22c55e"/>`);
  if (a.label) parts.push(`<text x="${a.at[0]}" y="${a.at[1]}" font-size="15" font-style="italic" fill="#475569" stroke="#ffffff" stroke-width="5" stroke-opacity="0.9" paint-order="stroke" stroke-linejoin="round"${a.anchor ? ` text-anchor="${a.anchor}"` : ''}>${esc(a.label)}</text>`);
}
// boxes
for (const [k, [, , lines, fill, stroke, tags]] of Object.entries(BOXES)) {
  const b = B[k];
  parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>`);
  const lh = 20, top = b.y + b.h / 2 - ((lines.length - 1) * lh) / 2 + 5;
  lines.forEach((ln, i) => parts.push(`<text x="${b.x + b.w / 2}" y="${top + i * lh}" text-anchor="middle" font-size="15.5" fill="#1e293b">${esc(ln)}</text>`));
  tags.forEach((t, i) => {
    const tw = t === 'GUARD' ? 66 : 50, tx = b.x + b.w - 12 - tw - i * (tw + 6);
    parts.push(`<rect x="${tx}" y="${b.y - 11}" width="${tw}" height="22" rx="11" fill="${TAG[t][0]}"/>`);
    parts.push(`<text x="${tx + tw / 2}" y="${b.y + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${t}</text>`);
  });
}
// legend
const ly = rowY(ROWS.length) + 62;
parts.push(`<text x="298" y="${ly + 6}" font-size="18" font-weight="700" fill="#0f1e3d">Tags:</text>`);
let lx = 368;
for (const [t, [col, label]] of Object.entries(TAG)) {
  const tw = t === 'GUARD' ? 66 : 50;
  parts.push(`<rect x="${lx}" y="${ly - 11}" width="${tw}" height="22" rx="11" fill="${col}"/>`);
  parts.push(`<text x="${lx + tw / 2}" y="${ly + 5}" text-anchor="middle" font-size="13" font-weight="700" fill="#fff">${t}</text>`);
  parts.push(`<text x="${lx + tw + 12}" y="${ly + 6}" font-size="18" fill="#1e293b">${esc(label)}</text>`);
  lx += tw + 12 + label.length * 9.4 + 60;
}
parts.push(`<text x="${W / 2}" y="${ly + 42}" text-anchor="middle" font-size="14" fill="#64748b">Design rule: the LLM reads and labels evidence; plain code decides dates, scores, actions and writes; the database enforces who owns which column.</text>`);
parts.push('</svg>');
fs.writeFileSync(out, parts.join('\n'));
console.log('wrote', out, W, 'x', H);
