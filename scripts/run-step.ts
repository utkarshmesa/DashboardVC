// Local manual run: loops steps until the run is done. Usage: npm run step [-- --force]
import { runUntilDone } from '../lib/pipeline';

const force = process.argv.includes('--force');
runUntilDone('manual', { force, maxDurationS: 3600 })
  .then((r) => { console.log(JSON.stringify(r, null, 2)); })
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
