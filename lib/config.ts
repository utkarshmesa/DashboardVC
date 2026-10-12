// Constants from the spec. Calibrated values (REACH, WARM, HALF_LIFE_DAYS, MIN_CONFIDENCE) are tuned in Phase 2.
export const SIGNAL_WINDOW_DAYS = 30;
export const MIN_CONFIDENCE = 0.7;
export const MIN_RELEVANCE = 0; // acceptance relevance floor; tuned in Phase 2 on the eval tune split
export const REACH = 30;  // calibrated 2026-10-12 (eval/calibration.json; was 50)
export const WARM = 15;   // calibrated 2026-10-12 (was 25)
export const HALF_LIFE_DAYS = 20; // calibrated 2026-10-12 (unchanged)
export const LOW_RELEVANCE = 0.4;
export const RELEVANCE_LEVELS = ['core', 'logistics_non_software', 'adjacent', 'unrelated'] as const;
export type RelevanceLevel = (typeof RELEVANCE_LEVELS)[number];
export const RELEVANCE_VALUE: Record<RelevanceLevel, number> = { core: 1.0, logistics_non_software: 0.7, adjacent: 0.4, unrelated: 0.1 };
export const EVIDENCE_TYPES = ['investment', 'authored', 'speaking'] as const; // evidence floor for contact actions
export const EVIDENCE_MIN_RELEVANCE = 0.6;
export const MIN_CALIBRATED_REACH = 25;

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

// docs/DECISIONS.md: LinkedIn/X are off-limits (SPEC §16); directory sites are profiles, not signals.
export const TAVILY_EXCLUDE_DOMAINS = [
  'linkedin.com', 'x.com', 'twitter.com', 'tracxn.com', 'crunchbase.com', 'angellinx.com', 'cbinsights.com', 'pitchbook.com',
];

// SPEC §2 defaults. Live values: settings.target_space (drives relevance) and settings.my_product (drives
// possible_competitor only; empty disables competitor flags).
export const DEFAULT_TARGET_SPACE =
  'B2B software for logistics and supply chain: transport and freight management, freight procurement, ' +
  'warehouse management, fleet and telematics, supply-chain visibility, last-mile and delivery software, ' +
  'cross-border and customs, procurement, logistics analytics and AI, and logistics fintech.';
export const DEFAULT_MY_PRODUCT =
  'Freight procurement and transport management (TMS) SaaS for mid-size Indian manufacturers and shippers. ' +
  'Automates carrier sourcing, freight auctions, contract rates, shipment tracking and freight-bill audit. ' +
  'Early revenue, raising a USD 1–3M Seed. Relevant themes: freight, trucking, transport procurement, ' +
  'shipper/carrier software, supply-chain visibility, logistics SaaS for manufacturing. ' +
  'Direct competitors: other TMS / freight-procurement platforms for Indian shippers.';
