# Universal Brand Onboarding & Knowledge Architecture

**Date:** 2026-05-29
**Status:** Approved design — implementation pending
**Driver:** Calmosis (SM-2SCCLZ) shipped 2026-05-29 with empty brand context. Bot hallucinated "skincare brand." Same failure mode would hit every future non-Shopify brand.

## Goal

Every brand we onboard — Shopify storefront or arbitrary custom website, retail or real estate or yoga studio — gets a bot that knows their actual catalog, tone, and policies. No industry-specific code. No per-vertical branches. The intelligence is in the pipeline, not in the verticalization.

## Non-Goals

- WooCommerce / BigCommerce / Wix / Squarespace adapters (deferred until a real lead asks)
- Regulated-category compliance rules baked in code (the brand's own content carries the caveats — bot learns from KB, not from if-statements)
- Per-vertical templates or industry presets

## Three Principles

1. **Industry-agnostic by construction.** The catalog model, crawler, classifier, tools, and prompts contain zero industry-specific logic. A flat, a cannabis tincture, a yoga class, and a SaaS plan are all `catalog_items` with `attributes JSONB`. The LLM reasons about whatever keys it sees.

2. **Brand content is the source of truth.** Tone, caveats, dosage guidance, "talk to a doctor," "book a site visit" — these come from the brand's own pages via deep crawl + RAG. We do not hand-code policy.

3. **No brand goes live with an empty KB.** The onboarding wizard refuses to issue a snippet until brand summary + FAQs + catalog items are populated and merchant-approved. This is the durable guardrail.

## The Five Problem Areas

### Problem 1 — Brand context injection (root cause of "skincare" hallucination)

**Today:** `packages/agent/src/prompts/system.ts:20-63` has `BRAND_KB_SLOT` and `SITE_GRAPH_SLOT`. For Calmosis both are empty (no `brand_kb_chunks` rows, no `projection_cache` row). LLM fills the void by guessing from the brand name.

**Fix:**

- Add `brand_summary TEXT` + `brand_categories TEXT[]` to `merchants` schema (`packages/db/src/schema/merchants.ts:29-68`) + drizzle migration
- `loadPromptOpts` (`apps/api/src/index.ts:228-251`) and voice loader (`apps/voice-agent/src/agentWorker.ts:178-209`) fall back to `brand_summary` when KB+projection are empty
- Wire `brand_summary` into the system prompt above the KB slot — guarantees non-empty BRAND CONTEXT for every tenant
- Backfill Calmosis via one-off script, capture before/after voice transcript

### Problem 2 — Onboarding "degraded" conflates bot status with commerce status

**Today:** `apps/worker/src/handlers/onboarding.ts:161-169`. Non-Shopify sites return 0 products from `catalogSync`, then `selectorExtract` writes `status='degraded', lastError='selector_extract: no_products'`. The bot still works, but the merchant sees "degraded" and panics.

**Fix:** Split status into two axes.

- `bot_status: live | disabled`
- `catalog_status: shopify_synced | crawled | manual | none`
- `kb_status: populated | empty`

Bot goes live when `kb_status='populated'`. Catalog status is informational. Both surfaced in the brand dashboard (`web/src/app/app/settings/page.tsx`).

### Problem 3 — Universal onboarding pipeline (Shopify + any custom website)

#### 3.1 Platform fingerprinting (two buckets)

- Extend `fingerprint()` (`apps/worker/src/handlers/onboarding.ts:14-18`) to detect `shopify | custom`
- Shopify signals: `Shopify.shop`, `cdn.shopify.com` script srcs, `/products.json` endpoint
- Everything else → `custom`
- Persist on `merchants.platform_detected`

#### 3.2 Two catalog adapters

- **Shopify adapter** — keep existing (REST products endpoint)
- **Custom adapter** — headless Playwright crawl + LLM-extract from rendered HTML
- No other adapters (deferred)

#### 3.3 Headless crawler for custom sites

- Replace raw `fetch` in `apps/worker/src/jobs/crawlSite.ts` + `apps/worker/src/jobs/extractSiteGraph.ts` with Playwright (already a dependency)
- Render, wait for network-idle, snapshot hydrated HTML
- Cache rendered HTML in object storage so re-runs are cheap
- Existing concurrency cap + per-domain politeness stays
- Fallback: raw fetch + UA spoof if Playwright is blocked
- Shopify path bypasses headless (API is faster + cheaper)

#### 3.4 Universal brand-intake step (runs for both Shopify and custom)

- Headless crawl of homepage + nav top-3 + about/FAQ pages
- LLM extracts brand summary, product categories, tone, key value props, 5-10 FAQ pairs
- Writes `merchants.brand_summary` + `brand_kb_chunks` rows
- Runs for Shopify too — every brand gets a populated KB, not just custom sites
- Merchant edits/appends in dashboard before going live

#### 3.5 Onboarding wizard (brand dashboard)

- **Step 1** — paste domain → fingerprint + headless preview
- **Step 2** — show detected platform + auto-extracted brand summary + FAQs → merchant edits/approves
- **Step 3** — choose widget placement + persona
- **Step 4** — issue snippet only after 1-3 are approved
- Durable guardrail: no brand ever goes live with empty KB

#### 3.6 Status semantics

See Problem 2.

#### 3.7 Verification harness

- Two onboarding fixtures: a Shopify demo store + a custom React/Next site
- CI runs onboarding end-to-end, asserts bot live + KB populated + catalog status correct
- Block merges that regress either fixture

#### 3.8 Deep-crawl every page

- Crawler follows sitemap + internal links until budget exhausted (cap ~500 pages or 30 min/brand)
- Per-page classifier: `product | category | faq | dosage | policy | blog | contact | other` (pattern-based, not vertical-specific)
- Per-classification extraction templates

#### 3.9 Generic `catalog_items` model (industry-agnostic)

Replaces any product-specific schema. Schema:

```
catalog_items
  id              uuid
  merchant_id     text
  canonical_name  text
  url             text
  images          text[]
  short_desc      text
  long_desc       text
  attributes      jsonb          -- bedrooms, sqft, thc_mg, class_duration, anything
  embedding       vector(1536)   -- pgvector for semantic search
  created_at      timestamptz
  updated_at      timestamptz
```

The `attributes` JSONB carries whatever the crawler extracts. The agent reads the keys it sees and reasons about them. Zero industry knowledge in the schema or code.

#### 3.10 RAG retrieval at query time

- Add embedding column to `brand_kb_chunks` (pgvector)
- At each user turn: embed the query, retrieve top-k chunks, stuff into `BRAND_KB_SLOT`
- Small always-on header chunk (brand summary + 5 FAQs) so the bot is never cold
- Same logic for voice + text paths

#### 3.11 Generic catalog tools for the agent

- `search_catalog(query, filters)` — semantic + structured filter search
- `get_item(id_or_name)` — full record by canonical key
- `compare_items([id1, id2, ...])` — side-by-side on shared attributes
- Wired into Gemini Live (voice) and Sonnet (text) tool schemas
- Backed directly by `catalog_items` — fast and exact

#### 3.12 ~~Compliance layer~~ — REMOVED

Originally proposed a regulated-category policy layer. **Dropped.** Hand-coding compliance per vertical is an anti-pattern: it doesn't scale, it leaks industry assumptions into the platform, and it contradicts the AI-intelligence value prop. The brand's own content carries its caveats; the bot picks them up via RAG. Calmosis's dosage page says "consult a practitioner," the bot says "consult a practitioner." No code change required when we onboard a construction brand or a yoga studio.

#### 3.13 Per-brand evaluation harness

- During onboarding wizard, ask merchant for 10-20 "questions a customer would ask" — becomes a private eval set
- Nightly job runs bot through the eval set, LLM-judges answers as `correct | partial | wrong | hallucinated`
- Dashboard shows pass-rate; alert on drop
- Calmosis eval set: "diff between Peace and Sleep," "what's a starting dose," "can I talk to a doctor," etc.
- Same harness, same code path, for any future brand in any industry

### Problem 4 — Brand-controlled widget placement

**Today:** `packages/widget/src/styles/shadow.css.ts:5-9` hardcodes `position: fixed; bottom: 20px; right: 20px`.

**Fix:**

- Add `widget_placement` enum to merchants schema: `bottom-right` (default) | `bottom-left` | `middle-right` | `middle-left` | `top-right` | `top-left`
- Return `widgetPlacement` from `POST /v1/install` (`apps/api/src/routes/install.ts:146-163`) alongside existing `personaId`
- Plumb through `BootstrapResult` (`packages/widget/src/bootstrap.ts:42-47, 81-89`) into the custom element as `data-placement`
- `shadow.css.ts` reads the attribute and emits the right `top`/`bottom` + `left`/`right` (CSS variable on `:host`)
- `WidgetPlacementForm.tsx` (mirror `PersonaForm.tsx`) — 3×2 visual grid picker with live preview
- `saveWidgetPlacement` server action (mirror `savePersona`)
- Mount form in `web/src/app/app/settings/page.tsx`
- Vitest for the action; Playwright that loads each placement and asserts rect position

### Problem 5 — Brand analytics dashboard

**Today:** Conversion attribution shipped in Phase 1 Task 19 (`/app/revenue` page, attribution tiles). What's missing: the funnel above conversion — how many people see the pill, how many open it, how many engage, what they ask, where the bot fails. Without this the brand can't answer "is the bot working?" beyond revenue.

#### 5.1 Event taxonomy

Track these events from widget + agent, all keyed to `merchant_id` + `sm_visitor_id` (already persisted in localStorage, Phase 1 Task 13):

- `widget_loaded` — widget script booted on a page (denominator for funnel)
- `pill_impression` — pill rendered into viewport
- `pill_opened` — user clicked pill / opened bot
- `first_message_sent` — user sent first message or first voice utterance
- `session_engaged` — session reached ≥3 turns (configurable threshold)
- `tool_called` — agent invoked `search_catalog | get_item | compare_items` (capture which item/query)
- `item_recommended` — bot surfaced a `catalog_items` row (capture item id)
- `item_clicked` — user clicked a recommended item's URL
- `add_to_cart` — bot-driven cart add (already exists via Shopify cart attribute, Phase 1 Task 14)
- `unanswered` — bot fell back to "I don't know" / hallucination heuristic tripped
- `session_ended` — session closed (capture duration, turn count, voice/text split)
- Conversion events (`order_placed`) already exist via Phase 1.

All events flow into existing `conversion_events` infrastructure or a new `widget_events` table if the volume warrants a split.

#### 5.2 Funnel view (the headline answer)

Brand dashboard `/app/analytics` shows:

- **Loads → Pill impressions → Opens → First message → Engaged → Converted**
- Conversion rate at each step
- 7d / 30d / 90d windows
- Per-page breakdown (which pages drive opens — homepage vs product page vs checkout)

This is the direct answer to "how many people interacted vs total load sessions."

#### 5.3 Conversation analytics

- **Top queries** — clustered (LLM-embed + group) so "what's the price" and "how much does it cost" collapse to one row
- **Top items asked about** — from `tool_called` + `get_item` invocations
- **Top items recommended** — from `item_recommended`
- **Top items converted** — bot recommended → add_to_cart → order placed
- **Unanswered rate** — percent of sessions with at least one `unanswered` event
- **Top unanswered queries** — what the bot couldn't answer (this is the content-gap signal for the merchant)

#### 5.4 Quality + latency

- **Eval pass-rate** — from per-brand eval harness (3.13)
- **Median + p95 time-to-first-token** (voice and text)
- **Voice vs text split** — sessions, engagement, conversion by modality
- **Session duration distribution** — median, p75, p95

#### 5.5 Bot-vs-non-bot comparison

- Bot-touched sessions vs all sessions: AOV, conversion rate, items per order, time to purchase
- This is the "did the bot move the needle" question. Falls out of Phase 1 attribution tables + new funnel data.

#### 5.6 Operational (internal-only for ops, but expose summary to brand)

- Cost per session ($) — LLM tokens + voice minutes + crawl reruns
- Error rate (tool failures, model timeouts)
- Crawl freshness (last successful crawl per brand)

#### 5.7 Data plumbing

- Widget emits events via existing telemetry pipe (Phase 1 Task 18 added metric counters; extend with these event names)
- Agent emits `tool_called`, `item_recommended`, `unanswered` from inside its runtime
- New `widget_events` table (denormalized for cheap aggregation) — `id, merchant_id, sm_visitor_id, session_id?, event_name, event_props JSONB, occurred_at`
- Materialized views or scheduled rollups for the funnel — don't compute from raw events on every dashboard load
- Retention: 90d raw events, indefinite rolled-up daily aggregates

#### 5.8 Dashboard UI

- `/app/analytics` page in `web/src/app/app/` — three sections: Funnel, Conversation, Quality
- Reuse the dashboard primitives from Phase 1 attribution tiles
- Date range selector (7d / 30d / 90d / custom)
- Per-page filter
- Export CSV for raw events

#### 5.9 What this gives every brand

- **"Are people seeing my bot?"** → impression rate
- **"Are people engaging?"** → open rate + engaged-session rate
- **"What do customers want?"** → top queries + top items
- **"Where is the bot failing?"** → unanswered queries + eval drops
- **"Is the bot making money?"** → bot-vs-non-bot conversion + attributed revenue
- **"Should I add content for X?"** → top unanswered queries point directly at content gaps

Same dashboard. Same code. Industry-agnostic.

## Implementation Ordering

1. **Problem 1** — brand context baseline (unblocks Calmosis dignity, smallest blast radius)
2. **3.4** — universal brand intake (every new brand gets non-empty KB)
3. **3.8 + 3.9** — deep crawl + generic `catalog_items` (real product knowledge)
4. **3.10** — RAG retrieval (scales to large catalogs)
5. **3.11** — generic catalog tools (precise lookups + comparisons)
6. **3.5** — onboarding wizard (productionizes the durable guardrail)
7. **Problem 2** — status split (dashboard clarity)
8. **Problem 4** — widget placement (merchant control)
9. **5.1 + 5.7** — event taxonomy + plumbing (unblocks analytics)
10. **5.2 + 5.3 + 5.5 + 5.8** — funnel, conversation, comparison, dashboard UI
11. **3.1 + 3.2 + 3.3** — fingerprint + custom adapter + headless infra (long-tail quality)
12. **3.6 + 3.7** — status semantics + CI fixtures
13. **3.13 + 5.4** — per-brand eval harness + quality/latency analytics

## Acceptance — Prove It Works on Calmosis Live

Implementation is not "done" until Calmosis (SM-2SCCLZ) on the live site demonstrably handles their requirements. Capture runtime evidence (not just passing tests):

- Live voice session transcript showing the bot correctly answering: "what's the difference between Peace and Sleep," "what dosage should I take," "can I talk to a doctor," and a brand-positioning question — with no hallucinations
- Probe log showing brand_summary loaded, RAG chunks retrieved, catalog tools invoked with the right item names
- Analytics dashboard screenshot for SM-2SCCLZ showing funnel populated with real events
- Onboarding pipeline log for a re-run on calmosis.com showing `bot_status=live, kb_status=populated, catalog_status=crawled`
- Widget placement change applied via dashboard + verified live with a probe screenshot at the new position

Until those artifacts exist, ship is incomplete.

## What This Architecture Promises

- **Calmosis customer asks "diff between Peace and Sleep"** → RAG retrieves both `catalog_items` rows, `compare_items` tool returns side-by-side, bot reads from KB and brand's own dosage page.
- **Hypothetical construction brand customer asks "best 2BHK in Whitefield under 1.5cr"** → `search_catalog(query, {bedrooms: 2, location: 'Whitefield', max_price: 15000000})` returns ranked listings with brand's own marketing copy.
- **Same pipeline. Same code. Zero industry logic. That is the moat.**

## Open Questions

- Headless rendering cost at scale — need to measure per-brand crawl cost and set sensible caps before opening signups
- Embedding model choice (Voyage AI vs Cohere vs OpenAI text-embedding-3) — defer to implementation
- Crawler politeness for sites without `robots.txt` — default to 1 req/sec/domain unless we measure they tolerate more
