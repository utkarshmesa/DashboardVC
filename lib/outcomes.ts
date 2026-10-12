import 'server-only';
import { db } from './db';
import { fitScore, type Research } from './fit';
import { computeFunnel, type OutreachEvent } from './funnel';
import { loadPersona } from './store';

// Records an outreach event with the context needed to learn from it later (fit label, whether a news hook existed,
// the action shown at the time). Never throws: logging must not break the user's action.
export async function logEvent(vcId: string, event: string, statusBefore: string | null, statusAfter: string | null) {
  try {
    const [vc, prof, hook, persona] = await Promise.all([
      db().from('vcs').select('thesis, recommended_action').eq('id', vcId).single(),
      db().from('vc_profile').select('tier, trust, research').eq('vc_id', vcId).maybeSingle(),
      db().from('signals').select('id', { count: 'exact', head: true }).eq('vc_id', vcId).eq('status', 'accepted').not('hook', 'is', null),
      loadPersona(),
    ]);
    const fit = fitScore({ tier: prof.data?.tier ?? null, trust: prof.data?.trust ?? null, thesis: vc.data?.thesis ?? null, research: (prof.data?.research ?? null) as Research | null }, persona.targetSpace);
    await db().from('outreach_events').insert({
      vc_id: vcId, event, status_before: statusBefore, status_after: statusAfter, fit_label: fit.label, had_hook: (hook.count ?? 0) > 0, action: vc.data?.recommended_action ?? null,
    });
  } catch (e) {
    console.error('logEvent failed', e);
  }
}

export async function loadFunnel() {
  const r = await db().from('outreach_events').select('vc_id, event, fit_label, had_hook, at').order('at');
  if (r.error) throw new Error(r.error.message);
  return computeFunnel((r.data ?? []) as OutreachEvent[]);
}
