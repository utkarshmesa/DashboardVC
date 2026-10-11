# SETUP (for you, not for Claude Code)

## Before Phase 0

1. **Tools:** Node.js 20 or newer, Git, Claude Code, and the Vercel CLI (`npm i -g vercel`).
2. **Accounts and keys (all free):**
   - Google AI Studio → create an API key. Note which **Flash** model it lists as free; that goes in `GEMINI_MODEL`.
   - Tavily → sign up for the free plan and copy the API key.
   - Vercel → sign up with GitHub, then run `vercel login` in a terminal.
   - GitHub → create an empty **private** repository.
   - Supabase → not needed until Phase 1, but creating the project now saves time.
3. **Repo:**
   ```
   unzip vc-pipeline-starter.zip
   cd vc-pipeline-starter
   git init && git add . && git commit -m "Starter: spec, seed data, tests data"
   git remote add origin <your repo URL> && git push -u origin main
   cp .env.example .env.local      # then fill in GEMINI_*, TAVILY_*, CRON_SECRET
   ```
4. Open Claude Code in the folder and paste the prompt from `START_PROMPT.md`.

## After Phase 0 (your tasks)

1. **Read the metrics report** and bring it back for the decision gate (SPEC §13, Phase 0).
2. **Label items** (about an hour). Claude Code exports `eval/to_label.jsonl`. For each line, add your judgment and save the result as `eval/labels.jsonl`:
   ```json
   {"item_id": 12, "about_this_vc": true, "subject": "firm", "signal_type": "investment", "relevance_level": "core", "competitor": false}
   ```
   - `about_this_vc`: is this really about this person or their firm, not a namesake?
   - `subject`: does it name the person as the actor (`person`) or only the firm (`firm`)?
   - `signal_type`: investment, authored, speaking, press, other, or irrelevant.
   - `relevance_level`: judged against the **target space** setting only: `core`, `logistics_non_software`, `adjacent` or `unrelated`.
   - `competitor`: judged against the **my product** setting only: did they fund a company that the text itself describes as selling substantially the same product?
   Judge only from the headline and snippet shown, exactly as the classifier sees it. Full definitions and examples: `eval/LABELING.md`.

## Before Phase 1

- Create the Supabase project. Run the migration Claude Code writes, then import `seed/vcs_import_master.csv` into the `vcs` table via **Table Editor → Import data from CSV**. That import is deliberately a human step.
- Add `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and to Vercel's project environment variables.

## Each phase

Update the "Current phase" line in `CLAUDE.md`, then tell Claude Code "go".

## Open question for your instructor

The exam says "Do not use Claude API". The app uses only Gemini, but it is built with Claude Code. Confirm that's allowed; the README will include a tooling disclosure either way.
