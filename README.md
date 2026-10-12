# VC Fundraising Pipeline Intelligence

Twice a week this collects public signals (deals, writing, talks, press) about the VCs on a founder's list and labels them with Gemini. Plain code then scores each VC and writes four system columns of the founder's Supabase `vcs` table: last signal date, summary, follow-up score and recommended action. A password-protected dashboard shows who to contact this week, why, and the source link.

> Work in progress: Phases 0–2 done (see `docs/SPEC.md` §13). Sections marked *Phase 4* will be completed before submission.

## Where AI is used, and where it deliberately isn't

- **Gemini Flash (`GEMINI_MODEL`)** reads each item's headline and ≤300-char snippet. It labels whether the item is about this VC, the signal type, subject, a fixed relevance level against the target space (mapped to a number in code), possible competitor against the founder's product (with verbatim evidence) and the funded company, and writes a 20-word summary.
- **Code** owns everything that must be verifiable and repeatable: dates (from source metadata only), URLs (from collectors only), the filter, acceptance thresholds, scores, actions, firm dedupe and every database write. Code guards drop competitor flags and company names that aren't verbatim in the item text.
- The database enforces ownership: the pipeline can write only the four system columns (`apply_signals`), dashboard edits only the founder's columns (`update_my_fields`), and a direct `.update()` on `vcs` is refused.

## Evaluation

| Check | Result |
|---|---|
| Golden recall (6 real deals, frozen fixtures; CI replays recorded Gemini responses) | **6 / 6**, after the owner-authorised seed corrections in `docs/DECISIONS.md` #14–16 |
| Acceptance precision on the test split (gate ≥ 0.80) | **0.95** (recall 0.95; 30 test items) |
| `about_this_vc` precision on the test split (gate ≥ 0.90) | **1.00** (recall 1.00) |
| Type accuracy / relevance-level accuracy (test) | 0.70 / 0.77 |
| Chosen `MIN_CONFIDENCE` / `MIN_RELEVANCE` | **0.7 / 0.** Tuned on the tune split; 0.5–0.7 tie, so the default is kept |
| Ranking review agreement | **98%** (49/50). Only 2 of 50 VCs were "would contact this week", so this calibration is thin; redo it as evidence accumulates |
| Chosen `REACH` / `WARM` / `HALF_LIFE_DAYS` | **30 / 15 / 20** (`eval/calibration.json`). Contact actions also need the evidence floor, which no VC meets yet |

Labels (`eval/labels.jsonl`, 60 items, 10 not about the VC) and the ranking-review answers were written by the builder (Claude Code) from first principles at the owner's request, not by a human; see `docs/DECISIONS.md` #20–22 for this and for the prompt definitions tightened during tuning.

## Commands

| Command | What it does |
|---|---|
| `npm test` | Unit tests plus the recall test, which replays recorded Gemini responses (no keys needed) |
| `npm run test:recall:live` / `test:recall:record` | Recall test against live Gemini; record after any classifier prompt, schema or fixture change |
| `npm run diagnose` | Score diagnosis per VC → `eval/score_diagnosis.md` |
| `npm run test:db` | Ownership integration test against the Supabase project in `.env.local` |
| `npm run import-seed` | SPEC §8 seed import (firms, persona, profiles) |
| `npm run step [-- --force]` | Run the pipeline locally until the run is done |
| `npm run settings -- --target-space "…" --my-product "…"` | Change either setting and queue in-window signals for reclassification (also on `/settings`) |
| `npm run eval` | Precision/recall on hand labels, with tune/test split |
| `npm run ranking:export` / `ranking:calibrate` | §12.3 ranking review |
| `npm run rescore` | Recompute all scores and actions from stored signals (after a constants change); no fetching |

## Setup, data and terms of use, Components Map, known limitations, tooling disclosure

*Phase 4.* See `docs/SPEC.md` §14 for the required content and `docs/DECISIONS.md` for every decision taken where the spec was silent.
