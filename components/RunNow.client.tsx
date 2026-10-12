'use client';
// SPEC §11.1 Run now: confirmation with the estimated Tavily credits, then one step at a time with progress.
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { btn, I } from './ui';

type Step = { done: boolean; processed: number; failed: number; remaining: number; status?: string; error?: string };

export default function RunNow() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    const est = await fetch('/api/run/estimate').then((r) => r.json()).catch(() => null);
    if (!est) { setMsg('Could not reach the server.'); return; }
    if (est.due === 0) { setMsg('Nothing to do: every VC was processed in the last 24 hours.'); return; }
    if (!window.confirm(`Run the pipeline now for ${est.due} VC${est.due === 1 ? '' : 's'}?\n\nUses up to ${est.maxCredits} Tavily credit${est.maxCredits === 1 ? '' : 's'} (${est.budgetLeft} left this month) and a few Gemini calls.`)) return;
    setBusy(true);
    let processed = 0, failed = 0;
    try {
      for (let i = 0; i < 20; i++) {
        setMsg(`Running… ${processed} processed${failed ? `, ${failed} failed` : ''}`);
        const r: Step = await fetch('/api/run/manual', { method: 'POST' }).then((res) => res.json());
        if (r.error) throw new Error(r.error);
        processed += r.processed; failed += r.failed;
        if (r.done) { setMsg(`Done: ${processed} processed${failed ? `, ${failed} failed (kept previous values)` : ''}.`); break; }
        setMsg(`Running… ${processed} processed, ${r.remaining} remaining`);
      }
    } catch (e) {
      setMsg(`Run stopped: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button onClick={run} disabled={busy} className={btn('secondary')} title="Fetch fresh news and LinkedIn posts now">
        <I.bolt width={14} height={14} className={busy ? 'animate-pulse' : ''} />{busy ? 'Running…' : 'Run now'}
      </button>
      {msg && (
        <span aria-live="polite" className="fade-in absolute right-0 top-10 z-30 w-64 rounded-lg bg-surface p-2.5 text-[12.5px] text-ink-2 shadow-lift ring-1 ring-line">
          {msg}
          {!busy && <button type="button" onClick={() => setMsg(null)} className="ml-2 text-ink-3 underline">Dismiss</button>}
        </span>
      )}
    </span>
  );
}
