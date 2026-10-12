# Build status: VC Fundraising Pipeline Intelligence

*As of 2026-10-12 (evening). The live app is at https://vc-pipeline-zeta.vercel.app.*

**Summary.** Everything specified is built, deployed and stress-tested. Beyond the spec, the owner approved and received:
- a fit-first weekly plan (Phase 5);
- sendable email drafts, a digest and an outcome log (5b);
- LinkedIn posts as an activity and relevance signal (5c; X stays off).

What remains:
- **11 of 13 acceptance items (SPEC §15) are verified on production.** The other 2 depend on the calendar: a scheduled cron that processes all 50 VCs by itself, and a third day of full runs. Both fall on **Thursday 2026-10-15**. A scheduled task checks them at 09:30 IST and updates this file and `docs/ACCEPTANCE.md`.
- **Human steps:** rehearse the demo, and strengthen the pitch line in Settings with the company name and traction.
- **Not doing:** key rotation, which the owner chose to skip for this project.

## Phases

| Phase | Exit check | Status |
|---|---|---|
| 0 · Spike and evidence | Metrics report delivered; gate decided | ✅ `spike/REPORT.md`; gate decisions in `docs/DECISIONS.md` |
| 1 · Walking skeleton | Cron fires on the live URL; table updates with real data; ownership test passes in production | ✅ |
| 2 · Correctness | CI green; eval gate met on the test split; ranking agreement recorded; values in README | ✅ Precision 0.95, about-this-VC precision 1.00; recall 6/6 |
| 3 · Usefulness | A newcomer answers "who to email this week, with what opener" in under a minute | ✅ Built and walked through; ⏳ an independent human timing is recommended |
| 4 · Reliability and submission | SPEC §15 all ticked | ⏳ 11/13; the last 2 are due Thu 15 Oct |
| 5 · Fit-first weekly plan (owner-approved, `docs/REVIEW.md`) | Best-fit VCs reach This week; competitor firms flagged; follow-ups tracked | ✅ All 12 tier-1 VCs are in outreach, the queue, a conflict check or a same-firm route (was 1 of 12). 3 TMS-competitor partners flagged. 92% agreement with the ranking review |
| 5b · Drafts, digest, outcome log (review items 5, 6, 8) | Sendable drafts; outreach funnel; digest | ✅ Research-grounded openers (21 live, guarded); "Copy email draft" on outreach and follow-up cards; `/api/digest` with an optional webhook; funnel on `/quality` |
| 5c · LinkedIn posts (owner request; X off) | Activity and relevance from posts, without scraping | ✅ 77 reviewed handles (46 VCs, 31 firm pages). 92 posts across 32 of 50 VCs, all dated. "Active on LinkedIn" chip on cards; hook guard |
| 5d · Reaching out and runway (REVIEW-2 items 3, 2) | Route-aware outreach; pipeline never runs dry silently | ✅ Form / LinkedIn / contact / Gmail actions with "Sent it?" logging and channel; deck link; runway line; `/investors` with 49 researched candidates and manual add (row O6); 113 tests |
| Deferred, with evidence | Deal discovery (item 7); automated research refresh (item 9) | ⏸ `docs/PLAN-NEXT.md`. Free sources didn't cover logistics deals; automated refresh risks overwriting curated research |

## Live system

| Part | State |
|---|---|
| Vercel project `vc-pipeline` | Next.js 16, region bom1, GitHub-connected (every push deploys) |
| Vercel Cron | `/api/cron`, Mon/Thu 06:00 IST. Fired on its own on Mon 12 Oct |
| GitHub finisher | Mon/Thu 07:00 and 08:00 IST plus manual dispatch. If a cron run overflows the 300 s limit, the finisher completes it and posts the digest (once per run) |
| LinkedIn search | Weekly per VC (Monday run; the Thursday run skips it). Last checked Mon 12 Oct, so next due Mon 19 Oct |
| CI | Lint, typecheck, 104 unit tests and the recall replay (6/6) on every push; no secrets needed. All recent runs green |
| Supabase `vc-pipeline` (ap-south-1) | Migrations 001–008; 50 VCs, 57 firms, 50 profiles. RLS denies anon/authenticated; the pipeline writes `vcs` only through `apply_signals` |
| Data | 155 accepted signals (72 from LinkedIn), 21 openers, 0 logged outreach events (nothing sent yet) |
| Weekly plan now | 5 Reach out (strong fit), 1 Reach out this week (Alok Goyal, from his own LinkedIn post on logistics), 6 Warm, 3 Check conflict, 9 Good fit (queued), 8 Same firm, 15 Low, 3 Quiet |
| Email draft settings | Filled from persona facts only: product, early revenue, USD 1–3M seed. Sign-off "Vikram". No company name or traction numbers, because none are known |
| Tavily | 347 of the 800-credit monthly budget used. LinkedIn adds about 46 credits a week |

## Quality numbers

- **Golden recall:** 6/6. SuperProcure is flagged as a competitor with verbatim evidence.
- **Eval (test split, 30 items):** acceptance precision 0.95, recall 0.95; about-this-VC precision 1.00. Type accuracy 0.70; relevance-level accuracy 0.77.
- **Calibration (v2, fit-first):**
  - Constants: REACH 30, WARM 15, half-life 20 days, FIT_STRONG 70, FIT_GOOD 50.
  - Result: 92% agreement with the ranking review.
- **LinkedIn content (first run):**
  - 72 of 92 posts accepted: 1 logistics, 34 adjacent, 35 unrelated. 20 rejected as profile boilerplate or not about the VC.
  - Every own post mentions the VC's tracked firm (34 of 35), which supports the handles.
- **Caveats** (also in the README):
  - The labels and ranking answers came from the builder (Claude Code) at the owner's request, not from a human.
  - Calibration rests on 2 positive examples.
  - Searches see only some LinkedIn posts, so activity under-counts and never over-counts.

## Stress tests (all on 2026-10-12)

- **Whole build:**
  - Every suite green: typecheck, lint, unit tests, DB ownership tests, eval gate, `npm audit` (0 vulnerabilities), production build.
  - Live production abuse checks pass: auth bypass attempts, bad input, 6 concurrent steps (nothing processed twice), 25 parallel dashboard loads.
  - Fixed:
    - the digest was lost when a run overflowed into the finisher;
    - repeated "Emailed today" clicks logged false events;
    - settings text had no length limits;
    - the "8 emails to send" count included optional Warm cards.
- **LinkedIn:**
  - A prompt-injection post was resisted by the classifier.
  - Near-miss handles, other people's posts and malformed URLs are all dropped.
  - Fixed:
    - hooks quoting a profile headline or someone else's comment are now blocked in code (59 hooks regenerated, every one reviewed);
    - stray page text stripped;
    - common-name VCs no longer lose their own posts to the name/firm filter;
    - failed searches retry on the next run.
- **Earlier (Phases 4–5):**
  - A real Gemini outage left a `partial` run with nothing written and nothing looping.
  - Fixed: claims released after each step; key rotation on 400 `API_KEY_INVALID`; header shows the last run that processed VCs.

## Open items

| Item | Owner | When |
|---|---|---|
| Scheduled cron processes all 50 VCs on its own (§15.1) | Automatic; checked by the scheduled task `vc-pipeline-thursday-acceptance` | Thu 2026-10-15: cron 06:00 IST, finisher 07:00/08:00, check 09:30 (needs the Claude app open, or it runs at next launch) |
| Third day of full runs (§13 Phase 4) | Same run and task | Thu 2026-10-15 |
| Strengthen the pitch line in Settings → Email drafts with the company name and a traction number | You | Before the first emails |
| Optional: set `DIGEST_WEBHOOK_URL` (Slack/Discord) on Vercel to get the digest after each run | You | Any time |
| Demo rehearsal (§15.12) | You | Any time. See `docs/DEMO.md`; a dry run of every step was done on 2026-10-12 |
| Instructor question: Claude Code as the build tool when the brief says "do not use Claude API" | You | Before submission. The runtime uses Gemini only, and the README has the tooling disclosure |

## Where to look

- `README.md`: setup, commands, AI boundary, eval, Components Map, limitations, tooling.
- `docs/SPEC.md`: amended where the owner decided (§11 drafts and funnel, §9.2/§16 LinkedIn).
- `docs/DECISIONS.md`: #1–46.
- Other docs: `docs/REVIEW.md`, `docs/PLAN-NEXT.md`, `docs/ACCEPTANCE.md`, `docs/DEMO.md`, `spike/REPORT.md`.
- `eval/`: labels, predictions, eval report, calibration, ranking review.
- `seed/linkedin_handles.csv`: the reviewed LinkedIn handles.
