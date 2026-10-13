-- 011: labelled demo history (Plan V2, DECISIONS #55). Vikram is a fictional founder, so his two months of contact
-- history can't come from real use. Demo outreach events are flagged so the dashboard can label them and clear them in
-- one click; demo rows in vcs are marked by a "[demo]" prefix in Vikram's own notes column (written through
-- update_my_fields, the human path, never through apply_signals).
alter table outreach_events add column if not exists demo boolean not null default false;
create index if not exists outreach_events_demo on outreach_events (demo) where demo;
