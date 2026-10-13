// npm run demo -- [--clear]   Load (or clear) the labelled demo contact history (DECISIONS #55). Same as Settings → Demo.
import { clearDemoHistory, loadDemoHistory } from '../lib/demo';

(process.argv.includes('--clear') ? clearDemoHistory().then((n) => `cleared ${n}`) : loadDemoHistory().then((r) => `loaded ${r.loaded}; skipped ${r.skipped.join(', ') || 'none'}`))
  .then((m) => console.log(`demo history ${m}`))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
