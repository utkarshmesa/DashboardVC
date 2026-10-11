# Decisions

Decisions taken where the spec delegates to the owner or is silent. Vikram (the owner) delegated the
Phase 0 gate to the builder on 2026-10-12 ("do what works best"). Evidence: `spike/REPORT.md`.

## Phase 0 decision gate (SPEC §13)

| Finding | Measured | Decision |
|---|---|---|
| Google News errors on Vercel but not locally | 0 errors in both | **Keep collection on Vercel.** No GitHub Actions collector. |
| < 25% of VCs have an in-window accepted item | 72% overall, 50% dated-only, 14% Google News only | **Do not promote deal discovery yet.** Re-measure after the Tavily changes below on the first live Phase 1 run. If it is still < 25% on dated, labelled-precise items at the start of Phase 2, raise it again (it would require reading LATER.md, which needs explicit approval). |
| Appearance queries add < 10% of accepted items | 0% unique, both runs | **Drop the appearance collectors** (Google News appearances and Tavily appearances). The `vc_profile.appearance_checked_at` column stays unused. |
| Spike run time > 60% of the function limit | One 10-VC batch: 22–27%. All 50 in one invocation: ~81% | **Add `finisher.yml`** (built in Phase 4 per SPEC). Until then, cron only starts a step if the longest step so far, plus 10 s, still fits before `maxDuration`. |
| Golden recall < 4 of 6 | 4 / 6 | **No query fix needed.** The two misses are data issues (FreightFox 2026 headlines name HighLeaf; CargoFL headlines don't describe the product). Revisit the recall-test expectations for these two in Phase 2 instead of weakening the test now. |
| < 30% of items have a snippet beyond the headline | Google News ~1% (overall 58% only because of Tavily) | **Enable enrichment (SPEC §9.2)** in Phase 2. |
| > 50% of Tavily items undated | 62.5% / 66.7% | **Switch the Tavily fallback to `topic: "news"`** from Phase 1 on. |

## Spec silences and fixes

1. **Tavily domain exclusions.** 43 of 105 accepted spike items were LinkedIn/X pages, and many others were investor-profile directories. SPEC §16 forbids scraping LinkedIn or X. The Tavily fallback passes
   `exclude_domains: linkedin.com, x.com, twitter.com, tracxn.com, crunchbase.com, angellinx.com, cbinsights.com, pitchbook.com`.
2. **`claim_batch` re-claim clause.** SPEC §7 lets a step re-claim VCs where `claimed_run = p_run`. Because concurrent steps share one run (§9.1 lock), two concurrent steps could take the same VC, contradicting §12.4. Migration `002` redefines `claim_batch` without that clause and coalesces a null `p_failed`. `001` stays verbatim.
3. **Runner helpers (migration `002`).** `insert_signals` does `on conflict do nothing` across both unique keys, which PostgREST upsert can't express. `bump_run` makes counter and heartbeat updates atomic across concurrent steps. A partial unique index enforces one running run.
4. **Gemini fallback key.** `GEMINI_API_KEY_2` (optional) is tried on 401/403/429. `GEMINI_API_KEY` remains the spec'd primary.
5. **The vcs seed import was done by the builder**, via SQL as the `postgres` role, at the owner's request (2026-10-12). This replaces SETUP's table-editor step. `scripts/import-seed.ts` still refuses to run when `vcs` is empty (SPEC §8).
6. **Phase 1 classifier** asks only for the labels Phase 1 uses: about_this_vc, confidence, subject, signal_type, relevance, event_key, summary. Competitor, role change and hook arrive in Phases 2–3 with their guards.
7. **`proxy.ts` instead of `middleware.ts`.** Next.js 16 deprecated `middleware.ts` and renamed it `proxy.ts` (same role, Node runtime). SPEC §10's gate lives in `proxy.ts`.
8. **Cron step budget.** `runUntilDone` starts another step only if the elapsed time, plus the longest step so far, plus 10 s, fits in `maxDuration` (300 s). A Gemini call can take over a minute, so stopping blindly at 10 s before the limit could kill a step halfway through.

## Phase 2

9. **`funded_company` field (migration 004).** The conflict action is "Check conflict — backed {company}", but SPEC §9.4 has no company field. The classifier returns `funded_company` for investment items, and a code guard keeps it only if it appears verbatim in the title or snippet. If it's missing, the action falls back to the competitor evidence.
10. **Relevance floor.** SPEC §12.2 says "tune MIN_CONFIDENCE and the relevance threshold", but §9.4's acceptance rule has no relevance term. `MIN_RELEVANCE` (default 0, i.e. off) is added to acceptance as `llm_low_relevance`, and both thresholds are tuned on the eval tune split. Gold acceptance is defined as `about_this_vc && signal_type != irrelevant`.
11. **Enrichment in the recall fixtures.** Production enriches snippet-less items that decide a contact action (§9.2). `scripts/enrich-golden-fixtures.ts` froze those enrichment snippets (16 Tavily credits) into `eval/fixtures/golden/*.json` as an `enrichment` field; raw items are unchanged. The recall test classifies, enriches accepted snippet-less items from the frozen snippet, then reclassifies, mirroring production.
12. **Firm RSS and the filter.** Per §9.3, only person RSS is exempt from the name/firm rule, so firm-feed posts that never name the firm are rejected. Kept as specified.
13. **Ranking calibration rule (§12.3).** REACH and half-life maximise agreement between "would contact this week" and `score ≥ REACH`. A tie prefers half-life 20. WARM is the highest threshold below REACH that still catches every "would contact" VC.
14. **Open: golden events that cannot pass as written** (owner decision; the test is not weakened):
    - `freightfox-2026`: every item naming Aeravti is from October 2023, outside the 700-day window. The 2026 round headlines name HighLeaf, not Aeravti.
    - `cargofl-2025`: accepted as an investment, but no text, even after enrichment ("a B2B logistics technology platform"), describes CargoFL as substantially the same product as a TMS, so the outside-knowledge-free competitor rule leaves it unflagged.
