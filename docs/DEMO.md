# 3-minute demo script

Live URL: https://vc-pipeline-zeta.vercel.app. Before you start: be logged in, have the Supabase table editor open on `vcs` in a second tab, and have the README open at "Where AI is used".

**0:00 Login and header.** "Twice a week this runs on its own, Monday and Thursday at 06:00 IST, with a GitHub finisher an hour later in case a run needs more than one function call." Point at last run, next run and Tavily credits this month. Then the two settings: the **target space** drives relevance, and **my product** only drives the competitor check.

**0:30 This week.** "The decision comes first." Read the top card: action badge, score, name and firm, trust badge, the one-line summary, and the newest source date with its link. "Contact actions need more than a high score: at least one recent investment, post or talk squarely in the target space (the evidence floor). Right now nobody on this list has that, so the best they get is Warm."

**1:00 Evidence drawer.** Open the top card.
- The **suggested opener** with Copy, labelled "edit before sending". "Every name and number in it is checked by code against the source text."
- Each signal's points and the AI's labels (about this VC, subject, type, relevance level, confidence).
- Give a junk item a 👎: the score and action change immediately. Remove the 👎 again.
- Expand "Rejected and undated items" to show the plain-English reasons (namesake, outside the window, not a usable signal).

**1:40 Other sections.** Open **Same firm**: "two partners at one firm never both get a contact action." Open **Quiet — hold**: "where not to spend energy." Mention **Check conflict** (empty this week): a VC that backed a direct competitor is held back, with verbatim evidence from the article.

**2:10 Ownership.** Switch to the Supabase `vcs` table. "Vikram's notes and status are untouched; only these four columns are written, and only through `apply_signals`." Show `npm run test:db` passing: a direct update on `vcs` is refused for the service role.

**2:40 Quality and AI boundary.** Open `/quality` (thumbs precision by signal type). Then the README's "Where AI is used, and where it deliberately isn't" and the evaluation table: acceptance precision 0.95, about-this-VC precision 1.00, golden recall 6/6.
