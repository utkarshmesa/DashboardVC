// npm run persona -- "new persona text"  (or --default)  → saves settings.company_profile and resets in-window classified
// signals to pending so the next run reclassifies them (SPEC §2). The dashboard /settings page arrives in Phase 3.
import { DEFAULT_COMPANY_PROFILE, SIGNAL_WINDOW_DAYS } from '../lib/config';
import { setCompanyProfile } from '../lib/store';

// --default re-saves the SPEC §2 persona (also used to reclassify after a classifier change).
const text = process.argv.includes('--default') ? DEFAULT_COMPANY_PROFILE : process.argv.slice(2).join(' ');
if (!text.trim()) { console.error('usage: npm run persona -- "persona text"'); process.exit(1); }
setCompanyProfile(text, SIGNAL_WINDOW_DAYS)
  .then((n) => console.log(`persona saved; ${n} signals reset to pending for reclassification`))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
