# Nav PRD Phase 8 — Store Insights (plan)

PRD § Phase 8 (Growth + Scale plans). Flags: `INSIGHTS_TRACKING` (api: accept + serve config), `INSIGHTS_FORCE_MERCHANTS` (comma list treated as entitled regardless of plan — for the Calmosis pilot; billing data untouched).

## Data model (migration 0023)
- `insight_counters` — the ONLY growing aggregate: `(merchant_id, day, metric, dim_key)` unique → `count bigint, total double`. Metrics: `pv` (pageviews by page_type|device|source), `heat` (cell clicks by page_type|device|cell), `attn` (seconds per page band), `scroll` (max-scroll sum), `friction` (rage|dead|error|uturn by page_type|device|target), `funnel` (sessions reaching step by device|source — once per session via Redis SETNX), `product` (views / atc per product path), `vitals` (lcp/cls/inp sums), `field_abandon`, `bot` (engaged sessions / engaged conversions). Fixed-size per merchant×day.
- `insight_pageviews` — detail rows ONLY for qualifying pageviews (bot-engaged, friction-hit, converting sample); TTL 7 d (Growth) / 14 d (Scale) via daily purge.
- `insight_reports` — weekly report per merchant: summary sentence, ₹ at risk, fixes jsonb (status open|done, before/after), anomalies.

## Widget tracker (`packages/widget/src/insights/tracker.ts`)
Starts only when bootstrap returns `insights: {enabled, sampleRate}` (entitled merchant + flag). Sticky per-session sampling. Consent gate: Shopify Customer Privacy API, OneTrust (C0002), Cookiebot statistics, GPC → off; Europe/* timezone requires an explicit positive signal. Accumulates in memory, ONE `sendBeacon` summary on `pagehide` (+60 s safety flush): page_type (from cached templates), device, source/utm, path, maxScroll, attention per 10 vertical bands, click counts per 10×10 cell + per element key (top 20), rage/dead/error clicks, uturn (<5 s dwell), abandoned field NAMES only, LCP/CLS/INP, js error count, bot engaged, cart-count increased. Never input values or keystrokes.

## API (`/v1/insights/pageview`)
Validate + clamp; per-merchant rate limit (Redis); plan session cap via HyperLogLog (`PFADD`/`PFCOUNT`) per month (Growth 50k, Scale 250k, forced 50k) → beyond cap reject; fan out to `insight_counters` upserts; insert detail row only when qualifying.

## Worker
- daily: purge detail rows past TTL; anomaly check (yesterday vs 4-week same-weekday baseline: conversion, checkout reach, add-to-cart dead clicks) → `alerts` (kind `insight.anomaly`) + owner email.
- weekly (Mon 03:00 UTC): build facts (counters 7 d vs prior 4 w, objections/needs from conversationCompleted intent records, support_cases by type, product_question cases) → LLM (OpenRouter) → `insight_reports` {summary, fixes[5] with evidence numbers only from facts, ₹ impact = lost sessions × CR × AOV}; Resend digest to owners.

## Dashboard (`/app/insights`) — owner-first rules (PRD 8e)
Home: one-sentence week summary, ₹ at risk, top 3 fix cards (What's happening / Why it matters / Proof / What to do / Did it work? + Mark done), "Ask about your store". Sections: Where shoppers leave (step path with people + ₹ leaking), Your pages (template screenshot via authenticated R2 proxy + heat overlay + numbered pins), Your products, What shoppers are saying, Assistant impact, Details (Scale: journeys, segments, CSV). Locked upgrade state for Starter. `insights-copy.ts` dictionary + jargon lint test. `hasFeature(plan, feature)`.

## Also
Pricing + billing feature copy; privacy page section; tests (no input values in payloads, consent-denied → zero beacons, detectors, counters, gating, jargon lint); perf budget (tracker size, bundle budget CI).

## Acceptance (adapted)
Real-browser synthetic sessions (tagged `qa`, purged afterwards) on calmosis.com across desktop/mobile populate funnel, heatmaps, friction, products; weekly report generated with ≥ 3 evidence-backed fixes; consent-denied + Starter merchant send 0 beacons; ≤ 1 beacon per pageview; tracker ≤ 5 KB gz. Real 7-day Calmosis data + owner usability test → "Needs Karan".
