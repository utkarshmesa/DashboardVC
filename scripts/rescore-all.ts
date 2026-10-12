// npm run rescore — recompute all scores and actions from stored signals with the current constants, then firm dedupe.
import { db } from '../lib/db';
import { rescoreAll } from '../lib/runner';
import { supabaseStore } from '../lib/store';
import type { FetchStatus } from '../lib/types';

async function main() {
  const r = await db().from('vc_profile').select('vc_id, last_fetch_status');
  if (r.error) throw new Error(r.error.message);
  const status = new Map((r.data as { vc_id: string; last_fetch_status: FetchStatus | null }[]).map((p) => [p.vc_id, p.last_fetch_status ?? 'ok']));
  const out = await rescoreAll(supabaseStore, [...status.keys()], (id) => status.get(id) ?? 'ok');
  console.log(`rescored ${out.rescored} VCs; firm dedupe changed ${out.deduped}`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
