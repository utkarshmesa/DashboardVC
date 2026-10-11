// Constants from the spec. Calibrated values (REACH, WARM, HALF_LIFE_DAYS, MIN_CONFIDENCE) are tuned in Phase 2.
export const SIGNAL_WINDOW_DAYS = 30;
export const MIN_CONFIDENCE = 0.7;
export const MIN_RELEVANCE = 0; // acceptance relevance floor; tuned in Phase 2 on the eval tune split
export const REACH = 50;
export const WARM = 25;
export const HALF_LIFE_DAYS = 20;
export const LOW_RELEVANCE = 0.4;

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

// SPEC §2 default persona; the live value is settings.company_profile.
export const DEFAULT_COMPANY_PROFILE =
  'Freight procurement and transport management (TMS) SaaS for mid-size Indian manufacturers and shippers. ' +
  'Automates carrier sourcing, freight auctions, contract rates, shipment tracking and freight-bill audit. ' +
  'Early revenue, raising a USD 1–3M Seed. Relevant themes: freight, trucking, transport procurement, ' +
  'shipper/carrier software, supply-chain visibility, logistics SaaS for manufacturing. ' +
  'Direct competitors: other TMS / freight-procurement platforms for Indian shippers.';
