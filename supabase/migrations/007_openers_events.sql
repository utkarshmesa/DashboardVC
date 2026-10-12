-- 007: research-grounded openers (cached per VC; regenerated when the research text or prompt changes) and an
-- outreach event log for outcome tracking. Neither touches vcs.
alter table vc_profile add column if not exists opener text;
alter table vc_profile add column if not exists opener_hash text;
alter table vc_profile add column if not exists opener_at timestamptz;

create table if not exists outreach_events (
  id bigserial primary key,
  vc_id uuid not null references vcs(id) on delete cascade,
  event text not null check (event in ('emailed','nudged','replied','meeting','passed','snoozed','unsnoozed','status_change')),
  status_before text,
  status_after text,
  fit_label text,          -- fit at the time of the event (strong | good | weak)
  had_hook boolean,        -- a guarded news hook existed at the time
  action text,             -- recommended action at the time
  at timestamptz default now()
);
create index if not exists outreach_events_vc on outreach_events (vc_id, at);
alter table outreach_events enable row level security;
revoke all on outreach_events from anon, authenticated;
