-- 013: published contact emails (DECISIONS #57). Kept out of vcs: Vikram's table stays his columns plus the four system
-- columns. One row per VC; every address carries where it was found. Code extracts addresses from firm-published pages
-- or the Hunter API; the LLM never produces one.
create table if not exists vc_contact (
  vc_id uuid primary key references vcs(id) on delete cascade,
  email text,
  kind text check (kind in ('personal', 'firm')),          -- the partner's own address, or a firm inbox (pitch@, hello@)
  source text check (source in ('firm_page', 'hunter')),
  source_url text,                                          -- the page it was published on (firm_page) or Hunter's top source
  confidence int,                                           -- Hunter score 0-100; null for firm-published addresses
  checked_at timestamptz not null default now(),            -- also set when nothing was found, so lookups aren't repeated
  hunter_checked boolean not null default false
);
alter table vc_contact enable row level security;
revoke all on vc_contact from anon, authenticated;
