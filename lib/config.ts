// Constants from the spec. Calibrated values (REACH, WARM, HALF_LIFE_DAYS, MIN_CONFIDENCE) are tuned in Phase 2.
export const SIGNAL_WINDOW_DAYS = 30;
export const MIN_CONFIDENCE = 0.7;
export const MIN_RELEVANCE = 0; // acceptance relevance floor; tuned in Phase 2 on the eval tune split
export const REACH = 30;  // calibrated 2026-10-12 (eval/calibration.json; was 50)
export const WARM = 15;   // calibrated 2026-10-12 (was 25)
export const HALF_LIFE_DAYS = 20; // calibrated 2026-10-12 (unchanged)
export const RELEVANCE_LEVELS = ['core', 'logistics_non_software', 'adjacent', 'unrelated'] as const;
export type RelevanceLevel = (typeof RELEVANCE_LEVELS)[number];
// Plan V2 (DECISIONS #55): only logistics counts as "thinking about this space"; off-topic activity barely moves the score.
export const RELEVANCE_VALUE: Record<RelevanceLevel, number> = { core: 1.0, logistics_non_software: 0.8, adjacent: 0.1, unrelated: 0 };
// The problem's signal: something they wrote, said in an interview, invested in, or appeared at (press = said in an interview).
export const EVIDENCE_TYPES = ['investment', 'authored', 'speaking', 'press'] as const;
export const EVIDENCE_MIN_RELEVANCE = 0.6;
export const MIN_CALIBRATED_REACH = 25;
// Phase 5 fit-first plan (docs/REVIEW.md, SPEC §9.6 amended)
export const FIT_STRONG = 70;
export const FIT_GOOD = 50;
export const OUTREACH_PER_WEEK = 7;  // new-outreach cards in This week; the rest queue as "Good fit"
export const NUDGE_AFTER_DAYS = 8;   // awaiting a reply this long → Nudge due
export const CLOSE_LOOP_DAYS = 21;   // awaiting a reply this long → Close the loop
export const NEXT_STEP_DAYS = 10;    // in conversation, untouched this long → Next step due
export const REVERIFY_ROLE_DAYS = 180; // SPEC §11.6 "Re-verify role" badge

export const TYPE_WEIGHT = { investment: 1.0, authored: 0.8, speaking: 0.7, press: 0.5, other: 0.3 } as const;
export const SUBJECT_WEIGHT = { person: 1.0, firm: 0.7 } as const;

export const BATCH_SIZE = 10;
export const COLLECT_CONCURRENCY = 3;
export const CLASSIFY_CAP = 40;
export const ENRICH_PER_RUN = 10;
export const FETCH_TIMEOUT_MS = 10_000;
export const GOOGLE_NEWS_SPACING_MS = 300;
export const SNIPPET_MAX = 300;
export const SNIPPET_MIN_EXTRA_CHARS = 20;
export const LOCK_STALE_MINUTES = 10;
export const CRON_MAX_DURATION_S = 300; // Vercel Hobby maximum
export const LINKEDIN_RECHECK_DAYS = 6; // LinkedIn search at most weekly per VC (Mon run; the Thu run skips)

// Excluded from the news fallback. X stays off-limits; LinkedIn posts have their own author-filtered collector
// (lib/linkedin.ts, DECISIONS #45); directory sites are profiles, not signals.
export const TAVILY_EXCLUDE_DOMAINS = [
  'linkedin.com', 'x.com', 'twitter.com', 'tracxn.com', 'crunchbase.com', 'angellinx.com', 'cbinsights.com', 'pitchbook.com',
];

// SPEC §2 defaults. Live values: settings.target_space (drives relevance) and settings.my_product (drives
// possible_competitor only; empty disables competitor flags).
// Only what the problem statement says about Vikram: a Seed-stage B2B logistics SaaS founder (DECISIONS #55).
export const DEFAULT_TARGET_SPACE =
  'B2B logistics and supply-chain technology: software that moves, stores, tracks or buys goods (transport and freight, ' +
  'warehousing, fleet, supply-chain visibility, procurement, last-mile delivery, trade and customs, logistics analytics), ' +
  'and logistics companies themselves.';
// The problem doesn't name his product category, so competitor checks are off until he describes it in Settings.
export const DEFAULT_MY_PRODUCT = '';
