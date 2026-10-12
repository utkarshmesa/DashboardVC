-- 008: LinkedIn posts as a signal source (owner decision 2026-10-12, DECISIONS #45). Posts are found through search-engine
-- results only (never by visiting LinkedIn); handles identify the author so only posts BY the VC or their firm's page count.
alter table vc_profile add column if not exists linkedin_slug text;          -- linkedin.com/in/<slug>
alter table vc_profile add column if not exists linkedin_checked_at timestamptz; -- weekly gating of the LinkedIn search
alter table firms add column if not exists linkedin_slug text;               -- linkedin.com/company/<slug>
