# First-principles review: does the dashboard solve Vikram's problem?

*2026-10-12. Read-only analysis of the live data. No app changes.*

## The problem, restated from first principles

Vikram's real goal is **first meetings with the right investors for a USD 1–3M freight/TMS Seed, using the least founder time.** A cold email gets a meeting when three things line up:

1. **Fit:** the VC invests in this space, stage and cheque size, and hasn't backed a competitor.
2. **A reason to write now:** a specific, recent, relevant hook.
3. **Follow-through:** timely nudges and a clean record of who said what.

SPEC §1 asks for (2) and for knowing whom to skip. The system builds (2) well, but **ignores (1) in its ranking and has no (3).** Fit is the factor that matters most.

## What the live data shows

| Test | Result | Verdict |
|---|---|---|
| Of the 12 **tier-1** VCs (best fit per the research), how many are in "This week"? | **1 of 12.** Prajakt Raut (Caret: supply-chain sector lead, backed Enmovil logistics SaaS and Yantra Packs), Prachi Sinha (Axilor: densest supply-chain portfolio), Harsh Deodhar (led Hexalog's USD 4M supply-chain seed, Jan 2026), Madhukar Sinha (IQ: led the Blitz logistics seed) and 7 more sit in **Quiet** or **Low** | ❌ The best-fit investors are labelled "don't spend energy here" |
| Composition of "This week" | 10 VCs: **9 tier-2, 1 tier-1.** The reasons are enterprise-AI podcasts, a European Series A, a quantum-computing deal and a fintech essay | ❌ It ranks who's in the news, not who to email |
| Competitor safety | The research says **Pentathlon** (Madhukar Bhatia, Gireendra Kasmalkar) backed **SuperProcure, a unified TMS**, and **Aeravti** (Shubham Jhuria) led and re-backed **FreightFox, a freight-procurement TMS**. The dashboard shows them as **Quiet / Low**, with no conflict warning | ❌ Conflicts only count if they appear in the last 30 days' news. A Feb 2026 TMS investment is invisible |
| 10-second test | You can see the answer in 10 s ("Poorvi Vijay, Warm"), but it's the wrong answer for a TMS founder, and all 10 cards carry the same "Warm" label | ⚠️ Fast but misleading |
| Opener quality | Openers are factual and guarded, but tied to off-topic news ("I listened to your SummitUp episode on enterprise AI…"); nothing connects the VC to freight | ⚠️ Safe but weak |
| Follow-ups | Once Vikram emails someone, "Nudge" needs score ≥ REACH **and** the evidence floor, so an awaiting-response VC would essentially never be flagged for a nudge | ❌ No follow-up engine |
| Practical reach-out data | The research has **how to reach** (form link, warm intro needed, email), **cheque size** and **stage** (e.g. IPV's cheques are too small to anchor; Exfinity usually enters at pre-A/A). None of it is shown | ❌ Vikram has to dig for it |
| Enrichment | Runs only for rows 5–7, which never fire, so it has never run live. Decisions rest on headline-only Google News items | ⚠️ Chicken and egg |

**Root cause:** the score is "recent news volume × relevance", and the action table is built on that score alone. The research data, the strongest asset in the project, never feeds a decision.

## Ways to make it significantly better (prioritized)

| # | Improvement | Why it matters to Vikram | Effort |
|---|---|---|---|
| **1** | **Standing conflicts from research and portfolio.** A code rule over the research text (deals naming TMS / freight procurement, checked against `my_product`) plus confirmed portfolio facts. "Check conflict — backed SuperProcure (Feb 2026)" persists beyond 30 days until Vikram dismisses it. | Stops him pitching a VC who funds a direct competitor; today that's invisible for Pentathlon and Aeravti | S |
| **2** | **Fit-first weekly plan.** A code-computed **fit score** per VC: research tier, thesis vs `target_space`, recency of a relevant deal, stage and cheque fit for a USD 1–3M seed, trust. **Priority = fit × (1 + timing boost) × pipeline state.** New action "Reach out — strong fit" for top-fit, not-contacted VCs **even without news**; news becomes a boost and a hook, not a gate. "Quiet" then means *low fit and no news*, never *best fit but no press this month*. | Puts Prajakt, Prachi, Harsh and Madhukar Sinha at the top, where a TMS founder would start | M |
| **3** | **Follow-up engine plus one-click logging.** Status-driven reminders independent of news: awaiting response ≥ 7 days → "Nudge due (day N)"; ≥ 21 days → "Close the loop"; in conversation → "Next step due". Buttons: *Emailed today*, *Replied*, *Meeting booked*, *Passed*, *Snooze 2 weeks*. | Fundraising is won in the follow-ups; today logging needs the edit form and nothing reminds him | S–M |
| **4** | **"How to reach" and deal-breakers on every card.** Approach (pitch-form link, warm intro needed, inbox), cheque range and stage, with code flags such as "cheque too small to anchor", "usually enters at Series A", "wants PMF". | Saves the research digging and avoids dead-end emails | S |
| **5** | **Fit-based openers and a ready-to-send draft.** When there's no recent news, build the opener from **verified research facts** ("You led Hexalog's USD 4M supply-chain seed in January…"), with the same verbatim guard against the research text. Add a Vikram-written pitch line in Settings and assemble subject + opener + pitch + ask in code. No AI claims about his company. | Turns "who" into a sendable email in one click | M |
| **6** | **Focus and cadence.** A "Top 5 this week" strip with a clear order (weekly capacity setting), the rest collapsed; a Monday-morning digest (email or Slack) linking to the dashboard. | Fits the stated 10-second, twice-a-week habit | S (strip) / M (digest) |
| **7** | **Better "why now" signals.** Enrich the top candidates whatever their row, require ≥ adjacent relevance and investment/authored/speaking for a Warm boost, and add **logistics deal discovery**: market funding news in freight/supply-chain mapped to tracked firms (the deferred `docs/later` item; reading it needs your go-ahead). | Today only 2 of 81 accepted signals are core; this is where real hooks come from | M |
| **8** | **Outcome learning.** Record reply and meeting outcomes per VC, plus which hook and opener were used; recalibrate on outcomes instead of the builder's 2-positive ranking review. | Replaces guesswork with Vikram's own response data | M |
| **9** | **Research freshness.** Quarterly re-verification of roles and funds (badge exists); a fund-close or partner-move signal bumps fit and timing. | Fit data decays; partners move | S–M |

### Recommendation

Build **1 + 2 + 3 + 4** together as a "Phase 5: fit-first weekly plan". They share the same data, fix the root cause and the safety gap, and change the answer to "who should Vikram email this week" from *the people in the news* to *the right investors, with a reason, a route and a reminder*. Then **5 and 6** (sendable drafts, digest), then **7 and 8**.

These are product changes to SPEC §1 / §9.5 / §9.6 (ranking and the action table), so they need your decision. Estimated: Phase 5 ≈ one focused session plus a re-evaluation of the ranking review, which should be redone by you, since the current one rests on 2 positives answered by the builder.
