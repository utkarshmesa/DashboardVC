# Plan V2: make the build solve the problem statement, not our invented version of it

*Written 2026-10-13 after a first-principles stress test against "Problem Statement 10" (the only source of truth about Vikram).*

## 1. First principles: what Vikram needs (only from the problem statement)

What we actually know about him:
- **Who he is:** a first-time founder raising a **Seed** round for a **B2B logistics SaaS**, two months in.
- **His list:** 50 VCs, each with name, firm, thesis, last contact, and whether he's waiting for a reply or yet to reach out.
- **Where he keeps it:** a spreadsheet.

Everything else in today's build was invented by us: a freight-procurement/TMS product, mid-size Indian manufacturers, a USD 1–3M round, early revenue and named competitors.

His jobs, in order:

| # | Job | Today |
|---|---|---|
| J1 | **Twice a week, before work**: know who is worth contacting *this week* | Cron Mon/Thu 06:00 IST ✅ |
| J2 | ...and **why**: an observable signal from the past 30 days (wrote, said, invested in, appeared at), "not a hunch" | ❌ 1 of 6 "reach out" picks rests on such a signal; 2 have none at all |
| J3 | Know who is **quiet**, so he doesn't spend energy there | ⚠️ 15 VCs have no 30-day activity, but only 3 are labelled Quiet |
| J4 | Keep relationships in flight moving (he is "waiting for a response" on some) | Logic exists, but untested: the table has no contact history |
| J5 | His **Supabase table** is current after every run: 4 system columns only, notes and contact history untouched | ✅ by construction (`apply_signals` writes exactly 4 columns), but never demonstrated |
| J6 | **Track progress and to-dos** (owner feedback 2026-10-13) | ❌ Cards vanish when done; outcome numbers are hidden on the Quality page |

Key fact from the stress test: **in-space signals are genuinely rare.** In 30 days, only 1 collected item mentions logistics or supply chain. An independent web search found no logistics deal by any of the 50 firms inside the window. An honest signal list will usually be short (1–3 VCs). The product must say that plainly, not pad the list with fit-based picks dressed up as signal.

## 2. Specific changes

### A. Persona: only what the problem states
- **A1. Broaden persona defaults** (`lib/config.ts`, SPEC §2; saved through Settings, which re-classifies in-window signals).
  - `target_space`: "B2B logistics and supply-chain technology: software that moves, stores, tracks or buys goods (transport, warehousing, fleet, visibility, procurement, last-mile, trade and customs, logistics analytics), and logistics companies themselves." The problem counts "an investment in a logistics company" as signal.
  - `my_product`: **empty**, because the problem doesn't name his sub-category. Competitor checks stay off until Vikram describes his product. This is already supported: empty means off.
- **A2. Remove the invented round size everywhere.**
  - Header "SEED · USD 1–3M" becomes "SEED ROUND", and the hero copy changes to match.
  - The form answers' "Round: Seed, USD 1–3M" (`lib/route.ts`) is taken from Settings instead.
  - Cheque-vs-round notes (`lib/brief.ts`) and round-size fit flags (`lib/fit.ts`: "too small to lead", "larger than this round") apply only if Vikram enters a round size.
  - Seed-stage flags ("usually invests after seed", "wants PMF first") stay, because the stage is in the problem.
  - New optional **Round size** field in Settings (blank means unknown).
- **A3. Conflicts follow the persona.** Standing research conflicts ("backed a TMS company") and Gemini `possible_competitor` run only when `my_product` is set. While it's empty, a VC's logistics portfolio companies count as **track record (positive)**, which is what the problem calls a receptive investor. Today, 3 of the most logistics-active investors are buried under "Check conflict".

### B. Recommendations: signal first, honestly labelled ("not a hunch")
- **B1. New decision tiers** for VCs not yet contacted (`lib/actions.ts` and its tests; SPEC §9.6):
  - **Reach out — signal this week**: at least one in-space (core or logistics) investment, post or talk in the last 30 days (the existing evidence floor). A score threshold is no longer required, because any such signal qualifies; the score only orders the list.
  - **If you have capacity — good fit, active elsewhere**: strong or good fit with 30-day activity outside logistics. The reason says so.
  - **Quiet — good fit, revisit when active**: strong or good fit with no 30-day activity. Not chased this week.
  - **Low — active outside your space** (renamed from the misleading "weak or fading signal").
  - **Quiet — hold**: nothing in 30 days.
  - "Reach out — strong fit" is removed as an outreach driver. The weekly cap of 7 fills from the signal tier first.
  - The follow-up engine (awaiting reply, in conversation) is unchanged; it is driven by Vikram's status, and a fresh signal upgrades a nudge.
- **B2. The follow-up score means "worth contacting now"** (`lib/config.ts`, `lib/scoring.ts`).
  - Relevance weights become: core 1.0, logistics 0.8, adjacent **0.15**, unrelated **0**.
  - The volume bonus is capped at the next two signals, so lots of off-topic posts can't outscore one logistics post.
  - REACH/WARM are recalibrated with `lib/eval.ts`.
  - New property test: one in-space post from the last 14 days always outranks any amount of off-topic activity.
- **B3. The summary column is the reason, in the problem's words.**
  - It leads with the in-space signal, e.g. "Wrote about logistics tech · 30 Sep · LinkedIn".
  - Otherwise: "No logistics activity in 30 days; active on deeptech", or "No public activity in 30 days".
  - Undated items are never presented as current; they're labelled "(undated)", which keeps the summary consistent with an empty `last_signal_date`.
- **B4. One vocabulary.** The dashboard and the Supabase table show the same action strings, so "when he opens his pipeline, it is already up to date".

### C. Progress and to-dos (owner request)
- **C1. Home becomes a to-do list for the week**, not a wall of dossiers.
  - One line per task: verb, who, why, one primary button, and a Done control.
  - Order: Follow-ups due → Reach out (signal) → Check before pitching (only if conflicts are on) → If you have capacity.
  - Expanding a task opens the existing dossier (profile, draft, evidence, notes).
- **C2. Done stays visible.** Logging Sent, Replied, Meeting, Passed or Snoozed ticks the task off. It stays on the list for the rest of the ISO week, read from `outreach_events`, with a counter such as "4 of 7 done this week". Today a done card just disappears, so there's no sense of progress.
- **C3. Progress panel** on the home page:
  - a funnel (To contact → Contacted → Replied → Meeting → Passed) with counts and conversion rates;
  - this week vs last week (sent, replies, meetings);
  - a weekly target bar (7 new per week);
  - "week N of the raise" and the runway.
  - Outcome numbers move off the Quality page, which keeps signal precision only.
- **C4. A Pipeline page shaped like his spreadsheet.**
  - All 50 rows, with columns mirroring his Supabase table: name/firm, status, last contact, last signal date, summary, follow-up score, action, notes.
  - Sort, filter (status, action group) and inline status/notes edits.
  - A row click opens the dossier; "Add investors" moves here.
- **C5. The quiet list is explicit:** "Not worth chasing this week (N)", each with its reason.
- **C6. Navigation:** This week · Pipeline · Progress (funnel and signal quality) · Settings.

### D. His data, and proving the notes guarantee
- **D1. Spreadsheet import** in Pipeline.
  - Upload his CSV (name, firm, thesis, status, last contact, notes).
  - Rows are matched on name + firm. Only his columns are filled, through `update_my_fields`; new rows are added.
  - The 4 system columns are never written.
  - Today the first import needs the Supabase table editor.
- **D2. Notes-guard proof on production** (`scripts/notes-guard.mjs`, ACCEPTANCE): write a marker note and contact date on one VC, run a pipeline step, assert both are byte-identical, then restore them.
- **D3. No invented contact history about real, named investors** on a public page. History arrives through D1 or through normal use.

### E. Verification and rollout
- **E1. Tests and docs.**
  - Tests: the actions table, scoring, brief, fit, the 50-row table invariants, and the eval replay.
  - Docs: SPEC §2, §9.5, §9.6 and §11 amendments, DECISIONS #55, STATUS.
- **E2. Rollout.**
  1. Save the new persona (re-classification uses Gemini only).
  2. Do a full run (about 100 Tavily credits; 453 left this month).
  3. Re-run the J1–J6 stress test on production, then deploy.
  - Do all of this **before Thursday 06:00 IST**, so the scheduled acceptance run validates the new logic.

## 3. Plan

| Phase | Scope | Exit check (against the problem) |
|---|---|---|
| **1. Honest recommendations** | A1–A3, B1–B4, the related tests, recalibration | Every "Reach out" row in Supabase cites a dated in-space signal ≤ 30 days old. Every VC not yet contacted with no 30-day activity is Quiet. No invented facts (USD 1–3M, TMS, Indian manufacturers) remain in the UI, drafts or table. The property test passes. Eval recall is no worse. |
| **2. To-dos and progress** | C1–C6 | In 5 seconds Vikram can answer "what do I do today?", "how much have I done this week?" and "where is each VC?". Done items survive a refresh. axe finds 0 violations; no horizontal overflow from 320 to 1280 px; keyboard works throughout. |
| **3. His data** | D1–D2 | A CSV round trip touches no system column, and notes-guard passes on production. |
| **4. Rollout** | E1–E2 | The J1–J6 stress test passes on production, and Thursday's scheduled run produces the new tiers on its own. |

Order and timing: phases 1 → 2 → 4 land by Wednesday night, before the Thursday cron. Phase 3 can follow without blocking.

What to expect with today's data: the signal tier will hold about 1–3 VCs (Alok Goyal for sure). The capacity tier will list good-fit investors who are active elsewhere, and around 15 VCs will be marked quiet. That's the honest picture the problem asks for.

## 4. Stress test of this plan (2026-10-13, before building)

Simulated on live data, these are the plan's rules applied to today's signals:
- **Signal tier:** 1 VC (Alok Goyal).
- **Active only outside logistics:** 34.
- **Quiet:** 15.
- **Score order:** Alok becomes the top score. Off-topic volume drops to about 15 or below.

Independent searches for logistics talks, posts and events by these firms in the window found nothing extra, so the collectors aren't missing much.

Amendments:
1. **Empty signal tier is the normal case.** Design for it: "No investor showed logistics activity in the last 30 days", then the capacity list. Never leave a blank page.
2. **Replace D3.** Without contact history, J4 (follow-ups) and the notes guarantee can't be seen, and the progress panel shows only zeros. Vikram is fictional, so real history will never arrive. Load a small **demo history labelled as demo everywhere** (badge on rows, "[demo]" in notes, one-click clear). Decision pending with the owner.
3. **Recall experiment.** Add a free, logistics-focused Google News query per firm (`firm (logistics OR "supply chain" OR freight)`). Keep it only if it surfaces in-space items the name query misses.
4. **Order.** Phase 1 and rollout are mandatory before Thursday's 06:00 IST cron. Phase 2 follows if time is short.
5. **Progress empty states.** Show "No outreach logged yet — log your first email from This week" instead of a funnel of zeros.
