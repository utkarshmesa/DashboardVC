// npm run openers — (re)generate research-grounded openers for this week's cards (normally done at the end of each run).
import { serverEnv } from '../lib/env';
import { refreshOpeners } from '../lib/runner';
import { supabaseStore } from '../lib/store';

const env = serverEnv(['supabase', 'gemini']);
refreshOpeners(supabaseStore, { keys: env.geminiKeys, model: env.geminiModel })
  .then((r) => { console.log(`openers generated: ${r.generated} (Gemini calls: ${r.calls})`); for (const e of r.errors) console.log('  ' + e); })
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
