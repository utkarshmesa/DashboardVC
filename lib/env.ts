import 'server-only';

type Need = 'supabase' | 'gemini' | 'tavily' | 'cron';

// Reads server env; reports missing variable NAMES only, never values.
export function serverEnv(needs: Need[]) {
  const e = process.env;
  const geminiKeys = [e.GEMINI_API_KEY, e.GEMINI_API_KEY_2].filter((k): k is string => !!k);
  const missing: string[] = [];
  const need = (n: Need, ok: boolean, name: string) => { if (needs.includes(n) && !ok) missing.push(name); };
  need('supabase', !!e.SUPABASE_URL, 'SUPABASE_URL');
  need('supabase', !!e.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
  need('gemini', geminiKeys.length > 0, 'GEMINI_API_KEY');
  need('gemini', !!e.GEMINI_MODEL, 'GEMINI_MODEL');
  need('tavily', !!e.TAVILY_API_KEY, 'TAVILY_API_KEY');
  need('cron', !!e.CRON_SECRET, 'CRON_SECRET');
  if (missing.length) throw new Error(`Missing required env: ${missing.join(', ')}`);
  return {
    supabaseUrl: e.SUPABASE_URL ?? '',
    supabaseKey: e.SUPABASE_SERVICE_ROLE_KEY ?? '',
    geminiKeys,
    geminiModel: e.GEMINI_MODEL ?? '',
    tavilyKey: e.TAVILY_API_KEY ?? '',
    tavilyBudget: Number(e.TAVILY_MONTHLY_BUDGET ?? 800),
    cronSecret: e.CRON_SECRET ?? '',
  };
}
