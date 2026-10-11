// npm run persona -- "new persona text"  → saves settings.company_profile and resets in-window classified
// signals to pending so the next run reclassifies them (SPEC §2). The dashboard /settings page arrives in Phase 3.
import { SIGNAL_WINDOW_DAYS } from '../lib/config';
import { setCompanyProfile } from '../lib/store';

const text = process.argv.slice(2).join(' ');
if (!text.trim()) { console.error('usage: npm run persona -- "persona text"'); process.exit(1); }
setCompanyProfile(text, SIGNAL_WINDOW_DAYS)
  .then((n) => console.log(`persona saved; ${n} signals reset to pending for reclassification`))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
