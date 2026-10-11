// Runs the recall test in live or record mode against Gemini using .env.local (see tests/recall.test.ts).
import { spawnSync } from 'node:child_process';
const mode = process.argv[2] === 'record' ? 'record' : 'live';
const r = spawnSync(process.execPath, ['--env-file=.env.local', 'node_modules/vitest/vitest.mjs', 'run', 'tests/recall.test.ts'], {
  stdio: 'inherit', env: { ...process.env, RECALL_MODE: mode },
});
process.exit(r.status ?? 1);
