# Review 2: next improvements, from first principles (2026-10-12)

## What the product is for

Vikram's goal is a closed seed round (USD 1–3M). The output that matters is **first meetings that turn into commitments**. Every meeting comes from five links in a chain, and the weakest link sets the result:

> **enough well-fitting targets → a way in to each → a message worth answering → timely follow-up → moving replies to a term sheet**

What exists, link by link:

| Link | What exists | Where it is weak (live data, 2026-10-12) |
|---|---|---|
| 1. Targets | 50 researched VCs, fit-scored, one partner per firm, 7 new outreach a week | **21 viable firms not yet contacted.** At 7 a week the list **runs out in about 3 weeks** (early November) |
| 2. A way in | A "Reach via" line from research | **Every route is cold.** 18 of 50 are forms or contact pages; 12 mention an intro but name no person. Nothing finds Vikram's own warm paths, even though warm intros are the best way to get a reply |
| 3. Message | Research opener, LinkedIn/news hook, code-assembled draft | Drafts assume email, but **18 VCs want a form** (pitch fields, deck upload). There's no deck link and no recipient address |
| 4. Follow-up | Nudge, Close the loop, Next step; one-click logging; outcome funnel | Works only if Vikram logs every email by hand. **0 events logged so far.** If logging is skipped, the follow-ups drift away from reality |
| 5. Reply → term sheet | Status stops at "in conversation" | **No stages** (first call → partner meeting → diligence → term sheet), no next-step dates, no view of committed amount against the round |

Signals (news + LinkedIn, 155 accepted) mostly decide **timing and hooks**, not who to contact. Of 92 LinkedIn posts, 1 was about logistics. More data sources would add little, because the weak links are 1, 2 and 5.

## Recommended, in order

### 1. Warm-intro paths from Vikram's LinkedIn connections (link 2): biggest lever
- **What Vikram does:** downloads his own data from LinkedIn (Settings → Data privacy → Get a copy of your data → Connections) and uploads `Connections.csv` once in Settings. It's his data, so this is fully allowed.
- **What code does (no AI):** matches the file against:
  1. the tracked VCs themselves: an **exact** match on the profile URL, using the handles built in 5c. A first-degree connection means "message on LinkedIn, not a cold form";
  2. other people at the same firms (associates and analysts who can pass him to the partner);
  3. founders and execs at companies named in each VC's research deals (Enmovil, Yantra Packs, CargoFL, Locus…): **portfolio-founder intros** are the strongest kind.
- **Card shows:** "Warm path: you know Ravi K., co-founder of Enmovil (Caret portfolio). Ask for an intro." The draft becomes an intro-request note to Ravi. A known warm path ranks the card higher.
- **Effort:** medium. **Blocker:** Vikram's export, one action; the CSV stays in a deny-all table and can be deleted.

### 2. Pipeline runway: next-best investors from existing research (link 1)
- 49 researched investors are already in `seed/vc_profile_seed.csv` but not tracked, covering **22 firms not tracked at all**: Mela Ventures (B2B-only, USD 2–3M cheques), Arkam (logistics, USD 1–5M lead), Jungle Ventures, Rajiv Srivatsa at Antler, and others. They all score just under "good" (37–47).
- **Build:**
  - a **runway line** on the dashboard ("At 7 a week, strong and good-fit targets last about 3 more weeks");
  - a **"Next best investors" list** on Settings with fit, why-fit and a one-click **Add to pipeline**, so Vikram decides who joins;
  - the same "Add" path for any new VC he enters (name, firm, LinkedIn).
- **Effort:** small to medium. The data and fit scoring already exist.

### 3. Form-aware outreach and lighter logging (links 3–4)
- If the research route is a form, the card shows **"Apply via form ↗"** and copy-ready form fields instead of an email: a one-line pitch, a 3-line pitch and a deck link. A deck link goes into Settings.
- For email routes, **"Open in Gmail"** opens a compose window with the subject and body filled in. Vikram confirms "Sent?" afterwards, which logs it.
- **Why:** removes copy-paste friction and keeps the follow-up engine accurate. **Effort:** small.

### 4. Conversation stages and round tracker (link 5): build before the first replies arrive
- Stages after "in conversation": first call → partner meeting → diligence → term sheet → committed / passed. Each has a next-step date and an optional amount.
- **Dashboard:** "Round: USD 0.4M soft-committed of 1–3M". Overdue next steps rise to the top of This week.
- **Why:** once replies come in, the valuable work moves here, and the current build has no view of it. **Effort:** medium. **Timing:** ready within about 2 weeks of the first emails.

### 5. A one-week pilot (not a build)
- Vikram uses the dashboard as intended for one week: sends the 5–7 committed emails, logs them, and fills Settings with his real company name and traction.
- **Success means:** 7 emails logged, every due nudge sent on time, at least 1 reply. After about 20 logged emails, the outcome funnel supports recalibrating on real replies instead of builder labels.

## Not recommended now

- **More signal sources (X, more news queries):** signals don't decide who to contact, and LinkedIn yielded 1 logistics post out of 92.
- **More ranking tuning:** there's no outcome data yet; wait for the pilot's logged replies.
- **Deal discovery and automated research refresh:** disproved or risky (`docs/PLAN-NEXT.md`).
- **A Gmail integration that reads the inbox:** an OAuth scope on personal mail is a privacy and complexity cost. "Open in Gmail" plus a Sent? confirmation gets most of the benefit.

## Suggested order

**3 → 2 → 1 → 4**, with the pilot running alongside:
- 3 and 2 are small and help the very first week.
- 1 is the biggest lever but needs Vikram's export.
- 4 must be ready by the time replies arrive.
