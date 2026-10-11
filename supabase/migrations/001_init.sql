-- 001_init.sql: SPEC §7, verbatim (tables, ownership guard, apply_signals, update_my_fields, claim_batch, RLS/grants).

-- ===== Vikram's pipeline =====
create table vcs (
  id uuid primary key default gen_random_uuid(),
  -- Vikram-owned
  name text not null,
  firm text not null,
  thesis text,
  status text not null default 'not_contacted'
    check (status in ('not_contacted','awaiting_response','in_conversation','passed')),
  last_contact_date date,
  notes text,
  rss_url text,                              -- a personal feed only, never a firm feed
  -- System-owned (pipeline writes only these four)
  last_signal_date date,
  signal_summary text,
  follow_up_score int check (follow_up_score between 0 and 100),
  recommended_action text
);

-- ===== Research and system state, 1:1 with vcs =====
create table firms (
  firm_key text primary key,
  display_name text not null,
  aliases text[] default '{}',               -- distinctive names only; never generic words (e.g. 'Elevation', 'Prime')
  firm_rss text,
  fund_info_research text
);

create table vc_profile (
  vc_id uuid primary key references vcs(id) on delete cascade,
  firm_key text references firms(firm_key),
  aliases text[] default '{}',
  ambiguous_name boolean default false,
  trust text check (trust in ('A','A-','B','C')),
  tier int,
  research jsonb default '{}',               -- title, verified date, cheque, approach, conflicts, sources
  research_as_of date,
  last_processed_at timestamptz,
  last_fetch_status text check (last_fetch_status in ('ok','partial','failed')),
  appearance_checked_at timestamptz,
  claimed_run uuid,
  claimed_at timestamptz
);

-- ===== Evidence =====
create table signals (
  id bigserial primary key,
  vc_id uuid not null references vcs(id) on delete cascade,
  url text not null,
  url_hash text not null,
  title text not null,
  title_norm text not null,
  snippet text check (char_length(snippet) <= 300),
  source text not null,                      -- google_news | google_news_appearance | tavily | tavily_appearance | person_rss | firm_rss
  published_at timestamptz,                  -- source metadata only; null = undated
  status text not null default 'pending'
    check (status in ('pending','accepted','rejected','unclassified')),
  reject_reason text,
  source_name text,                          -- publisher, e.g. stripped from Google News titles
  date_approx boolean default false,         -- true when only the API's time filter vouches for the date
  subject text check (subject in ('person','firm')),
  signal_type text check (signal_type in ('investment','authored','speaking','press','other','irrelevant')),
  about_this_vc boolean,
  confidence numeric,
  relevance numeric,
  possible_competitor boolean,
  competitor_evidence text,                  -- verbatim phrase from title/snippet describing the funded product
  role_change_hint text,
  event_key text,
  summary text,
  hook text,
  created_at timestamptz default now(),
  unique (vc_id, url_hash),
  unique (vc_id, title_norm)
);
create index on signals (vc_id, status);

-- ===== Feedback (Vikram's thumbs) =====
create table signal_feedback (
  signal_id bigint primary key references signals(id) on delete cascade,
  verdict text not null check (verdict in ('up','down')),
  reason text,
  created_at timestamptz default now()
);

-- ===== Settings =====
create table settings (
  key text primary key,
  value text not null,
  updated_at timestamptz default now()
);

-- ===== Runs (log + lock only) =====
create table runs (
  id uuid primary key default gen_random_uuid(),
  trigger text not null check (trigger in ('cron','github','manual')),
  force boolean default false,
  status text not null default 'running' check (status in ('running','done','partial','failed')),
  started_at timestamptz default now(),
  heartbeat_at timestamptz default now(),
  finished_at timestamptz,
  failed_vc_ids uuid[] default '{}',         -- VCs that errored in THIS run; never retried within it
  tavily_credits int default 0,
  gemini_calls int default 0,
  stats jsonb default '{}',
  errors jsonb default '[]'
);

create or replace function guard_ownership() returns trigger language plpgsql as $$
declare w text := coalesce(current_setting('app.writer', true), '');
begin
  if w = 'pipeline' and
     (new.name, new.firm, new.thesis, new.status, new.last_contact_date, new.notes, new.rss_url)
     is distinct from
     (old.name, old.firm, old.thesis, old.status, old.last_contact_date, old.notes, old.rss_url)
  then raise exception 'pipeline may not modify Vikram-owned columns'; end if;
  if w = 'human' and
     (new.last_signal_date, new.signal_summary, new.follow_up_score, new.recommended_action)
     is distinct from
     (old.last_signal_date, old.signal_summary, old.follow_up_score, old.recommended_action)
  then raise exception 'dashboard edits may not modify system columns'; end if;
  return new;
end $$;

create trigger guard_ownership before update on vcs
for each row execute function guard_ownership();

create or replace function apply_signals(
  p_id uuid, p_last_signal_date date, p_summary text, p_score int, p_action text
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'pipeline', true);
  update vcs set last_signal_date = p_last_signal_date, signal_summary = p_summary,
                 follow_up_score = p_score, recommended_action = p_action
   where id = p_id;
end $$;

create or replace function update_my_fields(
  p_id uuid, p_status text, p_last_contact_date date, p_notes text
) returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('app.writer', 'human', true);
  update vcs set status = p_status, last_contact_date = p_last_contact_date, notes = p_notes
   where id = p_id;
end $$;

-- Atomic batch claim: two concurrent steps can never take the same VC
create or replace function claim_batch(p_run uuid, p_started timestamptz, p_force boolean, p_failed uuid[], p_n int)
returns setof uuid language plpgsql security definer set search_path = public as $$
begin
  return query
  update vc_profile vp set claimed_run = p_run, claimed_at = now()
   where vp.vc_id in (
     select vc_id from vc_profile
      where (last_processed_at is null or last_processed_at < p_started)
        and not (vc_id = any(p_failed))
        and (p_force or last_processed_at is null or last_processed_at < now() - interval '24 hours')
        and (claimed_at is null or claimed_at < now() - interval '10 minutes' or claimed_run = p_run)
      order by last_processed_at nulls first
      limit p_n
      for update skip locked)
  returning vp.vc_id;
end $$;

do $$ declare t text; begin
  foreach t in array array['vcs','firms','vc_profile','signals','signal_feedback','settings','runs'] loop
    execute format('alter table %I enable row level security', t);
    execute format('revoke all on %I from anon, authenticated', t);
  end loop;
end $$;
revoke update on vcs from service_role;
revoke execute on function apply_signals, update_my_fields, claim_batch from public, anon, authenticated;
grant execute on function apply_signals, update_my_fields, claim_batch to service_role;

