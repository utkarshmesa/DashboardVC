# Build status: VC Fundraising Pipeline Intelligence

*As of 2026-10-12. The live app is at https://vc-pipeline-zeta.vercel.app.*

**Summary.** Phases 0–4 are built, deployed and verified. **Phase 5 (fit-first weekly plan)** is built and live: fit score, standing conflicts, follow-up engine with one-click logging, and how-to-reach/deal-breakers on every card.

- 11 of the 13 acceptance items (SPEC §15) are verified on production.
- The other 2 wait on the calendar:
  - a scheduled cron that processes all 50 VCs on its own;
  - a third day of full runs.

  Both are due Thursday 2026-10-15. A scheduled task verifies them at 09:30 IST that day and updates this file and `docs/ACCEPTANCE.md`.
- One human step remains: rehearsing the demo.
- One owner action is recommended: rotating the API keys.

## Phases

| Phase | Exit check | Status |
|---|---|---|
| 0 · Spike and evidence | Metrics report delivered; gate decided | ✅ `spike/REPORT.md`; gate decisions in `docs/DECISIONS.md` |
| 1 · Walking skeleton | Cron fires on the live URL; table updates with real data; ownership test passes in production | ✅ |
| 2 · Correctness | CI green; eval gate met on the test split; ranking agreement recorded; values in README | ✅ Precision 0.95 / about-precision 1.00; recall 6/6; agreement 98% |
| 3 · Usefulness | A newcomer answers "who to email this week, with what opener" in under a minute | ✅ Built and walked through; ⏳ an independent human timing is recommended |
| 4 · Reliability and submission | SPEC §15 all ticked | ⏳ 11/13; the last 2 are due Thu 15 Oct (see below) |
| 5 · Fit-first weekly plan (owner-approved, from `docs/REVIEW.md`) | Best-fit VCs reach This week; competitor firms flagged; follow-ups tracked | ✅ All 12 tier-1 VCs in outreach, queue, conflict check or same-firm route (was 1/12 in This week); 3 TMS-competitor partners flagged; 73 tests |

## Live system

| Part | State |
|---|---|
| Vercel project `vc-pipeline` | Next.js 16, region bom1, GitHub-connected (every push deploys) |
| Vercel Cron | `/api/cron`, Mon/Thu 06:00 IST. Fired on its own on Mon 12 Oct (06:26 IST); processed 0 because every VC had been processed within 24 h |
| GitHub finisher | Mon/Thu 07:00 and 08:00 IST plus manual dispatch; tested by dispatch ✅ |
| CI | Lint, typecheck, 63 unit tests plus recall 6/6 (replayed) on every push; no secrets needed. Recent runs green |
| Supabase `vc-pipeline` (ap-south-1) | Migrations 001–005; 50 VCs, 57 firms, 50 profiles; RLS deny-all for anon/authenticated |
| Data | 81 accepted signals, 73 openers (all pass the guard). Actions: 5 Reach out — strong fit, 4 Warm, 3 Check conflict, 12 Good fit queued, 8 Same firm, 13 Low, 5 Quiet |
| Tavily | 198 credits this month by app runs (about 254 including Phase 0 scripts) of the 800 budget |

## Quality numbers

- **Golden recall:** 6/6. SuperProcure is flagged as a competitor with verbatim evidence.
- **Eval (test split, 30 items):** acceptance precision 0.95, recall 0.95; about-this-VC precision 1.00. Type accuracy 0.70; relevance-level accuracy 0.77.
- **Calibration:** REACH 30, WARM 15, half-life 20; 98% agreement.
- **Caveats** (also in the README):
  - The labels and ranking answers came from the builder (Claude Code) at the owner's request, not from a human.
  - Calibration rests on 2 positive examples.
  - No VC on this list has recent core logistics or supply-chain activity, so the evidence floor holds everyone at Warm or below.

## Verified today (stress test and acceptance)

- **Security:** no Anthropic references; the service key is absent from client bundles; 11 auth-abuse cases rejected; 9 malformed inputs rejected without writes.
- **Concurrency:** 6 simultaneous steps produced 2 sequential runs, nothing stuck. 6 simultaneous claims took 50 distinct VCs.
- **Load:** 25 parallel dashboard loads succeeded, about 1.6 s each.
- **Real Gemini outage:** the run ended `partial`, the affected VCs were left unwritten, nothing looped, and 0 owner-column changes across 50 rows.
- **Thumbs-down live:** 24 Warm → 0 Quiet in 2.9 s, then restored.
- **Links:** 11 of the 12 newest accepted links load (one site blocks bots).
- **Bugs found and fixed:**
  - claims held for 10 minutes blocked back-to-back runs;
  - Gemini's 400 `API_KEY_INVALID` didn't trigger key rotation;
  - a stale "Saved" label in inline edit;
  - the header showed the finisher's empty no-op run as the "last run".

## Open items

| Item | Owner | When |
|---|---|---|
| Scheduled cron processes all 50 VCs on its own (§15.1) | Automatic; verified by the scheduled task `vc-pipeline-thursday-acceptance` | Thu 2026-10-15, cron 06:00 IST, finisher 07:00/08:00, check 09:30 (needs the Claude app open, or it runs at next launch) |
| Third day of full runs (§13 Phase 4) | Same run and task | Thu 2026-10-15 |
| Redo the ranking review under the fit-first model (current one: 2 positives, old model) | You | Before relying on REACH/WARM |
| Demo rehearsal (§15.12) | You | Any time. `docs/DEMO.md`; a dry run of every step was done on 2026-10-12 |
| Instructor question: Claude Code as the build tool when the brief says "do not use Claude API" | You | Before submission. The runtime uses Gemini only, and the README has the tooling disclosure |

## Product review

`docs/REVIEW.md` (2026-10-12) found the dashboard ranked by recent news, not fit; items 1–4 were built as Phase 5 (above). Items 5–9 (sendable drafts, Monday digest, logistics deal discovery, outcome learning, research refresh) remain proposed.

## Where to look

`README.md` (setup, AI boundary, eval, Components Map, limitations, tooling) · `docs/SPEC.md` (amended where the owner decided) · `docs/DECISIONS.md` (#1–30) · `docs/ACCEPTANCE.md` · `docs/DEMO.md` · `spike/REPORT.md` · `eval/` (labels, predictions, eval report, calibration, score diagnosis).
