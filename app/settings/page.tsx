// SPEC §2 / §11.7: edit the two persona settings. Saving resets in-window classified signals to pending,
// so the next run reclassifies them against the new settings.
import AppHeader from '@/components/AppHeader';
import { btn, helpCls, I, inputCls, labelCls, PageTitle, SectionTitle } from '@/components/ui';
import { redirect } from 'next/navigation';
import { SIGNAL_WINDOW_DAYS } from '@/lib/config';
import { clearDemoHistory, demoActive, loadDemoHistory } from '@/lib/demo';
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
  await saveDraftSettings({ pitch: String(formData.get('my_pitch') ?? ''), senderName: String(formData.get('sender_name') ?? ''), ask: String(formData.get('outreach_ask') ?? ''), deckUrl: String(formData.get('deck_url') ?? ''), roundSize: String(formData.get('round_size') ?? '') });
  redirect('/settings?draft=1');
}

async function loadDemo() {
  'use server';
  const r = await loadDemoHistory();
  redirect(`/settings?demo=loaded-${r.loaded}#demo`);
}

async function clearDemo() {
  'use server';
  const n = await clearDemoHistory();
  redirect(`/settings?demo=cleared-${n}#demo`);
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string; draft?: string; demo?: string }> }) {
  const [{ saved, error, draft: draftSaved, demo: demoMsg }, persona, draft, demoOn] = await Promise.all([searchParams, loadPersona(), loadDraftSettings(), demoActive()]);
  return (
    <>
      <AppHeader active="/settings" />
      <main id="main" tabIndex={-1} className="mx-auto max-w-[880px] px-4 pb-28 pt-12 outline-none sm:px-8">
        <PageTitle eyebrow="04 / Settings · Persona" title="Tune it to your round." sub="The problem statement says only that you are raising a Seed round for a B2B logistics SaaS, so that is all the pipeline assumes. Add your product and round size here to sharpen drafts, cheque notes and competitor checks. Nothing here is written by AI." />

        <section data-reveal="" className="mb-10 border border-line bg-surface p-6">
          <SectionTitle index="§1" tone="accent">Your drafts and pitch forms</SectionTitle>
          <p className="-mt-1 mb-5 text-[13px] text-ink-3">Your own words, assembled by code around each investor&apos;s opener. Saving never re-scores anything.</p>
          {draftSaved && <p role="status" className="fade-in mb-5 flex items-center gap-2 border-l-2 border-accent-text bg-accent-soft px-4 py-2.5 text-[13.5px] text-accent-text"><I.check width={16} height={16} />Draft settings saved.</p>}
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
            <label className={labelCls}>Round size <span className="font-normal text-ink-3">(optional)</span>
              <span className={helpCls}>For example &quot;USD 2M&quot;. Used in form answers and to flag cheques too small to lead your round. Leave empty if undecided.</span>
              <input name="round_size" defaultValue={draft.roundSize} maxLength={40} placeholder="USD 2M" className={inputCls} />
            </label>
            <label className={labelCls}>Deck link
              <span className={helpCls}>A view-only link (DocSend, Google Drive, Notion). Added to drafts and form answers. http(s) links only.</span>
              <input name="deck_url" type="url" defaultValue={draft.deckUrl} maxLength={500} placeholder="https://" className={inputCls} />
            </label>
            <div><button type="submit" className={btn('primary', 'md')}>Save draft settings</button></div>
          </form>
        </section>

        <section data-reveal="" className="border border-line bg-surface p-6">
          <SectionTitle index="§2" tone="info">What the pipeline looks for</SectionTitle>
          <p className="-mt-1 mb-5 text-[13px] text-ink-3">Changing either one re-checks the last {SIGNAL_WINDOW_DAYS} days of signals on the next run.</p>
          {saved !== undefined && <p role="status" className="fade-in mb-5 flex items-center gap-2 border-l-2 border-accent-text bg-accent-soft px-4 py-2.5 text-[13.5px] text-accent-text"><I.check width={16} height={16} />Saved. {saved} recent signal{saved === '1' ? '' : 's'} will be re-checked on the next run.</p>}
          {error && <p role="alert" className="mb-5 border-l-2 border-danger bg-danger-soft px-4 py-2.5 text-[13.5px] text-danger">Target space can&apos;t be empty.</p>}
          <form action={save} className="grid gap-5">
            <label className={labelCls}>Target space
              <span className={helpCls}>Decides relevance. Only activity in this space (core, or a logistics company) counts as a signal worth reaching out on.</span>
              <textarea name="target_space" defaultValue={persona.targetSpace} rows={4} required maxLength={2000} className={inputCls} />
            </label>
            <label className={labelCls}>My product
              <span className={helpCls}>Describe what you sell (e.g. &quot;TMS for shippers&quot;, &quot;WMS for 3PLs&quot;) to switch on checks for investors who backed a competitor. Empty (the default) means no competitor checks: a logistics investment then counts in the investor&apos;s favour.</span>
              <textarea name="my_product" defaultValue={persona.myProduct} rows={5} maxLength={2000} className={inputCls} />
            </label>
            <div><button type="submit" className={btn('secondary', 'md')}>Save and re-check</button></div>
          </form>
        </section>

        <section id="demo" data-reveal="" className="mt-10 scroll-mt-28 border border-line bg-surface p-6">
          <SectionTitle index="§3" tone="warn">Demo contact history</SectionTitle>
          <p className="-mt-1 mb-4 text-[13px] leading-relaxed text-ink-3">
            The problem&apos;s Vikram is two months in and waiting on replies, but he is fictional, so that history can&apos;t come from real use. Loading the demo
            writes example statuses, contact dates and notes for 11 investors so follow-ups and progress are visible. Every demo row is labelled DEMO, every note starts with
            &quot;[demo]&quot; and says it is not a real interaction, and rows with your own notes are never touched. Clearing it restores those rows.
          </p>
          {demoMsg && <p role="status" className="fade-in mb-4 flex items-center gap-2 border-l-2 border-accent-text bg-accent-soft px-4 py-2.5 text-[13.5px] text-accent-text"><I.check width={16} height={16} />{demoMsg.startsWith('loaded') ? `Demo history loaded for ${demoMsg.split('-')[1]} investors.` : `Demo history cleared from ${demoMsg.split('-')[1]} investors.`}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <form action={loadDemo}><button type="submit" className={btn('secondary', 'md')}>{demoOn ? 'Reload demo history' : 'Load demo history'}</button></form>
            {demoOn && <form action={clearDemo}><button type="submit" className={btn('danger', 'md')}>Clear demo history</button></form>}
            <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-3">{demoOn ? 'Demo history is loaded' : 'No demo history'}</span>
          </div>
        </section>
      </main>
    </>
  );
}
