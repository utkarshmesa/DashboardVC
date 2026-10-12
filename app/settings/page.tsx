// SPEC §2 / §11.7: edit the two persona settings. Saving resets in-window classified signals to pending,
// so the next run reclassifies them against the new settings.
import AppHeader from '@/components/AppHeader';
import { btn, Card, helpCls, I, inputCls, labelCls, PageTitle, SectionTitle } from '@/components/ui';
import { redirect } from 'next/navigation';
import { SIGNAL_WINDOW_DAYS } from '@/lib/config';
import { loadDraftSettings, loadPersona, saveDraftSettings, setSettings } from '@/lib/store';
import { DEFAULT_ASK } from '@/lib/opener';

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

async function saveDraft(formData: FormData) {
  'use server';
  await saveDraftSettings({ pitch: String(formData.get('my_pitch') ?? ''), senderName: String(formData.get('sender_name') ?? ''), ask: String(formData.get('outreach_ask') ?? ''), deckUrl: String(formData.get('deck_url') ?? '') });
  redirect('/settings?draft=1');
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; draft?: string }> }) {
  const [{ saved, error, draft: draftSaved }, persona, draft] = await Promise.all([searchParams, loadPersona(), loadDraftSettings()]);
  return (
    <>
      <AppHeader active="/settings" />
      <main id="main" tabIndex={-1} className="mx-auto max-w-3xl px-4 pb-24 pt-8 outline-none sm:px-6">
        <PageTitle eyebrow="Settings" title="Tune it to your round." sub="Your company and pitch shape what the pipeline looks for and what your drafts say. Nothing here is written by AI." />

        <Card className="mb-8 p-6">
          <SectionTitle tone="accent">Your drafts and pitch forms</SectionTitle>
          <p className="-mt-1 mb-5 text-[13px] text-ink-3">Your own words, assembled by code around each investor&apos;s opener. Saving never re-scores anything.</p>
          {draftSaved && <p role="status" className="fade-in mb-5 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-2.5 text-[13.5px] text-accent-text"><I.check width={16} height={16} />Draft settings saved.</p>}
          <form action={saveDraft} className="grid gap-5">
            <label className={labelCls}>Your pitch <span className="font-normal text-ink-3">(1–2 sentences)</span>
              <span className={helpCls}>The first sentence becomes the email subject and the one-line pitch on forms. Name the company and add a traction number if you can.</span>
              <textarea name="my_pitch" defaultValue={draft.pitch} rows={3} maxLength={600} placeholder="What you build, your traction, and the round you are raising." className={inputCls} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className={labelCls}>Your ask
                <span className={helpCls}>The closing line of every draft.</span>
                <input name="outreach_ask" defaultValue={draft.ask} maxLength={300} placeholder={DEFAULT_ASK} className={inputCls} />
              </label>
              <label className={labelCls}>Sign-off name
                <span className={helpCls}>How you sign emails and forms.</span>
                <input name="sender_name" defaultValue={draft.senderName} maxLength={80} placeholder="Vikram" className={inputCls} />
              </label>
            </div>
            <label className={labelCls}>Deck link
              <span className={helpCls}>A view-only link (DocSend, Google Drive, Notion). Added to drafts and form answers. http(s) links only.</span>
              <input name="deck_url" type="url" defaultValue={draft.deckUrl} maxLength={500} placeholder="https://" className={inputCls} />
            </label>
            <div><button type="submit" className={btn('primary', 'md')}>Save draft settings</button></div>
          </form>
        </Card>

        <Card className="p-6">
          <SectionTitle tone="info">What the pipeline looks for</SectionTitle>
          <p className="-mt-1 mb-5 text-[13px] text-ink-3">Changing either one re-checks the last {SIGNAL_WINDOW_DAYS} days of signals on the next run.</p>
          {saved !== undefined && <p role="status" className="fade-in mb-5 flex items-center gap-2 rounded-xl bg-accent-soft px-4 py-2.5 text-[13.5px] text-accent-text"><I.check width={16} height={16} />Saved. {saved} recent signal{saved === '1' ? '' : 's'} will be re-checked on the next run.</p>}
          {error && <p role="alert" className="mb-5 rounded-xl bg-danger-soft px-4 py-2.5 text-[13.5px] text-danger">Target space can&apos;t be empty.</p>}
          <form action={save} className="grid gap-5">
            <label className={labelCls}>Target space
              <span className={helpCls}>Decides relevance: core, logistics (non-software), adjacent or unrelated.</span>
              <textarea name="target_space" defaultValue={persona.targetSpace} rows={4} required maxLength={2000} className={inputCls} />
            </label>
            <label className={labelCls}>My product
              <span className={helpCls}>Used only to spot investors who backed a competitor. Leave empty to turn competitor checks off.</span>
              <textarea name="my_product" defaultValue={persona.myProduct} rows={5} maxLength={2000} className={inputCls} />
            </label>
            <div><button type="submit" className={btn('secondary', 'md')}>Save and re-check</button></div>
          </form>
        </Card>
      </main>
    </>
  );
}
