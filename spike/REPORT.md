# Phase 0 report: spike and evidence

Run date: 2026-10-11 (Sunday). Model: `gemini-3.8-flash`. Persona: SPEC §2 default (TMS / freight procurement).

- **Local:** all 50 tracked VCs in 5 batches of 10, Tavily cap 30.
- **Vercel:** project `vc-pipeline-spike` (root `/spike`), region `bom1`, Hobby (function limit 300 s), `GET /api/spike` behind `Bearer CRON_SECRET`. It ran the 10-VC sample (every 5th VC) with Tavily cap 10, plus the 6 golden queries.
- **Golden events:** one `"Company" "Firm"` Google News query per event, no `when:`, 700-day window.

Raw outputs are in `spike/out/` (gitignored). Frozen copies are in `eval/fixtures/`.

## Metrics

| Metric | Local (50 VCs) | Vercel (10-VC sample) |
|---|---|---|
| VCs with ≥ 1 candidate item | 46 / 50 (92%) | 10 / 10 (100%) |
| Items in the 30-day window | 133 dated in window, plus 75 undated (208 after dedupe) | 64 dated in window, plus 16 undated (80 after dedupe) |
| Items accepted by the classifier | 105 of 139 sent (36 VCs). Of these: 9 via Google News, 27 dated Tavily, 69 undated Tavily | 22 of 53 sent (7 VCs). Of these: 3 via Google News, 4 dated Tavily, 15 undated Tavily |
| Appearance-query items accepted | 0 found only by the appearance query (4 also found by the main query) | 0 found only by the appearance query (2 also found by the main query) |
| Golden events found (700-day window) | 4 / 6 (all 6 retrieved) | 4 / 6 (all 6 retrieved) |
| Gemini calls / any 429s | 6 for the run + 1 for golden / 0 | 2 for the sample + 1 for golden / 0 |
| Tavily credits | 30 (cap reached; 6 more VCs wanted one) | 6 |
| Total run time | 244 s. Per batch: 36 / 78 / 27 / 82 / 20 s. Golden: 27 s | 67 s for the 10-VC batch; 84 s for the whole function including golden (28% of 300 s) |
| Google News HTTP errors | 0 of 100 requests | 0 of 20 requests (+6 golden) |
| Items whose snippet adds text beyond the headline | 120 / 208 (58%). Google News: 1 / 95; Tavily: 120 / 120 | 24 / 80 (30%). Google News: 0 / 59; Tavily: 24 / 24 |
| Accepted items that name the partner in title or snippet | 95 / 105 | 22 / 22 |
| Tavily items with no date | 75 / 120 (62.5%) | 16 / 24 (66.7%) |

All 50 local VCs and all 10 Vercel VCs had `fetch_status = ok`. No Gemini failures, invalid JSON, unclassified items or items left pending. The hook guard dropped 6 hooks locally and 1 on Vercel. The competitor guard cleared 0 flags.

For comparison, the local run on the same 10 sample VCs gave 73 items and 17 accepted (6 VCs). The Vercel run found slightly more, most likely because Google News results changed between the two runs.

## Readings against the decision gate (your call, not mine)

| Finding | Measured | Gate trigger? |
|---|---|---|
| Google News errors on Vercel but not locally | 0 errors in both | No |
| < 25% of VCs have any in-window accepted item | Headline: 72% (36/50). Counting dated items only: 50% (25/50). Counting Google News items only: 14% (7/50). See note 1 | Depends which number you trust. **Yes** on Google News alone |
| Appearance queries add < 10% of accepted items | 0% in both runs | **Yes** |
| Spike run time > 60% of the Vercel function limit | One 10-VC batch: 67 s (22%); whole function: 28%. A full 50-VC run takes about 244 s (81%). See note 3 | Not for one batch. **Yes** if cron runs all 5 batches in one invocation |
| Golden recall < 4 of 6 | 4 / 6 in both runs | No, but only just. See note 4 |
| < 30% of items have a snippet beyond the headline | Overall 58% local / 30% Vercel, but Google News items are about 1% and Tavily items 100% | Overall: no. **Yes** for Google News items |
| > 50% of Tavily items undated | 62.5% local / 66.7% Vercel | **Yes** |

## Notes and findings

1. **Accepted items are noisy, so the 72% overstates real signal.** 96 of the 105 accepted items come from Tavily, and 69 of those are undated (scored as if 30 days old). Reading the list, many are not signals from the last 30 days at all: LinkedIn/X profile and post pages (43 of 105 accepted), Tracxn/Crunchbase/AngelLinx investor-profile pages, "About Us" pages, and a "List of Nodal officers" PDF. The classifier accepted most of these at confidence 0.9 or above, typed as `other` or `speaking`. Phase 2 labelling (`eval/to_label.jsonl`) will put a number on this. I expect acceptance precision to fall short of the 0.80 gate without changes. Possible fixes: Tavily `topic: news` (which also fixes the dates), `exclude_domains` for linkedin.com, x.com, twitter.com, tracxn.com and crunchbase.com, and not scoring undated items.
2. **No accepted item is relevant to the TMS persona.** No accepted item has relevance ≥ 0.4 in either run, and no live competitor flags came up. On this week's data, every contact action would come from generic activity, not freight or logistics signals.
3. **Gemini latency dominates run time.** Each call took 13–70 s (median about 27 s) for 8–40 items; collection takes only 6–12 s per batch. One 10-VC batch fits easily within 300 s, but looping all 5 batches in a single cron invocation would get close to the limit.
4. **The two golden misses are data/spec issues, not query bugs.**
   - `freightfox-2026`: the 2026 round headlines name HighLeaf, not Aeravti ("HighLeaf leads Rs 5 Cr pre-Series A round in FreightFox"). The Aeravti items are from October 2023, outside the 700-day window. Aeravti may well have joined the 2026 round, but no headline says so, and Google News items carry no snippet. Either the golden event needs correcting, or this case needs enrichment.
   - `cargofl-2025`: three items were correctly accepted as `investment` for YourNest. But `competitor_under_default_persona: true` can't be met, because no headline describes CargoFL's product, and the competitor rule forbids outside knowledge. It would need snippet enrichment, or a relaxed expectation.
   - `superprocure-2026` was flagged as a competitor with verbatim evidence "Unified TMS Platform". `flo-mobility-2026` matched even though the seed lists Arali and the source is Mela's site: the headlines name both firms.
5. **Appearance queries add nothing.** Every accepted appearance item was also returned by the main query. The appearance query mostly brings in namesakes, e.g. news about the wrestling-federation figure Brij Bhushan.
6. **Tavily dates need `include_published_date: true`.** The current Tavily docs return `published_date` only when this flag is set (it is on automatically for `topic: news`). The spike sets it, and 62.5% of results still came back undated.
7. **Tavily budget.** The local run hit its 30-credit cap with 6 VCs still wanting a call. The Vercel run used 6. The month-to-date total is 36, within the Phase 0 cap of 40.

## Errors hit

- **Gemini key 1 rejected (HTTP 401).** It's kept commented out in `.env.local`. Key 2 is the primary and key 3 the fallback. No key rotation was needed during the runs.
- **`vercel link` wrote `spike/.env.local`** (a Vercel OIDC token) and `spike/.gitignore`. I deleted the token file; the gitignore stays.
- **Bash heredoc damaged two regex lines** while writing `spike/lib/text.ts`. The typecheck caught it before any run.
- No runtime errors in either run: 0 Google News errors, 0 Tavily errors, 0 Gemini errors.

## Label set

`eval/to_label.jsonl` holds 60 items from 36 VCs, drawn from the 139 items the classifier saw:

| Bucket | Items |
|---|---|
| Likely namesake / wrong person (model said "not about this VC", ambiguous name via Tavily, or no firm mention) | 15 |
| Accepted, undated Tavily | 22 |
| Accepted, dated Tavily | 15 |
| Accepted, Google News | 6 |
| Rejected for other reasons | 2 |

The file is blind: no URL, no model labels. Item IDs map to `eval/fixtures/spike_items.jsonl`, which freezes all 208 items with URL, dates, sources and the model's labels.

## Fixtures

- `eval/fixtures/golden/<event>.json`: the raw Google News items per golden event (title, snippet, url, publisher, date), captured on 2026-10-11.
- `eval/fixtures/spike_items.jsonl`: every item from the local run.
