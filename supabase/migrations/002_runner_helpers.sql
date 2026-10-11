-- 002_runner_helpers.sql: small helpers for the batch runner (SPEC §9.1). Touches no vcs columns.

-- At most one running run at a time (SPEC §9.1 step 1 "never start a second").
create unique index runs_one_running on runs ((true)) where status = 'running';

-- Collector insert with "on conflict do nothing" across BOTH unique keys
-- (vc_id, url_hash) and (vc_id, title_norm), which PostgREST upsert cannot express.
create or replace function insert_signals(p_rows jsonb)
returns int language plpgsql set search_path = public as $$
declare n int;
begin
  insert into signals (vc_id, url, url_hash, title, title_norm, snippet, source, published_at,
                       status, reject_reason, source_name, date_approx)
  select r.vc_id, r.url, r.url_hash, r.title, r.title_norm, r.snippet, r.source, r.published_at,
         coalesce(r.status, 'pending'), r.reject_reason, r.source_name, coalesce(r.date_approx, false)
    from jsonb_to_recordset(p_rows) as r(
      vc_id uuid, url text, url_hash text, title text, title_norm text, snippet text, source text,
      published_at timestamptz, status text, reject_reason text, source_name text, date_approx boolean)
  on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Atomic counter/heartbeat update so concurrent steps don't overwrite each other.
create or replace function bump_run(
  p_run uuid, p_tavily int, p_gemini int, p_errors jsonb, p_failed uuid[], p_stats jsonb
) returns void language plpgsql set search_path = public as $$
begin
  update runs set
    tavily_credits = tavily_credits + coalesce(p_tavily, 0),
    gemini_calls   = gemini_calls + coalesce(p_gemini, 0),
    errors         = errors || coalesce(p_errors, '[]'::jsonb),
    failed_vc_ids  = array(select distinct unnest(failed_vc_ids || coalesce(p_failed, '{}'))),
    stats          = stats || coalesce(p_stats, '{}'::jsonb),
    heartbeat_at   = now()
  where id = p_run;
end $$;

-- Spec fix (see docs/DECISIONS.md): 001's claim_batch also re-claims rows where claimed_run = p_run,
-- so two concurrent steps of the SAME run (the lock makes them share one run) could take the same VC,
-- contradicting SPEC §12.4. A VC claimed by a crashed step is reclaimed once its claim is 10 minutes old.
create or replace function claim_batch(p_run uuid, p_started timestamptz, p_force boolean, p_failed uuid[], p_n int)
returns setof uuid language plpgsql security definer set search_path = public as $$
begin
  return query
  update vc_profile vp set claimed_run = p_run, claimed_at = now()
   where vp.vc_id in (
     select vc_id from vc_profile
      where (last_processed_at is null or last_processed_at < p_started)
        and not (vc_id = any(coalesce(p_failed, '{}')))
        and (p_force or last_processed_at is null or last_processed_at < now() - interval '24 hours')
        and (claimed_at is null or claimed_at < now() - interval '10 minutes')
      order by last_processed_at nulls first
      limit p_n
      for update skip locked)
  returning vp.vc_id;
end $$;
revoke execute on function claim_batch from public, anon, authenticated;
grant execute on function claim_batch to service_role;

revoke execute on function insert_signals, bump_run from public, anon, authenticated;
grant execute on function insert_signals, bump_run to service_role;
