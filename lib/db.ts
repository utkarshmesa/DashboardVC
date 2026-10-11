import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { serverEnv } from './env';

// Service-role client. Never import from client components (ESLint rule + `server-only` enforce it).
// App code must not call .update()/.upsert() on `vcs`: write via the apply_signals / update_my_fields RPCs.
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (!client) {
    const env = serverEnv(['supabase']);
    client = createClient(env.supabaseUrl, env.supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
