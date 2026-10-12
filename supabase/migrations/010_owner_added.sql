-- 010 (REVIEW-2 item 2, DECISIONS #47): investors Vikram added himself from "Add investors". His choice queues them for
-- outreach even when the research fit is weak (deal-breaker flags and conflicts still block). Existing VCs stay unset.
alter table vc_profile add column if not exists owner_added_at timestamptz;
