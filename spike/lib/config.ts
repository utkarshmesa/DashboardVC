export const SIGNAL_WINDOW_DAYS = 30;
export const MIN_CONFIDENCE = 0.7;
export const BATCH_SIZE = 10;
export const COLLECT_CONCURRENCY = 3;
export const CLASSIFY_CAP = 40;
export const FETCH_TIMEOUT_MS = 10_000;
export const GOOGLE_NEWS_SPACING_MS = 300;
export const SNIPPET_MAX = 300;
export const SNIPPET_MIN_EXTRA_CHARS = 20;

// SPEC §2 default persona. In Phase 1 this lives in settings.company_profile.
export const COMPANY_PROFILE =
  'Freight procurement and transport management (TMS) SaaS for mid-size Indian manufacturers and shippers. ' +
  'Automates carrier sourcing, freight auctions, contract rates, shipment tracking and freight-bill audit. ' +
  'Early revenue, raising a USD 1–3M Seed. Relevant themes: freight, trucking, transport procurement, ' +
  'shipper/carrier software, supply-chain visibility, logistics SaaS for manufacturing. ' +
  'Direct competitors: other TMS / freight-procurement platforms for Indian shippers.';

export type Env = {
  geminiKeys: string[];
  geminiModel: string;
  tavilyKey: string;
  cronSecret: string;
};

// Reports missing variable names only, never values.
export function loadEnv(required: Array<'gemini' | 'tavily' | 'cron'>): Env {
  const e = process.env;
  const geminiKeys = [e.GEMINI_API_KEY, e.GEMINI_API_KEY_2, e.GEMINI_API_KEY_3].filter((k): k is string => !!k);
  const missing: string[] = [];
  if (required.includes('gemini')) {
    if (!geminiKeys.length) missing.push('GEMINI_API_KEY');
    if (!e.GEMINI_MODEL) missing.push('GEMINI_MODEL');
  }
  if (required.includes('tavily') && !e.TAVILY_API_KEY) missing.push('TAVILY_API_KEY');
  if (required.includes('cron') && !e.CRON_SECRET) missing.push('CRON_SECRET');
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`);
  return {
    geminiKeys,
    geminiModel: e.GEMINI_MODEL ?? '',
    tavilyKey: e.TAVILY_API_KEY ?? '',
    cronSecret: e.CRON_SECRET ?? '',
  };
}
