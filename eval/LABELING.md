# Labelling guide for `eval/to_label.jsonl`

Each line of `eval/to_label.jsonl` is one item exactly as the classifier sees it: VC name, firm, aliases, headline, snippet and source. Copy each line's `item_id`, add your judgement, and save one JSON object per line as `eval/labels.jsonl`:

```json
{"item_id": 12, "about_this_vc": true, "subject": "firm", "signal_type": "investment", "relevance_level": "core", "competitor": false}
```

Judge **only from the headline and snippet shown**. Don't open links or use outside knowledge, because the classifier can't either.

| Field | Values | Meaning |
|---|---|---|
| `about_this_vc` | `true` / `false` | Really about this person or their firm, not a namesake or an unrelated mention. |
| `subject` | `person` / `firm` | `person` if the item names this person as the actor or speaker; `firm` if it's about the firm without naming them as the actor. |
| `signal_type` | `investment`, `authored`, `speaking`, `press`, `other`, `irrelevant` | Invested in or led a round · wrote or posted something · spoke at or appeared on an event, panel or podcast · quoted or profiled · other news about the person or firm · not a usable signal. |
| `relevance_level` | `core`, `logistics_non_software`, `adjacent`, `unrelated` | Judged against the **target space** setting only (below). |
| `competitor` | `true` / `false` | Judged against the **my product** setting only: `true` only for an investment in a company the text itself describes as selling substantially the same product. If the text doesn't describe the product, `false`. |

## Relevance levels (against the target space)

Default target space: *B2B software for logistics and supply chain: transport and freight management, freight procurement, warehouse management, fleet and telematics, supply-chain visibility, last-mile and delivery software, cross-border and customs, procurement, logistics analytics and AI, and logistics fintech.*

- **core**: the item's subject (the funded company, or the topic written or spoken about) is software squarely in the target space. *E.g. "SuperProcure, a unified TMS platform, raises ₹14 Cr".*
- **logistics_non_software**: a logistics or supply-chain business that isn't software, such as carriers, 3PLs, warehousing, freight forwarding, packaging or logistics hardware. *E.g. "Yantra Packs raises seed funding to expand its reusable packaging network".*
- **adjacent**: related but outside the target space: other B2B or enterprise software, manufacturing or industrial tech, commerce enablement, generic fintech or AI tooling. *E.g. "Dodge AI raises $2.65M to tackle enterprise software failures".*
- **unrelated**: anything else, such as consumer, D2C, health, generic investing or startup advice, or personal news. *E.g. "Gourmet pizza brand raises Rs 5 Cr".*

Code maps the levels to relevance 1.0 / 0.7 / 0.4 / 0.1.

## Default "my product" (competitor check only)

*Freight procurement and transport management (TMS) SaaS for mid-size Indian manufacturers and shippers…* (the full text is on the dashboard's Settings page).
