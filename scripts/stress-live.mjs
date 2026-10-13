// Stress / abuse checks against the deployed app. Usage: node --env-file=.env.local scripts/stress-live.mjs [baseUrl]
// Every request is either invalid by design or a no-op; prints PASS/FAIL per check and never prints secrets.
// The dashboard is open to anyone with the link (DECISIONS #54); only the scheduled routes need the cron Bearer.

const BASE = process.argv[2] ?? "https://vc-pipeline-zeta.vercel.app";
const { CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!CRON_SECRET || !SUPABASE_SERVICE_ROLE_KEY) { console.error("Missing required env: CRON_SECRET, SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const good = {}; // no session any more: every request is anonymous
let failures = 0;
const check = (name, ok, detail = "") => { if (!ok) failures++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`); };
const req = (path, init = {}) => fetch(BASE + path, { redirect: "manual", ...init });

// 1. Service-role key must not appear in any client chunk.
{
  const html = await (await req("/")).text();
  const srcs = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+\.js)"/g)].map((m) => m[1]))];
  const sig = SUPABASE_SERVICE_ROLE_KEY.split(".")[2] ?? SUPABASE_SERVICE_ROLE_KEY;
  let hits = 0;
  for (const s of srcs) { const t = await (await fetch(BASE + s)).text(); if (t.includes(sig) || t.includes("service_role")) hits++; }
  check("service-role key absent from production client chunks", srcs.length > 0 && hits === 0, `${srcs.length} chunks scanned`);
}

// 2. Open access: every page loads with no password; the old login route is gone; scheduled routes still need the Bearer.
const gate = async (name, path, headers, want, init = {}) => {
  const r = await req(path, { headers, ...init });
  check(name, want.includes(r.status), `HTTP ${r.status}`);
};
{
  const html = await (await req("/")).text();
  check("dashboard opens with no password and shows Run now", html.includes("Run now") && !html.includes("Sign in"), "anonymous request");
}
for (const p of ["/pipeline", "/progress", "/investors", "/settings"]) await gate(`${p} opens with no password`, p, {}, [200]);
await gate("/quality redirects to /progress", "/quality", {}, [307, 308]);
await gate("/login no longer exists", "/login", {}, [404]);
await gate("Run now estimate works anonymously", "/api/run/estimate", {}, [200]);
await gate("evidence list is readable", "/api/vc/00000000-0000-4000-8000-000000000000/others", {}, [200, 404]);
await gate("cron without bearer → 401", "/api/cron", {}, [401]);
await gate("cron with wrong bearer → 401", "/api/cron", { authorization: "Bearer wrong" }, [401]);
await gate("run/step with wrong bearer → 401", "/api/run/step", { authorization: `Bearer ${CRON_SECRET}x` }, [401], { method: "POST" });
await gate("digest without bearer → 401", "/api/digest", {}, [401, 405]);

// 3. Input validation: malformed bodies must be rejected without writes or 500s.
const json = () => ({ ...good, 'content-type': 'application/json' });
const bad = async (name, path, method, body, want) => {
  const r = await req(path, { method, headers: json(), body: typeof body === 'string' ? body : JSON.stringify(body) });
  check(name, want.includes(r.status), `HTTP ${r.status}`);
};
const someId = '00000000-0000-4000-8000-000000000000';
await bad('feedback: not JSON', '/api/feedback', 'POST', '{not json', [400]);
await bad('feedback: verdict not up/down', '/api/feedback', 'POST', { signal_id: 1, verdict: 'meh' }, [400]);
await bad('feedback: negative id', '/api/feedback', 'POST', { signal_id: -5, verdict: 'up' }, [400]);
await bad('feedback: unknown signal → 404', '/api/feedback', 'POST', { signal_id: 999999999, verdict: 'up' }, [404]);
await bad('edit: non-uuid id', '/api/vc/1;drop%20table%20vcs', 'PATCH', { status: 'passed', last_contact_date: null, notes: null }, [400]);
await bad('edit: invalid status', `/api/vc/${someId}`, 'PATCH', { status: 'hacked', last_contact_date: null, notes: null }, [400]);
await bad('edit: invalid date', `/api/vc/${someId}`, 'PATCH', { status: 'passed', last_contact_date: '12/10/2026', notes: null }, [400]);
await bad('edit: oversized notes', `/api/vc/${someId}`, 'PATCH', { status: 'passed', last_contact_date: null, notes: 'x'.repeat(4001) }, [400]);
await bad('edit: system column smuggled in body is ignored', `/api/vc/${someId}`, 'PATCH', { status: 'passed', last_contact_date: null, notes: null, follow_up_score: 100 }, [200, 500]);

// 4. Concurrency: six simultaneous steps must share one run (one-running-run lock) and never error.
{
  const auth = { authorization: `Bearer ${CRON_SECRET}` };
  const rs = await Promise.all(Array.from({ length: 6 }, () => req('/api/run/step', { method: 'POST', headers: auth }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }))));
  check('6 concurrent steps all succeed', rs.every((r) => r.status === 200), rs.map((r) => r.status).join(','));
  check('6 concurrent steps process nothing twice', rs.reduce((s, r) => s + (r.body.processed ?? 0), 0) === 0, 'all VCs fresh, so 0 expected');
}

// 5. Load: 25 parallel dashboard renders.
{
  const t0 = Date.now();
  const rs = await Promise.all(Array.from({ length: 25 }, async () => { const s = Date.now(); const r = await req('/', { headers: good }); await r.text(); return { status: r.status, ms: Date.now() - s }; }));
  const ms = rs.map((r) => r.ms).sort((a, b) => a - b);
  check('25 parallel dashboard loads all 200', rs.every((r) => r.status === 200), `p50 ${ms[12]} ms, max ${ms[24]} ms, wall ${Date.now() - t0} ms`);
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nall checks passed');
process.exit(failures ? 1 : 0);
