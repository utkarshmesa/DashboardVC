// Phase 0: one bare Vercel function. GET /api/spike with `Authorization: Bearer <CRON_SECRET>`.
// Runs the 10-VC sample (Tavily cap 10) and the 6 golden queries, and returns metrics as JSON.
import { timingSafeEqual } from 'node:crypto';
import { GOLDEN } from '../data/golden.js';
import { VCS } from '../data/vcs.js';
import { loadEnv } from '../lib/config.js';
import { runGolden, runSpike } from '../lib/core.js';
import { VERCEL_SAMPLE, VERCEL_TAVILY_CAP } from '../lib/sample.js';

function authorized(req: Request, secret: string): boolean {
  const got = Buffer.from(req.headers.get('authorization') ?? '');
  const want = Buffer.from(`Bearer ${secret}`);
  return got.length === want.length && timingSafeEqual(got, want);
}

export async function GET(req: Request): Promise<Response> {
  const t0 = Date.now();
  let env;
  try { env = loadEnv(['gemini', 'tavily', 'cron']); }
  catch (e) { return Response.json({ error: String((e as Error).message) }, { status: 500 }); }
  if (!authorized(req, env.cronSecret)) return new Response('Unauthorized', { status: 401 });

  const withGolden = new URL(req.url).searchParams.get('golden') !== '0';
  const spike = await runSpike({ vcs: VERCEL_SAMPLE, env, tavilyCap: VERCEL_TAVILY_CAP, deadlineMs: 200_000 });
  const spikeMs = Date.now() - t0;
  let golden = null;
  if (withGolden) {
    const g = await runGolden(GOLDEN, VCS, env);
    const { perEvent: _raw, ...rest } = g;
    golden = rest;
  }
  return Response.json({
    runtime: { region: process.env.VERCEL_REGION ?? null, node: process.version, function_ms: Date.now() - t0, spike_ms: spikeMs },
    spike: {
      ...spike,
      requests: spike.requests,
      items: spike.items.map((i) => ({
        item_id: i.item_id, vc_id: i.vc_id, title: i.title, snippet: i.snippet, url: i.url, source_name: i.source_name,
        published_at: i.published_at, date_approx: i.date_approx, sources: i.sources, status: i.status,
        reject_reason: i.reject_reason, labels: i.labels,
      })),
    },
    golden,
  });
}
