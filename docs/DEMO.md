# 3-minute demo script

Live URL: https://vc-pipeline-zeta.vercel.app. Before you start: be logged in, have the Supabase table editor open on `vcs` in a second tab, and have the README open at "Where AI is used".

**0:00 Login and header.** "Twice a week this runs on its own, Monday and Thursday at 06:00 IST, with a GitHub finisher an hour later in case a run needs more than one function call." Point at last run, next run and Tavily credits this month. Then the two settings: the **target space** drives relevance, and **my product** only drives the competitor check.

**0:30 Follow-ups and new outreach.** "The decision comes first." Follow-ups due (nudge on day 8, close the loop on day 21) sit on top once Vikram starts emailing. Then **New outreach this week**, best fit first: read the top card (Prajakt Raut, strong fit 92). Point at "Why fit" (from verified research), how to reach him (pitch form), cheque and stage, and the one-click *Emailed today*. "News is the hook and a boost; fit decides whom to email. At most 7 new outreach cards a week, one partner per firm."

**1:00 Evidence drawer.** Open the top card.
- The **suggested opener** with Copy, labelled "edit before sending". "Every name and number in it is checked by code against the source text."
- Each signal's points and the AI's labels (about this VC, subject, type, relevance level, confidence).
- Give a junk item a 👎: the score and action change immediately. Remove the 👎 again.
- Expand "Rejected and undated items" to show the plain-English reasons (namesake, outside the window, not a usable signal).

**1:40 Conflicts and the rest.** Open **Check conflict**: "Pentathlon and Aeravti backed TMS companies, so the system holds back all their partners, with the research quote; *Not a conflict* overrides it." Open **Same firm** (one partner per firm) and **Quiet — hold**: "low fit and no news; where not to spend energy."

**2:10 Ownership.** Switch to the Supabase `vcs` table. "Vikram's notes and status are untouched; only these four columns are written, and only through `apply_signals`." Show `npm run test:db` passing: a direct update on `vcs` is refused for the service role.

**2:40 Quality and AI boundary.** Open `/quality` (thumbs precision by signal type). Then the README's "Where AI is used, and where it deliberately isn't" and the evaluation table: acceptance precision 0.95, about-this-VC precision 1.00, golden recall 6/6.
