// Calls the deployed /api/spike with the bearer secret and saves the response to out/vercel.json.
// Usage: npm run call-vercel -- https://<deployment>.vercel.app
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadEnv } from '../lib/config.js';

const base = process.argv[2];
if (!base) { console.error('usage: call-vercel <base-url>'); process.exit(1); }
let env;
try { env = loadEnv(['cron']); } catch (e) { console.error(String((e as Error).message)); process.exit(1); }

const unauth = await fetch(`${base}/api/spike`);
console.log(`unauthenticated request -> HTTP ${unauth.status}`);

const t0 = Date.now();
const res = await fetch(`${base}/api/spike`, { headers: { Authorization: `Bearer ${env.cronSecret}` }, signal: AbortSignal.timeout(320_000) });
const wallMs = Date.now() - t0;
const text = await res.text();
console.log(`authenticated request -> HTTP ${res.status} in ${wallMs} ms`);
let body: unknown;
try { body = JSON.parse(text); } catch { body = { raw: text.slice(0, 2000) }; }
mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
writeFileSync(new URL('../out/vercel.json', import.meta.url), JSON.stringify({ http_status: res.status, client_wall_ms: wallMs, unauth_status: unauth.status, body }, null, 2));
const b = body as { runtime?: unknown; spike?: { metrics?: unknown; errors?: string[] }; golden?: { summary?: unknown } };
console.log(JSON.stringify({ runtime: b.runtime, metrics: b.spike?.metrics, golden: b.golden?.summary }, null, 2));
for (const e of b.spike?.errors?.slice(0, 20) ?? []) console.log('  ' + e);
