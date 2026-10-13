# Build status: VC Fundraising Pipeline Intelligence

*As of 2026-10-12 (night). The live app is at https://vc-pipeline-zeta.vercel.app (commit `fcf8040`).*

**Summary.** Everything specified is built, deployed and stress-tested. Beyond the spec, the owner approved and received:
- a fit-first weekly plan (Phase 5);
- sendable email drafts, a digest and an outcome log (5b);
- LinkedIn posts as an activity and relevance signal (5c; X stays off);
- route-aware outreach and a pipeline runway with one-click "Add investors" (5d);
- a full frontend redesign, stress-tested for accessibility, layout, keyboard use and failures (5e).

What remains:
- **11 of 13 acceptance items (SPEC §15) are verified on production.** The other 2 depend on the calendar: a scheduled cron that processes all 50 VCs by itself, and a third day of full runs. Both fall on **Thursday 2026-10-15**. A scheduled task checks them at 09:30 IST and updates this file and `docs/ACCEPTANCE.md`.
- **Human steps:**
  - rehearse the demo (`docs/DEMO.md`, updated for the redesign);
  - add the company name, a traction number and a deck link in Settings;
  - reconnect Vercel's GitHub integration (see Live system).
- **Not doing:** key rotation, which the owner chose to skip for this project.

## Phases

| Phase | Exit check | Status |
|---|---|---|
| 0 · Spike and evidence | Metrics report delivered; gate decided | ✅ `spike/REPORT.md`; gate decisions in `docs/DECISIONS.md` |
| 1 · Walking skeleton | Cron fires on the live URL; table updates with real data; ownership test passes in production | ✅ |
| 2 · Correctness | CI green; eval gate met on the test split; ranking agreement recorded; values in README | ✅ Precision 0.95, about-this-VC precision 1.00; recall 6/6 |
| 3 · Usefulness | A newcomer answers "who to email this week, with what opener" in under a minute | ✅ The headline now answers it in one line; ⏳ an independent human timing is recommended |
| 4 · Reliability and submission | SPEC §15 all ticked | ⏳ 11/13; the last 2 are due Thu 15 Oct |
| 5 · Fit-first weekly plan (`docs/REVIEW.md`) | Best-fit VCs reach This week; competitor firms flagged; follow-ups tracked | ✅ All 12 tier-1 VCs are in outreach, the queue, a conflict check or a same-firm route (was 1 of 12). 3 TMS-competitor partners flagged. 92% agreement with the ranking review |
| 5b · Drafts, digest, outcome log | Sendable drafts; outreach funnel; digest | ✅ Research-grounded openers (21 live, guarded); drafts assembled in code; `/api/digest` with an optional webhook; funnel on Quality |
| 5c · LinkedIn posts (X off) | Activity and relevance from posts, without scraping | ✅ 77 reviewed handles (46 VCs, 31 firm pages). 92 posts across 32 of 50 VCs, all dated. "Active on LinkedIn" chip; prompt injection resisted; headline/comment hooks blocked in code |
| 5d · Reaching out and runway (`docs/REVIEW-2.md` items 3, 2) | Route-aware outreach; the pipeline never runs dry silently | ✅ Form / LinkedIn / contact / Gmail actions with "Sent it?" logging and channel; deck link; runway (21 firms ≈ 3 weeks); Investors page with 49 researched candidates and manual add (row O6) |
| 5e · Frontend redesign | Presentable, easy to scan, feels good to use | ✅ Design system (tokens, dark mode, Instrument Serif + Geist); one-line answer for the week, stat tiles, pipeline strip; person-first cards with one primary action and tabbed details; every page restyled. Stress test: axe 0 violations (light and dark), no sideways scroll at 320–1440 px, full keyboard support, failures shown instead of hanging, payload down 38% |
| 5f · Investor brief (owner request) | Know the person and fund before pitching | ✅ Profile tab + one-line brief: cheque vs round, fund status, 111 sourced deals across 45 VCs (42 in your space), person, caveats; possible-competitor deals flagged (found one on Caret Capital, see DECISIONS #50); 122 tests |
| Deferred, with evidence | Deal discovery; automated research refresh; warm intros (REVIEW-2 item 1); conversation stages (item 4) | ⏸ Deal discovery and research refresh: `docs/PLAN-NEXT.md`. Warm intros need Vikram's LinkedIn Connections export; conversation stages should land before the first replies |

## Live system

| Part | State |
|---|---|
| Vercel project `vc-pipeline` | Next.js 16, region bom1. ⚠ GitHub auto-deploy has been unreliable since the afternoon of 12 Oct: several pushes got no deployment (no status, no error). Each was deployed from its GitHub commit through the Vercel API (`6633e83`, `298a489`, `fab66cb`, `fcf8040`). **Reconnect the GitHub integration in Vercel → Project → Settings → Git** |
| Vercel Cron | `/api/cron`, Mon/Thu 06:00 IST. Fired on its own on Mon 12 Oct. Unaffected by the deploy issue: it runs the current production build |
| GitHub finisher | Mon/Thu 07:00 and 08:00 IST plus manual dispatch. If a cron run overflows the 300 s limit, the finisher completes it and posts the digest (once per run) |
| LinkedIn search | Weekly per VC (Monday run; the Thursday run skips it). Last checked Mon 12 Oct, so next due Mon 19 Oct |
| CI | Lint, typecheck, 113 unit tests and the recall replay (6/6) on every push; no secrets needed. All recent runs green |
| Supabase `vc-pipeline` (ap-south-1) | Migrations 001–010; 50 VCs, 57 firms, 50 profiles, 49 open candidates. RLS denies anon/authenticated; the pipeline writes `vcs` only through `apply_signals` |
| Data | 155 accepted signals (72 from LinkedIn), 21 openers, 0 logged outreach events (nothing sent yet) |
| Weekly plan now | 5 Reach out (strong fit), 1 Reach out this week (Alok Goyal, from his own LinkedIn post on logistics), 6 Warm (optional), 3 Check conflict, 9 Good fit (queued), 8 Same firm, 15 Low, 3 Quiet |
| Email draft settings | Filled from persona facts only: product, early revenue, USD 1–3M seed. Sign-off "Vikram". No company name, traction number or deck link yet |
| Tavily | 347 of the 800-credit monthly budget used. LinkedIn adds about 46 credits a week |
| Performance | Home page 61 KB compressed (was 99 KB); single loads 0.25–0.4 s warm; 25 parallel loads all succeed (median 2.3 s) |

## Quality numbers

- **Golden recall:** 6/6. SuperProcure is flagged as a competitor with verbatim evidence.
- **Eval (test split, 30 items):** acceptance precision 0.95, recall 0.95; about-this-VC precision 1.00. Type accuracy 0.70; relevance-level accuracy 0.77.
- **Calibration (v2, fit-first):** REACH 30, WARM 15, half-life 20 days, FIT_STRONG 70, FIT_GOOD 50, giving 92% agreement with the ranking review.
- **LinkedIn content (first run):** 72 of 92 posts accepted (1 logistics, 34 adjacent, 35 unrelated); 34 of 35 own posts mention the VC's tracked firm, which supports the handles.
- **Accessibility:** WCAG 2.1 AA via axe-core, 0 violations on every page in light and dark mode. All key colour pairs are at 4.5:1 or better.
- **Caveats** (also in the README):
  - The labels and ranking answers came from the builder (Claude Code) at the owner's request, not from a human.
  - Calibration rests on 2 positive examples. Real replies, after about 20 logged emails, should replace them.
  - Searches see only some LinkedIn posts, so activity under-counts and never over-counts.

## Stress tests (all on 2026-10-12)

- **Whole build:**
  - Every suite green: typecheck, lint, unit tests, DB ownership tests, eval gate, `npm audit` (0 vulnerabilities), production build.
  - Live production abuse checks pass: auth bypass attempts, bad input, 6 concurrent steps (nothing processed twice), 25 parallel loads.
  - Fixed:
    - the digest was lost when a run overflowed into the finisher;
    - repeated clicks logged false events;
    - settings text had no length limits;
    - optional Warm cards were counted as committed emails.
- **LinkedIn:**
  - Prompt injection was resisted; near-miss handles and other people's posts are dropped.
  - Fixed: headline/comment hooks are blocked in code; stray page text stripped; common-name VCs keep their own posts; failed searches retry.
- **Reaching out and runway:** a live add test showed weak-fit candidates would land as Quiet. Fixed with row O6, so an investor Vikram adds himself is queued.
- **Frontend:**
  - Every write action was exercised through the UI on live data and reverted, plus a temporary follow-up state and a 120-character name. Database verified identical to the snapshot afterwards.
  - Fixed:
    - **actions hung on "Saving…" when the network failed**; they now say so;
    - the phone layout scrolled sideways;
    - 2 accessibility violations;
    - focus was lost when a row expanded;
    - tabs lacked arrow keys;
    - no skip link;
    - small tap targets;
    - payload was 41% rejected items, now loaded on demand.
- **Earlier (Phases 4–5):** a real Gemini outage left a `partial` run with nothing written and nothing looping. Fixed: claims released after each step; key rotation on 400 `API_KEY_INVALID`; the header shows the last run that processed VCs.

## Open items

| Item | Owner | When |
|---|---|---|
| Scheduled cron processes all 50 VCs on its own (§15.1) | Automatic; checked by the scheduled task `vc-pipeline-thursday-acceptance` | Thu 2026-10-15: cron 06:00 IST, finisher 07:00/08:00, check 09:30 (needs the Claude app open, or it runs at next launch) |
| Third day of full runs (§13 Phase 4) | Same run and task | Thu 2026-10-15 |
| Reconnect Vercel's GitHub integration so pushes deploy on their own | You | Before the next code change |
| Add the company name, a traction number and a deck link in Settings | You | Before the first emails |
| Decide on Caret Capital: a source says SuperProcure (TMS competitor) raised from "Carat Capital". If it is Caret, mark it a conflict | You | Before emailing Prajakt Raut |
| Send the week's emails and log them ("Sent it?" or "Mark as sent"); after about 20, recalibrate on real replies | You (Vikram) | This week onwards |
| Optional: export LinkedIn Connections for warm-intro paths (REVIEW-2 item 1) | You (Vikram) | When convenient |
| Optional: set `DIGEST_WEBHOOK_URL` (Slack/Discord) on Vercel to get the digest after each run | You | Any time |
| Demo rehearsal (§15.12) | You | Any time. See `docs/DEMO.md`, updated for the redesign |
| Instructor question: Claude Code as the build tool when the brief says "do not use Claude API" | You | Before submission. The runtime uses Gemini only, and the README has the tooling disclosure |

## Where to look

- `README.md`: setup, commands, AI boundary, eval, Components Map, limitations, tooling.
- `docs/SPEC.md`: amended where the owner decided (§9.2/§16 LinkedIn, §9.6 row O6, §11 drafts, routes, Add investors).
- `docs/DECISIONS.md`: #1–52.
- Reviews and plans: `docs/REVIEW.md`, `docs/PLAN-NEXT.md`, `docs/REVIEW-2.md`.
- Acceptance and demo: `docs/ACCEPTANCE.md`, `docs/DEMO.md`; spike report in `spike/REPORT.md`.
- `eval/`: labels, predictions, eval report, calibration, ranking review.
- `seed/linkedin_handles.csv`: the reviewed LinkedIn handles.
