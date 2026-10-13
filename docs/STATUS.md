# Build status: VC Fundraising Pipeline Intelligence

*As of Tue 2026-10-13, evening IST. Live: https://vc-pipeline-zeta.vercel.app (no password; share the link only with people you trust). Production commit `e0a9685`.*

## Summary

**The build solves Problem Statement 10 as written.**
- **Schedule:** it runs twice a week (Mon/Thu 06:00 IST), before Vikram starts work.
- **Why to write:** it tells him who to contact this week and why, from an observable signal in the last 30 days: something they wrote, said, invested in or appeared at.
- **Who to skip:** it tells him who is quiet, so he knows where not to spend energy.
- **His table:** every run updates the 4 signal columns in his Supabase table, and only those. His notes and contact history are never touched; this is enforced in the database and proven by tests.

Since the last status, rebuilt around the problem statement only (DECISIONS #53–57):
- **Problem-only persona.** Seed round, B2B logistics SaaS. The invented TMS product and USD 1–3M round were removed.
- **Signal-first recommendations.** "Reach out" only on a dated logistics signal; fit alone never qualifies. Quiet investors are listed with a reason.
- **A to-do dashboard.** A weekly checklist with Done controls, a progress strip, a funnel and "Done this week". Also a spreadsheet-style **Pipeline** table (import and export his CSV, edit status and notes in the cell) and a **Progress** page.
- **First-use fixes from Vikram's point of view.** Drafts open with the signal; nudges reply in his existing thread; plain-language reasons; evidence shows why it's about the investor.
- **Contact emails.** 33 of 50 found (25 personal), so Gmail drafts open with the To field filled.
- **No password.** Names link to LinkedIn and firm websites.

**What remains:**
- **Automatic, Thu 15 Oct:** the scheduled cron must process all 50 VCs by itself; this is also the third day of runs. A scheduled task checks it at 09:30 IST.
- **Human steps:**
  - add the company name, a traction number and a deck link in Settings (the home page shows a reminder until then);
  - rehearse the demo;
  - decide whether to keep the labelled demo history for the submission.

## What Vikram sees today (live data)

| | Now |
|---|---|
| Headline | "7 things to do this week, 1 done so far" |
| Follow-ups due | 6: 3 nudges, 2 close-the-loop, 1 next step. All from the labelled demo history |
| Reach out: signal this week | 1: **Alok Goyal** (Stellaris). He posted about the logistics space on 30 Sep. His draft opens with that post, addressed to alok@stellarisvp.com from his own team page |
| If you have capacity | 10 good-fit investors who are active, but not on logistics; plain reasons |
| Not worth chasing this week | 23: 9 good fits to revisit when active, 5 quiet, 9 active only outside logistics |
| Other | 5 routed via a colleague at the same firm; 3 waiting (contacted in the last 7 days); 2 passed |
| Why the signal list is short | Only 1 of 120 accepted items in the last 30 days is about logistics. An independent web search found no missed logistics deal by these 50 firms in the window. The page says so plainly |

## Phases

| Phase | Status |
|---|---|
| 0–2 · Spike, walking skeleton, correctness | ✅ Precision 0.95, about-this-VC precision 1.00, recall 6/6 on frozen fixtures |
| 3 · Usefulness | ✅ The home page answers "what do I do this week, and why" in one line; ⏳ an independent human timing is still recommended |
| 4 · Reliability and submission | ⏳ 11 of 13 SPEC §15 items verified; the last 2 are due Thu 15 Oct |
| 5–5f · Beyond the spec | ✅ Drafts and digest; LinkedIn posts as signals (X off); route-aware outreach; runway and Add investors; investor brief (cheque, fund, deals) |
| Design and motion (#52–53) | ✅ Operational-console redesign with matching GSAP motion; reduced-motion safe |
| Access (#54) | ✅ No password; names link to LinkedIn (47/50) and firm sites (46/50) |
| **Plan V2 (#55)** | ✅ Problem-only persona; signal-first tiers; logistics-weighted score; to-do home, Pipeline, Progress; labelled demo history |
| **First-use fixes (#56)** | ✅ Drafts use the reason; CSV import and export; in-cell edits; clear labels; evidence with naming line; Gmail threads; plain reasons |
| **Contact emails (#57)** | ✅ 25 personal and 8 firm-inbox addresses with sources; Gmail To filled for new outreach |
| Deferred | ⏸ Undo after Done; tasks-first layout on mobile; the Progress page's "last run" can show a stress-test run; warm intros (needs Vikram's LinkedIn export); automated research refresh |

## Live system

| Part | State |
|---|---|
| Vercel `vc-pipeline` | Next.js 16, region bom1. Recent pushes deployed on their own through GitHub (source "git"); the API deploy path is kept as a fallback |
| Vercel Cron | `/api/cron` Mon/Thu 06:00 IST. Last fired on its own Mon 12 Oct; next Thu 15 Oct |
| GitHub finisher | Mon/Thu 07:00 and 08:00 IST; completes any run that overflows the 300 s limit |
| CI | Lint, typecheck, 150 unit tests and the recall replay on every push. All recent runs green |
| Supabase (ap-south-1) | Migrations 001–013; 50 VCs, 57 firms, 49 research candidates. The pipeline writes `vcs` only through `apply_signals`; his columns change only through `update_my_fields` / `update_my_thesis` |
| Signals | 168 accepted (73 from LinkedIn); 120 in the last 30 days; 0 pending. Last full run Tue 13 Oct (manual, all 50 processed, 0 failed) |
| Settings | Target space "B2B logistics and supply-chain technology…". Product empty, so competitor checks are off. Round size empty. The pitch is a neutral placeholder until Vikram sets it |
| Demo history | Loaded: 11 investors badged DEMO, notes start "[demo]", 16 flagged events. Clear it in Settings or with `scripts/demo-history.ts --clear` |
| Contact emails | `vc_contact`: 25 personal (7 from firm pages, 18 from Hunter at 81–99%) and 8 firm inboxes; 17 none (mostly form-route by design). `HUNTER_API_KEY` is in `.env.local` only, never on Vercel |
| Budgets | Tavily 391 of 800 this month. Hunter 22 of 50 searches used (resets 13 Nov; a reserve of 15 is kept). Gemini within quota |
| Performance | Home page 0.5 s on a single load; 25 parallel loads all succeed (median about 3 s) |

## Quality and verification

- **Unit tests:** 150 passing. Include property tests: one fresh logistics signal outranks any volume of off-topic activity; fit alone never yields "reach out".
- **Database ownership tests:** 4/4 against the live database. A CSV-import round trip on a live row changed the note and thesis and left all 4 system columns identical (then restored).
- **Live stress test** (`scripts/stress-live.mjs`): 27/27 on production. No password needed; old login gone; cron routes need the Bearer; bad input rejected; 6 concurrent steps never double-process; CSV export complete; no service key in client code.
- **Recall:** 6/6 on frozen fixtures, measured under the persona they were recorded with.
- **Accessibility and layout:** no sideways scroll at phone width on any page; keyboard paths kept; reduced motion respected.
- **First-use review from Vikram's point of view:** 10 complaints found; 6 fixed and verified. 3 small ones are deferred (above); the 10th, open-link editing, is an accepted trade-off.
- **Caveats:**
  - Logistics signals are rare, so most weeks the signal list is 0–3 investors.
  - The labels behind the eval were produced by the builder, not a human.
  - LinkedIn coverage is partial: it under-counts, never over-counts.
  - Anyone with the link can edit his data and press Run now.

## Open items

| Item | Owner | When |
|---|---|---|
| Scheduled cron processes all 50 VCs on its own; third day of runs | Automatic; task `vc-pipeline-thursday-acceptance` checks at 09:30 IST | Thu 15 Oct |
| Add company name, traction and deck link in Settings | You | Before the first real email |
| Keep or clear the labelled demo history for the submission | You | Before submission |
| Demo rehearsal (`docs/DEMO.md`; update for the to-do home and Pipeline) | You | Any time |
| Regenerate the Hunter key (it was pasted in chat) and update `.env.local` | You | When convenient |
| Optional quick fixes: Undo after Done, tasks first on mobile, real last run on Progress | Builder, on request | Before Thursday if wanted |
| Instructor question: Claude Code as the build tool when the brief says "do not use Claude API" | You | Before submission. The runtime uses Gemini only; the README discloses the tooling |

## Where to look

- `README.md`: setup, commands (`npm run step`, `rescore`, `emails`, `test:db`), AI boundary, eval, Components Map, limitations.
- `docs/SPEC.md`: amended §2, §9.5–9.7, §10 and §11 per the owner's decisions.
- `docs/DECISIONS.md`: #1–57. Recent: #55 (Plan V2), #56 (first-use fixes), #57 (contact emails).
- `docs/PLAN-V2.md`: first-principles plan, its stress test and amendments.
- `docs/ACCEPTANCE.md`, `docs/DEMO.md`, `spike/REPORT.md`, `eval/`.
