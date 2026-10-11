Read CLAUDE.md, then docs/SPEC.md in full. Do not open docs/later/.

Before writing any code, reply with:
1. A one-paragraph summary of what we're building, in your own words.
2. Your plan for Phase 0 only: files you'll create, commands you'll run,
   and anything I must do by hand (logins, keys, deploys).
3. Any contradictions, gaps or risks you see in the spec, and your
   suggested resolution for each.
4. Questions you need answered.
Then stop and wait for my "go".

After I say go, build Phase 0 exactly as SPEC §13 describes:
- All spike code lives in /spike; nothing outside /spike imports it.
- Read keys from .env.local. If a required key is missing, stop and tell me.
  Never print key values, and never commit .env.local.
- Respect the Tavily caps (30 credits locally, 10 on Vercel).
- Run locally for all 50 VCs, then deploy /api/spike to Vercel (protected by
  Bearer CRON_SECRET) and run it on a 10-VC sample.
- Capture golden events with their own "Company" "Firm" queries (no when:)
  and freeze the raw items in /eval/fixtures/.
- Export 60 varied items to /eval/to_label.jsonl, including at least 10
  likely namesake or wrong-person cases.
- Fill in the Phase 0 metrics table for both local and Vercel, plus any
  errors you hit.
Commit with clear messages. Then stop. Do not start Phase 1.
