// Runs the ownership integration test against the Supabase project in .env.local.
import { spawnSync } from 'node:child_process';
const r = spawnSync(process.execPath, ['--env-file=.env.local', 'node_modules/vitest/vitest.mjs', 'run', 'tests/ownership.test.ts'], {
  stdio: 'inherit', env: { ...process.env, RUN_DB_TESTS: '1' },
});
process.exit(r.status ?? 1);
