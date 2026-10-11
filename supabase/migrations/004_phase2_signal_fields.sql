-- 004: Phase 2 signal fields (see docs/DECISIONS.md).
-- funded_company: the company an investment item names (verbatim from title/snippet), used for the
--   "Check conflict — backed {company}" action; the spec names {company} but defines no field for it.
-- enriched_run: the run that enriched this item (SPEC §9.2 enrichment, capped at 10 items per run).
alter table signals add column if not exists funded_company text;
alter table signals add column if not exists enriched_run uuid;
create index if not exists signals_enriched_run on signals (enriched_run) where enriched_run is not null;
