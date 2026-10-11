// SPEC §2 / §11.7: edit the two persona settings. Saving resets in-window classified signals to pending,
// so the next run reclassifies them against the new settings.
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SIGNAL_WINDOW_DAYS } from '@/lib/config';
import { loadPersona, setSettings } from '@/lib/store';

export const dynamic = 'force-dynamic';

async function save(formData: FormData) {
  'use server';
  const targetSpace = String(formData.get('target_space') ?? '');
  const myProduct = String(formData.get('my_product') ?? '');
  if (!targetSpace.trim()) redirect('/settings?error=target');
  const current = await loadPersona();
  const changes = {
    targetSpace: targetSpace.trim() !== current.targetSpace ? targetSpace : undefined,
    myProduct: myProduct.trim() !== current.myProduct ? myProduct : undefined,
  };
  const reset = await setSettings(changes, SIGNAL_WINDOW_DAYS);
  redirect(`/settings?saved=${reset}`);
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [{ saved, error }, persona] = await Promise.all([searchParams, loadPersona()]);
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <p className="mb-4 text-sm"><Link href="/" className="text-neutral-500 hover:underline">← Dashboard</Link></p>
      <h1 className="mb-6 text-lg font-semibold">Settings</h1>
      {saved !== undefined && (
        <p className="mb-4 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
          Saved. {saved} recent signal{saved === '1' ? '' : 's'} will be reclassified on the next run.
        </p>
      )}
      {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-800">Target space cannot be empty.</p>}
      <form action={save} className="space-y-6">
        <label className="block">
          <span className="block text-sm font-medium">Target space</span>
          <span className="mb-2 block text-xs text-neutral-500">Drives relevance: core, logistics (non-software), adjacent or unrelated.</span>
          <textarea name="target_space" defaultValue={persona.targetSpace} rows={4} required
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">My product</span>
          <span className="mb-2 block text-xs text-neutral-500">Drives the competitor check only. Leave empty to turn competitor flags off.</span>
          <textarea name="my_product" defaultValue={persona.myProduct} rows={5}
            className="w-full rounded border border-neutral-300 px-3 py-2 text-sm" />
        </label>
        <p className="text-xs text-neutral-500">Changing either setting queues the last {SIGNAL_WINDOW_DAYS} days of classified signals for reclassification.</p>
        <button type="submit" className="rounded bg-neutral-900 px-4 py-2 text-sm text-white">Save</button>
      </form>
    </main>
  );
}
