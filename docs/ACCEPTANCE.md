# Acceptance checklist (SPEC §15), on the deployed URL

Checked 2026-10-12 against https://vc-pipeline-zeta.vercel.app and the production Supabase project. ✅ = verified, ⏳ = needs time or a human.

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Cron-triggered and manual runs both complete for all 50 VCs | ✅ / ⏳ | `/api/cron`, called with the cron bearer on 2026-10-11, processed all 50 in 131 s (`done`). Manual runs (trigger `manual`) completed all 50 several times. The scheduled Vercel Cron fired on its own on 2026-10-12 at 06:26 IST, but processed 0 because every VC had been processed within 24 h. ⏳ A scheduled run that processes all 50 on its own is expected at Thu 2026-10-15 06:00 IST, with the finisher at 07:00/08:00. |
| 2 | ≥ 1 VC shows an accepted signal with a working link dated within 30 days | ✅ | 11 of the 12 newest accepted in-window links return HTTP 200 (e.g. Hemant Mohapatra, 11 Oct; Chiratae/Quanfluence, 7 Oct). The 12th is a 403 from YourStory blocking automated requests. |
| 3 | Quiet VCs show `Quiet — hold`, not blank | ✅ | 16 VCs show `Quiet — hold`; 0 VCs have a blank action or summary. |
| 4 | Ownership integration test passes against production | ✅ | `npm run test:db`: 4/4 (pipeline writes leave Vikram's columns' hash unchanged; direct `.update()` refused; `update_my_fields` can't change system columns; anon can't read `vcs`). |
| 5 | Dashboard edits never change system columns; runs never change Vikram's columns | ✅ | Database guard plus RPCs. Live: an inline-edit round trip changed only notes. The outage stress test compared all 50 rows before and after a full run: 0 Vikram-owned columns changed. |
| 6 | A simulated Gemini failure yields a `partial` run, unwritten affected VCs, and no infinite loop | ✅ | Live (invalid key, Tavily budget 0): the run ended `partial` after 6 steps; the 3 VCs with pending items were in `failed_vc_ids` with unchanged system columns; a follow-up run restored them. Unit test `runner` covers it too. |
| 7 | Eval gate met; recall test passes in CI | ✅ | Test split: acceptance precision 0.95, about_this_vc precision 1.00. CI green; recall 6/6 replayed. |
| 8 | Two tracked partners at one firm never both show a contact action | ✅ | Live invariant query: 0 firms with more than one contact action. Firm dedupe runs at the end of every run and after every thumbs or edit rescore. |
| 9 | Every hook shown passes the guard; no hook on rejected items | ✅ | All 73 stored hooks re-checked with `hookSupported`: 0 failures; 0 hooks on non-accepted items. |
| 10 | Service-role key absent from the client bundle (grep the build) | ✅ | Local `.next/static` (13 files) and the 7 production client chunks: no key, no `service_role`. |
| 11 | No Anthropic SDK or API call anywhere in the codebase | ✅ | `grep` over app code, scripts, tests, `package.json` and the lockfile: none. |
| 12 | README sections 1–7 present; demo script rehearsed | ✅ / ⏳ | README has all seven sections (what it does, setup and env, AI boundary with eval, data and terms, Components Map, limitations, tooling). `docs/DEMO.md` is written. ⏳ Rehearsal is a human step. |
| 13 | A thumbs-down on a signal changes that VC's score and action immediately | ✅ | Live: Venkatesh Peddi went from 24 Warm to 0 Quiet 2.9 s after a 👎 on his only signal; removing the 👎 restored 24 Warm. |

Also required by SPEC §13 Phase 4: **run the pipeline at least 3 times across different days.** Full runs so far: 2026-10-11 (cron endpoint, plus manual runs) and 2026-10-12 (manual). ⏳ The third day is the scheduled Thursday 2026-10-15 run.
