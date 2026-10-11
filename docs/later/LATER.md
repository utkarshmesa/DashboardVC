# LATER: deferred scope

Build only when explicitly told. Everything here extends `docs/SPEC.md` and must keep all of its rules and tests passing.

**Promotion rule:** deal discovery (L1) moves into Phase 2 if the Phase 0 spike shows fewer than 25% of VCs have any in-window accepted item.

## L1. Deal discovery and firm-level fan-out

Purpose: firm-level news (a tracked firm funds a logistics seed) produces real, in-window signals that name-based queries miss.

Table:

```sql
create table deals (
  id bigserial primary key,
  kind text not null check (kind in ('funding_round','fund_event')),
  company text,
  company_norm text,
  round_stage text,
  amount_text text,
  announced_at date,                 -- source metadata only
  sector_relevance numeric,
  possible_competitor boolean default false,
  investors jsonb default '[]',      -- [{firm_raw, firm_key, quoted_person, role}]
  fund_event_type text,              -- first_close | final_close | new_fund | continuation
  source_url text not null,
  summary text,
  unique (kind, company_norm, round_stage, source_url)
);
```

Runs as the first step of each run: Google News RSS sector queries with `when:7d`. Keep the query list in `lib/discovery/queries.ts` (logistics seed India, supply chain seed India, freight tech funding India, logistics SaaS pre-Series A India, fleet management funding India, warehouse automation funding India, cross-border logistics funding India, early-stage VC fund close India). Gemini extracts deals in batches of 20, with the same no-URL / no-date rule as the classifier.

Fan-out: for each `funding_round` with relevance ≥ 0.6 announced within the signal window, insert a signal with `signal_type = 'investment'`, `subject = 'firm'` for every tracked VC at each matched firm, `event_key = company_norm + round_stage`, `source = 'deal_discovery'`.

## L2. Investor candidates

```sql
create table vc_candidates (
  id bigserial primary key,
  name text,
  firm_name text not null,
  firm_key text references firms(firm_key),
  evidence_url text not null,
  reason text,
  status text default 'suggested' check (status in ('suggested','added','dismissed')),
  created_at timestamptz default now(),
  unique (name, firm_name)
);
```

Sources: untracked rows from `seed/vc_profile_seed.csv` (reason "research: trust X"), and unknown investors in relevant seed / pre-Series A deals from L1 (max 5 new per run; never re-suggest a dismissed name + firm).

Add a `add_vc_from_candidate(id)` function that tags `app.writer = 'human'`, inserts into `vcs` and `vc_profile`, and marks the candidate `added`. Dashboard panel "Suggested investors" with Add and Dismiss.

## L3. Deployment momentum (display only)

Per firm, computed in code; **never changes `follow_up_score`**.

```
+40  new fund / first close / final close in the last 180 days (continuation funds add nothing)
+15  per relevant seed / pre-Series A deal in the last 90 days, max 45
+15  open programme or cohort call seen in the last 30 days
```

≥ 60 "Actively deploying", 30–59 "Deploying". Shown as a strip at the top of the dashboard and used as a tie-breaker in sorting.

## L4. Research drawer

A per-VC panel, separate from "Evidence (last 30 days)", labelled "Research snapshot, {date}": title and verification date, firm-level portfolio, cheque size, approach preference, conflicts and sources from `vc_profile.research`.

## L5. Quarterly research refresh

`scripts/import-research.ts` imports a delta CSV (`name,firm,change_type,field,new_value,source_url,source_date,confidence`), updates `vc_profile` and `firms`, adds new names as candidates, prints a diff, and **never touches `vcs`**.

Delta research prompt (save as `/seed/RESEARCH_REFRESH_PROMPT.md`):

```
You are refreshing an existing list of Indian seed investors for a B2B logistics
SaaS startup. Attached: vc_profile.csv (with research_as_of dates) and deals.csv
(deals our system logged since the last refresh).

Do NOT rebuild the list. For each existing person, report only changes since their
research_as_of date: role or firm change, new relevant deals, new fund events,
new public content channels. Every change needs a dated source URL. Then list up
to 15 NEW investors who led or co-led an Indian logistics or supply-chain software
round at pre-seed, seed or pre-Series A in the period, with the same evidence rules.

Output one CSV:
name,firm,change_type,field,new_value,source_url,source_date,confidence
change_type: role_change | new_deal | fund_event | new_channel | new_investor | no_change
```
