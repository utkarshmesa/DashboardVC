-- 009 (REVIEW-2 items 2 and 3): researched-but-untracked investors Vikram can add to his pipeline, and the outreach
-- channel on logged events (email / form / LinkedIn) so the funnel can compare channels later.
create table if not exists vc_candidates (
  id bigserial primary key,
  name text not null,
  firm text not null,
  aliases text[] default '{}',
  ambiguous_name boolean default false,
  tier int,
  trust text,
  research jsonb default '{}',
  research_as_of date,
  dismissed_at timestamptz,                                  -- "Not for me": hidden from the list
  added_vc_id uuid references vcs(id) on delete set null,    -- set once Vikram adds them
  created_at timestamptz default now(),
  unique (name, firm)
);
alter table vc_candidates enable row level security;
revoke all on vc_candidates from anon, authenticated;

alter table outreach_events add column if not exists channel text check (channel in ('email', 'form', 'linkedin', 'other'));
