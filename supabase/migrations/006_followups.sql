-- 006: Phase 5 follow-up state on vc_profile (never on vcs): snooze, and dismissal of a standing research conflict.
alter table vc_profile add column if not exists snoozed_until date;
alter table vc_profile add column if not exists conflict_dismissed_at timestamptz;
