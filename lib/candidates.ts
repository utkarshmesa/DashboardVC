import 'server-only';
// REVIEW-2 item 2: pipeline runway. Researched-but-untracked investors (vc_candidates, imported from the seed research)
// that Vikram can add with one click. Adding writes only Vikram-owned columns of vcs (name, firm, status), exactly as
// a table-editor insert would; the system columns stay empty until the pipeline's apply_signals fills them.
import { db } from './db';
import { fitScore, type Research } from './fit';
import { rescoreVc } from './pipeline';
import { loadPersona, supabaseStore } from './store';

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');

export type CandidateView = {
  id: number; name: string; firm: string; fit: number; label: string; flags: string[]; whyFit: string | null;
  cheque: string | null; stage: string | null; newFirm: boolean; trackedAtFirm: number;
};

export async function loadCandidates(): Promise<CandidateView[]> {
  const [c, v, persona] = await Promise.all([
    db().from('vc_candidates').select('id, name, firm, tier, trust, research').is('dismissed_at', null).is('added_vc_id', null),
    db().from('vcs').select('name, firm'),
    loadPersona(),
  ]);
  if (c.error) throw new Error(c.error.message);
  const tracked = (v.data ?? []) as { name: string; firm: string }[];
  return ((c.data ?? []) as { id: number; name: string; firm: string; tier: number | null; trust: string | null; research: Research | null }[])
    .filter((x) => !tracked.some((t) => norm(t.name) === norm(x.name))) // added another way since import
    .map((x) => {
      const f = fitScore({ tier: x.tier, trust: x.trust, thesis: null, research: x.research }, persona.targetSpace);
      const atFirm = tracked.filter((t) => norm(t.firm) === norm(x.firm)).length;
      return {
        id: x.id, name: x.name, firm: x.firm, fit: f.score, label: f.label, flags: f.flags,
        whyFit: x.research?.fit_reason ? String(x.research.fit_reason) : null,
        cheque: x.research?.first_cheque ? String(x.research.first_cheque) : null,
        stage: x.research?.stage_focus ? String(x.research.stage_focus) : null,
        newFirm: atFirm === 0, trackedAtFirm: atFirm,
      };
    })
    // New firms first (they add a fresh outreach slot; a second partner at a tracked firm routes via the first), then fit.
    .sort((a, b) => Number(b.newFirm) - Number(a.newFirm) || b.fit - a.fit || a.name.localeCompare(b.name));
}

async function insertVc(name: string, firm: string): Promise<string> {
  const exists = ((await db().from('vcs').select('id, name, firm')).data ?? []).find((t) => norm(t.name) === norm(name) && norm(t.firm) === norm(firm));
  if (exists) return exists.id as string;
  const ins = await db().from('vcs').insert({ name: name.trim(), firm: firm.trim(), status: 'not_contacted' }).select('id').single();
  if (ins.error) throw new Error(`add VC: ${ins.error.message}`);
  await supabaseStore.ensureProfiles(); // default profile with firm_key matched by name/alias
  return ins.data.id as string;
}

export async function addCandidate(id: number): Promise<string> {
  const c = await db().from('vc_candidates').select('*').eq('id', id).single();
  if (c.error) throw new Error(c.error.message);
  const vcId = await insertVc(c.data.name, c.data.firm);
  const p = await db().from('vc_profile').update({
    aliases: c.data.aliases ?? [], ambiguous_name: !!c.data.ambiguous_name, tier: c.data.tier, trust: c.data.trust,
    research: c.data.research ?? {}, research_as_of: c.data.research_as_of, owner_added_at: new Date().toISOString(),
  }).eq('vc_id', vcId);
  if (p.error) throw new Error(p.error.message);
  await db().from('vc_candidates').update({ added_vc_id: vcId }).eq('id', id);
  await rescoreVc(vcId); // fit-based action now; news and LinkedIn arrive with the next run
  return vcId;
}

export async function dismissCandidate(id: number) {
  const r = await db().from('vc_candidates').update({ dismissed_at: new Date().toISOString() }).eq('id', id);
  if (r.error) throw new Error(r.error.message);
}

// Any investor Vikram names himself. No research yet, so fit is weak until he (or a research pass) adds it.
export async function addManualVc(d: { name: string; firm: string; linkedinUrl: string }): Promise<string> {
  const name = d.name.trim().slice(0, 120), firm = d.firm.trim().slice(0, 120);
  if (!name || !firm) throw new Error('name and firm are required');
  const vcId = await insertVc(name, firm);
  const slug = d.linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i)?.[1]?.toLowerCase() ?? null;
  await db().from('vc_profile').update({ owner_added_at: new Date().toISOString(), ...(slug ? { linkedin_slug: slug } : {}) }).eq('vc_id', vcId);
  await rescoreVc(vcId);
  return vcId;
}
