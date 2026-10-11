// npm run settings -- [--target-space "text"] [--my-product "text"] [--defaults]
// Saves the persona settings (SPEC §2) and resets in-window classified signals to pending so the next run
// reclassifies them. --my-product "" disables competitor flags. The dashboard's /settings page does the same.
import { DEFAULT_MY_PRODUCT, DEFAULT_TARGET_SPACE, SIGNAL_WINDOW_DAYS } from '../lib/config';
import { setSettings } from '../lib/store';

const args = process.argv.slice(2);
const val = (flag: string) => { const i = args.indexOf(flag); return i >= 0 ? (args[i + 1] ?? '') : undefined; };
const next = args.includes('--defaults')
  ? { targetSpace: DEFAULT_TARGET_SPACE, myProduct: DEFAULT_MY_PRODUCT }
  : { targetSpace: val('--target-space'), myProduct: val('--my-product') };
if (next.targetSpace === undefined && next.myProduct === undefined) {
  console.error('usage: npm run settings -- [--target-space "text"] [--my-product "text"] [--defaults]');
  process.exit(1);
}
setSettings(next, SIGNAL_WINDOW_DAYS)
  .then((n) => console.log(`settings saved; ${n} signals reset to pending for reclassification`))
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
