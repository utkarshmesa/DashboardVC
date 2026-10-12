# 3-minute demo script

Live URL: https://vc-pipeline-zeta.vercel.app. Before you start: be logged in, have the Supabase table editor open on `vcs` in a second tab, and have the README open at "Where AI is used".

**0:00 The week in one line.** The headline answers the question Vikram opens the app with: "*6 investors* to reach this week." Point at the four tiles: to reach (with faces), follow-ups due, conflicts to check, and **runway** (good-fit firms left at 7 a week). The pipeline strip shows where all 50 investors stand. Under it are the two settings: the **target space** drives relevance, and **my product** only drives the competitor check. The header shows the last run, the next scheduled run (Mon/Thu 06:00 IST, with a GitHub finisher an hour later) and Tavily credits.

**0:30 A card, top to bottom.** Read the top card (for example Prajakt Raut, fit ring 92). Show the name and firm, then "why fit" (from verified research), the latest activity line (marked *auto*), the route (application form), cheque and stage. The green button follows the route: **Find the application form** with **Copy form answers** (Vikram's own words from Settings), or **Open in Gmail** with the draft filled in. Opening it asks **Sent it?**, and yes logs it with its channel. "Fit decides whom to email; news is the hook and a boost. At most 7 new a week, one partner per firm."

**1:00 Details.** Click **Details**.
- **Draft & opener:** the research opener that the draft uses (every name and number checked by code against the source text), any news hook, and the full draft.
- **Evidence:** each signal's points and the AI's labels (about this VC, subject, relevance, confidence). Give a junk item a thumbs-down: the score and action change immediately. Remove it again. Open "Rejected and undated items" (loaded on demand) to show the plain-English reasons.
- **Notes & status:** inline edit of Vikram's own columns.

**1:40 Conflicts and the rest.** Under **Check before pitching**, open a row: "Pentathlon and Aeravti backed TMS companies, so all their partners are held back, with the research quote. *Not a conflict* overrides it." Scroll to **Rest of the pipeline** (queued, same firm, quiet) and open **Investors**: researched candidates at new firms with one-click *Add to pipeline*, when the runway runs low.

**2:10 Ownership.** Switch to the Supabase `vcs` table. "Vikram's notes and status are untouched; only these four columns are written, and only through `apply_signals`." Show `npm run test:db` passing: a direct update on `vcs` is refused for the service role.

**2:40 Quality and AI boundary.** Open **Quality** (emails logged, reply rate, signal precision from thumbs). Then the README's "Where AI is used, and where it deliberately isn't" and the evaluation table: acceptance precision 0.95, about-this-VC precision 1.00, golden recall 6/6.
