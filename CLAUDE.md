# CLAUDE.md

Read `docs/SPEC.md` fully before any work. It is the only spec.
Do NOT read or build `docs/later/` unless I explicitly say so.

Current phase: **Phase 4 — Reliability and submission.** (I update this line.)

Non-negotiables (details in SPEC §3 and §16):
- Gemini Flash only for AI. No Anthropic/Claude API in the app.
- The pipeline writes only the 4 system columns of `vcs`, via `apply_signals`. Never `.update()`/`upsert` on `vcs`.
- The LLM never produces URLs, dates, scores or actions.
- Store headline + ≤300-char snippet + link only.
- Stop at the end of each phase and report against its exit check.
- Ask when the spec is silent. Never weaken a test to pass it.
