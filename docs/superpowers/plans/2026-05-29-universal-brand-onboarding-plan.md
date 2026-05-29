# Universal Brand Onboarding — Implementation Plan

> **For agentic workers:** Execute task-by-task. Tasks use checkbox (`- [ ]`) syntax. Spec lives at `docs/superpowers/specs/2026-05-29-universal-brand-onboarding-design.md`.

**Goal:** Make Calmosis bot actually knowledgeable (no "skincare" hallucination), make every future brand onboard cleanly (Shopify + any custom site), give brands placement control + analytics, prove it on calmosis.com live.

**Architecture:** Industry-agnostic catalog model (`catalog_items` with `attributes JSONB`), deep crawl + RAG, generic catalog tools (`search_catalog | get_item | compare_items`), no per-vertical code. Detailed in spec doc.

**Tech Stack:** TypeScript monorepo (pnpm), Drizzle ORM + Postgres + pgvector, Hono API, Playwright crawler, Gemini Live (voice) + Sonnet (text), BullMQ + Redis, Next.js dashboard.

---

## Task 1 — Brand context baseline (unblocks Calmosis dignity)

**Why first:** Smallest blast radius. Calmosis hallucinates "skincare" because `BRAND_KB_SLOT` is empty. Adding `brand_summary` field + injecting it stops the immediate bleeding without touching crawl/RAG.

**Files:**
- Modify: `packages/db/src/schema/merchants.ts:29-68`
- Create: drizzle migration
- Modify: `packages/agent/src/prompts/system.ts:20-63`
- Modify: `apps/api/src/index.ts:228-251` (`loadPromptOpts`)
- Modify: `apps/voice-agent/src/agentWorker.ts:178-209` (voice loader)
- Modify: `apps/voice-agent/src/persona.ts:19-37` (voice systemInstruction if needed)
- Create: `apps/api/scripts/backfill-calmosis-brand-summary.mjs`

### Steps

- [ ] **1.1** Add `brand_summary text` (nullable) + `brand_categories text array` (nullable) to `merchants` table in `packages/db/src/schema/merchants.ts`. No NOT NULL — existing rows must keep working.
- [ ] **1.2** Generate migration: `pnpm --filter @shoppingmate/db drizzle:generate`. Inspect SQL. Apply: `pnpm --filter @shoppingmate/db drizzle:migrate` against prod (Railway DATABASE_PUBLIC_URL).
- [ ] **1.3** In `packages/agent/src/prompts/system.ts`, add `brandSummary?: string` + `brandCategories?: string[]` to the opts type. Add a new `BRAND_SUMMARY_SLOT` above `BRAND_KB_SLOT` that renders when present:
  ```
  ## BRAND
  {brandName} sells: {brandSummary}
  Categories: {brandCategories.join(', ')}
  ```
  Keep `BRAND_KB_SLOT` behavior — this is additive.
- [ ] **1.4** In `apps/api/src/index.ts:228-251` (`loadPromptOpts`), select `brand_summary, brand_categories` from `merchants`, pass into `buildSystemPrompt(merchant, { brandSummary, brandCategories, kbText, siteGraphText })`.
- [ ] **1.5** In `apps/voice-agent/src/agentWorker.ts:178-209`, mirror the same load + pass into voice prompt assembly.
- [ ] **1.6** Write backfill script `apps/api/scripts/backfill-calmosis-brand-summary.mjs` that connects to prod DB and UPDATEs `SM-2SCCLZ` with:
  ```
  brand_summary = 'Calmosis is an ayurvedic wellness brand making cannabis-based products (full-spectrum THC + CBD) for sleep, anxiety, pain relief, and overall wellbeing. Products include tinctures, capsules, and topicals formulated with terpenes and ayurvedic herbs. Customers are guided to consult an ayurvedic practitioner for personalized dosage.'
  brand_categories = ARRAY['wellness', 'ayurveda', 'cannabis', 'cbd', 'thc', 'sleep', 'pain-relief']
  ```
- [ ] **1.7** Run backfill against prod, verify with `SELECT brand_summary, brand_categories FROM merchants WHERE id='SM-2SCCLZ'`.
- [ ] **1.8** Deploy API + voice-agent to Railway.
- [ ] **1.9** Run a fresh voice session against calmosis.com (probe or browser). Ask "what does Calmosis make?" — confirm answer mentions ayurvedic cannabis, NOT skincare. Capture transcript.
- [ ] **1.10** Commit each logical chunk separately. Final commit message references the spec.

**Acceptance:** Voice transcript on live calmosis.com shows the bot describing Calmosis as ayurvedic cannabis wellness (not skincare). No code path changes for tenants without `brand_summary` populated.

---

## Task 2 — Universal brand intake (auto-populate brand_summary)

**Why next:** Task 1 fixes Calmosis manually. Task 2 ensures every future brand gets `brand_summary` auto-populated during onboarding.

**Files:**
- Create: `apps/worker/src/steps/brandIntake.ts`
- Modify: `apps/worker/src/handlers/onboarding.ts` (insert step after `fingerprint`)
- Reuse: Playwright (already a dep of `apps/worker`)

### Steps

- [ ] **2.1** Write `brandIntake.ts` that: launches Playwright, navigates to `https://<domain>/`, captures rendered HTML, follows nav links to top-3 + `/about` + `/faq` (best-effort, skip 404s), captures HTML for each.
- [ ] **2.2** Call Sonnet (existing client) with all captured HTML + system prompt: "Extract brand summary (2-3 sentences), categories (5-10 tags), tone, top 5-10 customer FAQs as Q/A pairs. Return JSON."
- [ ] **2.3** Write Sonnet output to `merchants.brand_summary`, `merchants.brand_categories`, and `brand_kb_chunks` rows for each FAQ.
- [ ] **2.4** Insert `brandIntake` into onboarding pipeline in `apps/worker/src/handlers/onboarding.ts` after `fingerprint` and before `catalogSync`.
- [ ] **2.5** Make `brandIntake` failure non-fatal (catch, log, continue with empty fields).
- [ ] **2.6** Test by re-running onboarding for `SM-2SCCLZ`. Verify `brand_summary` is populated.
- [ ] **2.7** Test against a Shopify demo store fixture. Verify `brand_summary` is populated.

**Acceptance:** Re-running onboarding on calmosis.com produces a populated `brand_summary` automatically. Re-running on a Shopify demo store also produces a populated `brand_summary`.

---

## Task 3 — Deep crawl + generic catalog_items model

**Files:**
- Create: `packages/db/src/schema/catalog.ts` (`catalog_items` table)
- Create: `apps/worker/src/steps/deepCrawl.ts`
- Create: `apps/worker/src/steps/pageClassifier.ts`
- Create: `apps/worker/src/steps/catalogExtractor.ts`
- Modify: `apps/worker/src/handlers/onboarding.ts`

### Outline

- [ ] **3.1** Schema for `catalog_items` per spec (id, merchant_id, canonical_name, url, images, short_desc, long_desc, attributes JSONB, embedding vector(1536), timestamps). Index on (merchant_id, canonical_name).
- [ ] **3.2** Deep-crawl step uses Playwright + sitemap + internal link discovery, capped at 500 pages or 30 minutes per brand. Caches HTML.
- [ ] **3.3** Page classifier (LLM-based, not heuristic) labels each page as `product | category | faq | policy | blog | contact | other`.
- [ ] **3.4** Catalog extractor pulls structured records from `product` pages — name, price, images, attributes JSONB (whatever keys appear: bedrooms, sqft, thc_mg, class_duration, ingredients, etc.). Writes to `catalog_items`.
- [ ] **3.5** Per-page content also chunked + written to `brand_kb_chunks` (for RAG in Task 4).
- [ ] **3.6** Wire into onboarding pipeline after `brandIntake`.
- [ ] **3.7** Verify on Calmosis: `SELECT count(*) FROM catalog_items WHERE merchant_id='SM-2SCCLZ'` returns the number of products on their site (≥4 expected).

**Acceptance:** Calmosis catalog_items table is populated with Peace, Sleep, and other products with `attributes.thc_mg`, `attributes.cbd_mg`, ingredients, dosage info, etc.

---

## Task 4 — RAG retrieval (pgvector + per-turn embeddings)

**Files:**
- Modify: `packages/db/src/schema/dashboard.ts` (add embedding column to `brand_kb_chunks`)
- Create: `packages/agent/src/rag/retrieve.ts`
- Modify: `apps/api/src/index.ts:228-251` (use RAG retrieval to build kbText)
- Modify: `apps/voice-agent/src/agentWorker.ts:178-209` (same)

### Outline

- [ ] Enable pgvector extension on prod DB
- [ ] Add `embedding vector(1536)` to `brand_kb_chunks`
- [ ] At ingestion (Task 2 + Task 3), embed each chunk and store
- [ ] At each user turn, embed the query, retrieve top-k chunks (k=8), stuff into `BRAND_KB_SLOT`
- [ ] Keep small always-on header (brand summary + 3 FAQs) so cold queries still have context
- [ ] Verify retrieval relevance on Calmosis test queries

**Acceptance:** "diff between Peace and Sleep" query retrieves Peace + Sleep KB chunks (not a category page).

---

## Task 5 — Generic catalog tools (search_catalog / get_item / compare_items)

**Files:**
- Create: `packages/agent/src/tools/catalog.ts`
- Modify: text agent + voice agent tool schemas

### Outline

- [ ] Implement `search_catalog(query, filters?)` — pgvector semantic search on `catalog_items.embedding` + structured filter on `attributes JSONB`
- [ ] Implement `get_item(idOrName)` — direct lookup with fuzzy name match
- [ ] Implement `compare_items([id1, id2, ...])` — fetch each, return structured side-by-side
- [ ] Wire into Gemini Live function declarations
- [ ] Wire into Sonnet tool_use schema
- [ ] Verify: voice session asking "diff between Peace and Sleep" triggers `compare_items(['Peace', 'Sleep'])`, returns useful comparison

**Acceptance:** Voice/text transcripts show tool invocations with correct args and useful responses.

---

## Task 6 — Onboarding wizard in brand dashboard

**Files:**
- Create: `web/src/app/app/onboarding/page.tsx` (wizard flow)
- Create: `web/src/app/app/onboarding/actions.ts`
- Modify: `web/src/app/app/settings/page.tsx` (move snippet copy here only when wizard complete)

### Outline

- [ ] Step 1: domain input + "preview" button (calls API to run fingerprint + intake)
- [ ] Step 2: show extracted brand summary + FAQs in editable form
- [ ] Step 3: persona + widget placement selector
- [ ] Step 4: only after merchant approves all three, surface the snippet + "you're live" copy

**Acceptance:** New merchant cannot get the install snippet without populated brand summary.

---

## Task 7 — Status split (bot_status / catalog_status / kb_status)

**Files:**
- Modify: `packages/db/src/schema/merchants.ts` (add three status columns, deprecate single `status` once migrated)
- Modify: `apps/worker/src/handlers/onboarding.ts:161-169` (remove the degraded-on-no-products path; write `catalog_status='none'` instead, bot stays live)
- Modify: `web/src/app/app/settings/page.tsx`

### Outline

- [ ] Add `bot_status enum`, `catalog_status enum`, `kb_status enum` (preserve old `status` column for now)
- [ ] Rewrite onboarding terminal states
- [ ] Surface three statuses with clear labels in dashboard

**Acceptance:** Calmosis dashboard shows `bot_status=live, catalog_status=crawled, kb_status=populated`.

---

## Task 8 — Widget placement picker

**Files:**
- Modify: `packages/db/src/schema/merchants.ts` (add `widget_placement enum`)
- Modify: `apps/api/src/routes/install.ts:146-163` (return `widgetPlacement`)
- Modify: `packages/widget/src/bootstrap.ts:42-47, 81-89` + `BootstrapResult`
- Modify: `packages/widget/src/styles/shadow.css.ts:5-9` (CSS var on `:host`, anchor pair driven by attribute)
- Create: `web/src/components/dashboard/WidgetPlacementForm.tsx`
- Modify: `web/src/app/app/settings/actions.ts` (add `saveWidgetPlacement`)
- Modify: `web/src/app/app/settings/page.tsx`

### Outline

Spec details all 8 sub-steps (4.1-4.8). Mechanical implementation.

**Acceptance:** Probe Calmosis with placement changed to `bottom-left` via dashboard, capture screenshot showing pill in bottom-left.

---

## Task 9 — Analytics event taxonomy + plumbing

**Files:**
- Create: `packages/db/src/schema/analytics.ts` (`widget_events` table)
- Modify: `packages/widget/src/bootstrap.ts` + widget runtime (emit `widget_loaded`, `pill_impression`, `pill_opened`)
- Modify: agent runtime (emit `first_message_sent`, `session_engaged`, `tool_called`, `item_recommended`, `unanswered`, `session_ended`)
- Create: `apps/api/src/routes/events.ts` (POST endpoint)

### Outline

- [ ] Define event taxonomy per spec 5.1
- [ ] Widget emits events with `merchant_id` + `sm_visitor_id` (already persisted from Phase 1 Task 13)
- [ ] Agent emits semantic events from inside its runtime
- [ ] All events flow to `widget_events` table (or extend `conversion_events` if simpler)

**Acceptance:** Loading calmosis.com produces `widget_loaded` + `pill_impression` rows. Opening the bot produces `pill_opened`. Sending a message produces `first_message_sent`.

---

## Task 10 — Analytics dashboard

**Files:**
- Create: `web/src/app/app/analytics/page.tsx`
- Create: `web/src/app/app/analytics/actions.ts`
- Create: dashboard components for funnel, top queries, top items, unanswered

### Outline

- [ ] Funnel view (Loads → Impressions → Opens → First Message → Engaged → Converted)
- [ ] Top queries (clustered via embeddings)
- [ ] Top items asked / recommended / converted
- [ ] Unanswered rate + top unanswered queries
- [ ] Bot-vs-non-bot comparison block
- [ ] Date range selector + per-page filter

**Acceptance:** Calmosis dashboard at `/app/analytics` shows real funnel populated from live sessions, plus top queries from the verification voice transcripts.

---

## Task 11 — Universal platform fingerprint + custom adapter + headless infra

**Files:**
- Modify: `apps/worker/src/handlers/onboarding.ts` (extend `fingerprint()`)
- Modify: `apps/worker/src/jobs/crawlSite.ts` + `apps/worker/src/jobs/extractSiteGraph.ts` (Playwright)
- Create: `apps/worker/src/adapters/customCatalog.ts` (LLM-extract from rendered HTML)

### Outline

Per spec 3.1, 3.2, 3.3. Shopify path keeps existing fast lane.

**Acceptance:** Onboarding fixture for a Next.js SPA passes end-to-end with non-empty catalog and KB.

---

## Task 12 — Status semantics finalize + CI fixtures

### Outline

Per spec 3.6, 3.7. Two onboarding fixtures (Shopify demo + custom React). CI blocks regression.

---

## Task 13 — Per-brand eval harness + quality/latency analytics

### Outline

Per spec 3.13 + 5.4. Calmosis eval set captured during Task 6. Nightly job, dashboard surfacing.

---

## Final Acceptance — Calmosis Live Proof

Capture and attach to this plan:

1. Voice transcript from calmosis.com answering all four Calmosis test queries correctly:
   - "What does Calmosis make?" → ayurvedic cannabis wellness, NOT skincare
   - "What's the difference between Peace and Sleep?" → product-level differentiation
   - "What dosage should I take?" → brand-content-driven guidance (no hardcoded compliance)
   - "Can I talk to a doctor?" → brand's own consultation pathway
2. Probe log showing: brand_summary loaded, RAG chunks retrieved, catalog tools invoked
3. Analytics dashboard screenshot for SM-2SCCLZ with populated funnel
4. Onboarding re-run log: `bot_status=live, catalog_status=crawled, kb_status=populated`
5. Widget placement changed via dashboard, probe screenshot showing new position
