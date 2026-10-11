// Phase 0 local run: all 50 tracked VCs, Tavily cap 30.
import { mkdirSync, writeFileSync } from 'node:fs';
import { VCS } from '../data/vcs.js';
import { loadEnv } from '../lib/config.js';
import { runSpike } from '../lib/core.js';
import { LOCAL_TAVILY_CAP } from '../lib/sample.js';

let env;
try { env = loadEnv(['gemini', 'tavily']); } catch (e) { console.error(String((e as Error).message)); process.exit(1); }

const result = await runSpike({ vcs: VCS, env, tavilyCap: LOCAL_TAVILY_CAP, log: (m) => console.log(m) });
mkdirSync(new URL('../out/', import.meta.url), { recursive: true });
writeFileSync(new URL('../out/local.json', import.meta.url), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result.metrics, null, 2));
console.log(`errors: ${result.errors.length}`);
for (const e of result.errors.slice(0, 30)) console.log('  ' + e);
