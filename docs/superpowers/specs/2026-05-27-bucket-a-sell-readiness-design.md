# Bucket A — Sell-Readiness Design

**Date:** 2026-05-27
**Owner:** Karan
**Source brief:** `docs/go-to-production.md` § Bucket A
**Status:** design — pending plan

## 1. Goal

Make shoppingmate sellable end-to-end. A stranger can sign up at `shoppingmate.ai`, pay Starter $30, install the script tag, run a real voice conversation, and see the attributed sale appear in their dashboard — all within ten minutes, on real DNS, with real keys, and with defensible unit economics.

## 2. Scope

Combined design for all seven Bucket A items (A1–A7). One spec, three execution phases. Items split into engineering work (A1, instrumentation for A7) and operator work (A2–A6, pilot execution for A7).

## 3. Sequence — three phases, ops-first

```
Phase 1 — Ops (~½ day operator)
  A3 DNS records  →  A4 Resend domain switch
  A5 R2 token rotate + CORS policy
  A6 Composio config id + Railway secrets paste
  A2 Phase 2 acceptance run (11 items) → tag `phase2-brand-dashboard-complete`
       ↓ gates
Phase 2 — Plan 7 conversion attribution (engineering)
  schema → ingest (webhook + gtag) → ledger → dashboard ROI tile → tests
       ↓ gates
Phase 3 — Cost pilot (A7)
  voice-smoke harness w/ cost meter → 80 synthetic + 20 real → $/conv with 95% CI
```

Phase 1 first because DNS unblocks Plan 7's gtag testing on a real domain, the Phase 2 acceptance tag locks a green base before Plan 7 adds new surface area, and the cost pilot benefits from a stable production environment to measure against.

## 4. Phase 1 — operator punch-list

Each item carries a single-line **Definition of Done** the operator can self-check.

### A3 — DNS

Records to add at the `shoppingmate.ai` registrar:

- `shoppingmate.ai` apex → A record to Vercel IP (or CNAME via Vercel apex helper) — marketing site
- `app.shoppingmate.ai` → CNAME to Vercel project — brand dashboard
- `api.shoppingmate.ai` → CNAME to Railway api service
- `agents.shoppingmate.ai` → reserved for Bucket C; provision the CNAME now (zero cost; avoids a re-DNS pass later)
- Resend SPF: TXT `v=spf1 include:_spf.resend.com ~all`
- Resend DKIM: 3 CNAME records from Resend domain-verification UI
- DMARC: TXT `v=DMARC1; p=none; rua=mailto:alerts@shoppingmate.ai`

**DoD:** `curl -I` against `https://shoppingmate.ai`, `https://app.shoppingmate.ai`, `https://api.shoppingmate.ai/health` all return 200 with valid certs; `dig TXT shoppingmate.ai` returns SPF + DMARC.

### A4 — Resend domain switch

- Add `shoppingmate.ai` as a verified domain in Resend (requires A3 DKIM records propagated)
- Switch sender addresses:
  - `hello@shoppingmate.ai` — transactional (magic links, receipts)
  - `alerts@shoppingmate.ai` — ops (payment failures, system notices)
- Grep `apps/api` for hardcoded `openkarta.org`; replace with env-driven default sourced from `RESEND_FROM_TRANSACTIONAL` / `RESEND_FROM_OPS`
- Update Railway env accordingly

**DoD:** trigger a magic-link signup; email arrives from `hello@shoppingmate.ai`, lands in Gmail Primary (not Promotions / Spam); DKIM = pass in raw headers.

### A5 — R2 token rotate + CORS

- Revoke the existing R2 token (the one that scoped the chat-history exposure on 2026-05-04)
- Create a new token scoped only to the buckets we use (KB, site-graph, chat-history), read+write only — no admin scope
- Paste into Railway secrets *before* revoking the old one to avoid an upload outage
- Add CORS policy to each bucket:
  - `AllowedOrigins`: `https://shoppingmate.ai`, `https://app.shoppingmate.ai`
  - `AllowedMethods`: `GET`, `PUT`, `POST`
  - No wildcards

**DoD:** `/app/knowledge` PDF upload still works against the new token; a `curl -X PUT` from a random origin against the bucket is blocked.

### A6 — Composio config id + Railway secrets

Required env (paste-and-verify against this list):

```
COMPOSIO_SHOPIFY_AUTH_CONFIG_ID
LIVEKIT_API_KEY
LIVEKIT_API_SECRET
LIVEKIT_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
ANTHROPIC_API_KEY
GEMINI_API_KEY
RESEND_API_KEY
RESEND_FROM_TRANSACTIONAL
RESEND_FROM_OPS
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
COMPOSIO_API_KEY
DATABASE_URL
REDIS_URL
JWT_SECRET
NEXT_PUBLIC_API_BASE_URL
```

**DoD:** Railway deploy is green; `/health` returns 200; one manual `POST /v1/voice/token` call from `app.shoppingmate.ai` succeeds end-to-end.

### A2 — Phase 2 acceptance + release tag

- Run all 11 items in `docs/runbooks/2026-05-04-phase2-acceptance.md` against `app.shoppingmate.ai` (requires A3, A4, A6 done)
- Tick each box in a runbook commit; note any blockers under Notes
- If all 11 green: `git tag phase2-brand-dashboard-complete && git push --tags`
- If any red: hotfix before tag, or explicitly de-scope in this spec with operator sign-off

**DoD:** runbook fully ticked + tag visible on origin.

### Phase 1 gotchas

- DNS + DKIM propagation can take hours — start A3 first thing in the morning
- A2 requires Stripe **test mode** + Shopify **dev store** + Composio **sandbox** — not live
- Copy the new R2 token into Railway *before* revoking the old one

## 5. Phase 2 — A1 Plan 7 conversion attribution

### 5.1 Attribution model

**Hybrid: assisted + influenced.** Both flavors computed and stored per order.

- **Assisted** — visitor placed an order containing a SKU that Sage explicitly recommended, mentioned, or highlighted during a conversation within the attribution window. Defensible, conservative.
- **Influenced** — visitor placed an order any time within the attribution window after any conversation (regardless of whether specific SKUs were discussed). Looser, brand-friendly.

A single order can produce two rows (one of each kind) when both conditions hold.

**Attribution window: 7 days.** Matches Shopify's default attribution window so our ROI tile reconciles cleanly with the merchant's existing reports. Stored on each conversion row as a policy snapshot for auditability.

### 5.2 Identity matching

**Hybrid: webhook-first, gtag-fallback.**

- **Webhook (primary, Shopify merchants):** widget injects `sm_visitor_id` into Shopify cart attributes via `PUT /cart.js` (Shopify Ajax API) at init. Attribute survives into `note_attributes` on the resulting order; Shopify `orders/create` webhook fires to our endpoint with that attribute. Server-to-server, no ad-blocker risk.
- **gtag (fallback, non-Shopify + Shopify-with-belt-and-suspenders):** merchant pastes a gtag snippet on their thank-you page. On purchase it reads `sm_visitor_id` from `localStorage` (cookie fallback) and POSTs to `/v1/conversion`.

Dedupe on `(merchant_id, order_id, attribution_kind)` so both signals firing for the same order produce one set of rows.

### 5.3 Schema

Three things land in one drizzle migration: a new `conversation_sessions` table, a new `recommendation_events` table, and an ALTER of the existing minimal `conversion_events` table.

**Existing `conversion_events` (in `packages/db/src/schema/conversionEvents.ts`) — current columns:**

```
id bigserial pk
merchant_id text fk → merchants(id)
session_id text                  -- already present, untyped (no FK)
order_id text
total_cents int
currency text
ts timestamptz default now()
```

**ALTER to add:**

```sql
ALTER TABLE conversion_events
  ADD COLUMN attribution_kind text NOT NULL,              -- 'assisted' | 'influenced'
  ADD COLUMN attribution_window_days int NOT NULL,        -- policy snapshot at write
  ADD COLUMN match_source text NOT NULL,                  -- 'shopify_webhook' | 'gtag'
  ADD COLUMN visitor_id text NOT NULL,
  ADD COLUMN line_items jsonb NOT NULL,
       -- [{ sku, quantity, price_cents, was_recommended: bool }]
  ADD COLUMN occurred_at timestamptz NOT NULL,            -- order time per source
  RENAME COLUMN ts TO created_at;
ALTER TABLE conversion_events
  ADD CONSTRAINT conversion_events_unique_attribution
    UNIQUE (merchant_id, order_id, attribution_kind);
CREATE INDEX conversion_events_merchant_occurred_idx
  ON conversion_events (merchant_id, occurred_at DESC);
```

`session_id` (the existing text column) is repurposed as the attribution-session pointer (was-attribution_session_id in earlier draft). No FK because sessions are stored separately (next).

**New `conversation_sessions` table** (no sessions table exists today; `metricEvents` carries `sessionId` in JSON tags only):

```sql
conversation_sessions
  id text pk                                              -- LiveKit room id
  merchant_id text fk → merchants(id) ON DELETE CASCADE
  visitor_id text NOT NULL
  started_at timestamptz NOT NULL DEFAULT now()
  ended_at timestamptz                                    -- nullable until session closes
  index (merchant_id, visitor_id, ended_at DESC)
```

Backfill: not required. Sessions table starts empty; Plan 7's join only needs forward-looking sessions.

**New `recommendation_events`:**

```sql
recommendation_events
  id bigserial pk
  session_id text NOT NULL fk → conversation_sessions(id)
  sku text NOT NULL
  kind text NOT NULL                                      -- 'mentioned' | 'highlighted' | 'clicked'
  created_at timestamptz NOT NULL DEFAULT now()
  index (session_id, sku)
```

**Add to `merchants` table:**

```sql
ALTER TABLE merchants
  ADD COLUMN script_secret text;                          -- HMAC key for /v1/conversion auth
```

Populated lazily on first widget script-tag issuance (or backfilled via a one-shot ops script for existing merchants). Nullable so existing rows pass migration; checked-not-null at the auth boundary.

### 5.4 Ingest routes

Two routes feeding one helper.

1. `POST /v1/conversion` — gtag path
   - Auth: HMAC over payload with the merchant's existing `script_secret`
   - Body: `{ order_id, total_cents, currency, line_items[], visitor_id, occurred_at }`
   - Calls `attributeOrder()`; returns `{ wrote, skipped, miss_reason }`

2. `POST /v1/webhooks/shopify/orders` — webhook path (extends the existing Shopify webhook router)
   - Auth: HMAC verify with the shop's webhook secret
   - Reads `note_attributes.sm_visitor_id`
   - Calls the same `attributeOrder()`

### 5.5 `attributeOrder()` helper

Single source of truth for both routes.

- Find rows in `conversation_sessions` where `visitor_id` matches **and** `ended_at ∈ [occurred_at − 7d, occurred_at]` (treat `ended_at IS NULL` as "still open" → include if `started_at` is in window)
- If any session matches → write **influenced** row with `session_id` = the most recent matching session
- If any matching session has a `recommendation_events` row with `sku ∈ order.line_items[].sku` → write **assisted** row; mark those line_items `was_recommended: true`
- Idempotent: `ON CONFLICT DO NOTHING` on the unique key
- Returns `{ wrote: ['assisted', 'influenced'], skipped: [...], miss_reason: null }`

### 5.6 Widget + runtime instrumentation (additive)

- Persist `sm_visitor_id` to `localStorage` with a 7-day rolling TTL refresh; keep the cookie as fallback for cross-subdomain Shopify checkouts
- Shopify merchants only: on widget init, `PUT /cart.js` with `attributes[sm_visitor_id]=...`
- **Session tracking:** on agent runtime session start (LiveKit room joined + first user turn), insert a `conversation_sessions` row with `{ id: roomId, merchant_id, visitor_id, started_at }`. On session close (existing `agent.session.closed` event in `metricNames`), UPDATE `ended_at`. Wire in `packages/agent/src/runtime.ts` alongside the existing session lifecycle hooks.
- **Recommendation logging:** in `packages/agent/src/runtime.ts`, on every tool call that names a SKU (`pricing.quote`, `site.highlight`, product-card references in tool args), write a `recommendation_events` row tagged with the active `session_id`

### 5.7 Dashboard ROI tiles

Two new tiles in the `/app` KPI grid, inserted before existing tiles:

- **Assisted revenue · 7d** — `$X,XXX` · subtitle `N orders Sage recommended`
- **Influenced revenue · 7d** — `$X,XXX` · subtitle `N orders after a Sage conversation`

Section-level time toggle: **7d / 30d / all-time** (default 7d; state in URL query).

Both tiles link to a new drill-down at `/app/conversions`: table of orders × kind × line items, with recommended SKUs visually marked.

### 5.8 Telemetry

- Counters: `conversion_events_ingested_total{source, kind}`, `conversion_match_misses_total{reason}`
- Miss reasons: `no_visitor_in_window`, `no_recommendation_match`, `merchant_unknown`, `auth_failed`, `duplicate`
- Structured log on every miss: `{ merchant_id, order_id, visitor_id, reason }` — answers "Sage helped but I see nothing" in 10 seconds

### 5.9 Feature flag

None. Routes are net-new; widget changes are additive; no merchant has the gtag installed yet. Ship without a flag.

### 5.10 Plan 7 — out of scope (deferred)

- Backfill of historical orders
- Refund / partial-refund handling on conversion rows
- Multi-currency dashboard rollup math (native currency stored; dashboard shows merchant's default)
- Non-Shopify platform webhooks (Woo, BigCommerce) — those merchants use gtag

## 6. Phase 3 — A7 Gemini Live cost pilot

### 6.1 Goal

Investor-defensible `$ / conversation` figure with 95% CI, plus a pass/fail against the unit-economics floor.

**Pass threshold:** synthetic-cohort upper 95% CI ≤ **$0.30/conv** (Starter $30 / 100 conv → ~33% gross-margin headroom).

### 6.2 Harness

Extend `apps/voice-agent/scripts/voice-smoke.mjs` (or sibling `cost-pilot.mjs`):

- Drive each conversation against the real LiveKit + Gemini Live + Sonnet ambient + Composio stack — no mocks
- Wrap each call with a cost meter capturing: Gemini Live audio-in seconds, audio-out seconds, Sonnet ambient prompt+completion tokens, LiveKit egress minutes, Composio call count
- Emit one JSON row per conversation: `{ conversation_id, duration_s, user_turns, assistant_turns, gemini_cost_usd, sonnet_cost_usd, livekit_cost_usd, composio_cost_usd, total_cost_usd }`

### 6.3 Conversation definition (cost-meter)

A conversation = one LiveKit room session containing ≥1 user turn and ≥1 assistant turn. Connections that drop before the first user turn are logged separately as **abandoned-connect cost** — excluded from the cost-per-conversation denominator.

### 6.4 Synthetic cohort (n = 80)

- Duration distribution: `{30s: 30%, 60s: 30%, 120s: 20%, 240s: 15%, 480s: 5%}`
- User-turn count drawn from `Poisson(λ = duration_s / 25)`
- Intent mix: 30% product-discovery, 30% pricing-Q, 20% policy-Q, 20% off-topic / edge
- Run in batches of 10 with 30s spacing

### 6.5 Real cohort (n = 20)

- Pull from `apps/voice-agent/scripts/pilot-replay.ts` traces if ≥ 20 exist
- Otherwise accumulate from live demo-bot traffic post-DNS cutover (may take days — A7 is sequenced last for this reason)
- Same cost meter, no scripts

### 6.6 Stats & verdict

- Per cohort: mean, sample SD, 95% CI = mean ± 1.96 · SD / √n
- **Divergence check:** if `|real_mean − synth_mean| / synth_mean > 0.5`, the synthetic script distribution is unrealistic. Re-tune duration/turn weights from the real cohort and rerun synthetic. One re-tune permitted; if still divergent, flag for design review.
- **Pass:** synth-cohort upper 95% CI ≤ $0.30/conv AND divergence check holds
- **Fail branch:** spec enumerates operator options (raise Starter price, switch Gemini Live region, drop to Gemini Flash for non-voice turns, increase usage cap) — not pre-decided

### 6.7 Deliverable

`docs/runbooks/2026-05-DD-gemini-cost-pilot.md` with: methodology, raw JSON rows, summary table (cohort × cost-component × CI), pass/fail verdict, recommended pricing action if fail.

## 7. Testing strategy

### Phase 1 — manual acceptance only

A2 runbook is its own checklist. A3–A6 verified by per-item DoD (configuration, not code).

### Phase 2 — three layers

1. **Unit (vitest)** — `attributeOrder()` against the existing test-DB pattern in `packages/db/test`:
   - visitor with no session → no row, miss `no_visitor_in_window`
   - visitor + session in window, no recommendation → 1 `influenced` row
   - visitor + session in window + recommendation matching SKU → 2 rows
   - duplicate ingest → idempotent, `skipped: ['duplicate']`
   - session ended >7d before order → no row
   - currency preservation (cents stay cents; ISO code preserved)

2. **Integration (vitest, existing route-test pattern in `apps/api`)** — both routes end-to-end:
   - `POST /v1/conversion` with valid HMAC → expected rows
   - `POST /v1/conversion` with invalid HMAC → 401; `auth_failed` counter increments
   - Shopify webhook with `note_attributes.sm_visitor_id` → matches, writes rows
   - Webhook with invalid HMAC → 401
   - Both signals for same order → one set of rows (dedupe holds)

3. **Manual E2E smoke** — `docs/runbooks/2026-05-DD-plan7-e2e.md`:
   - Conversation on `shoppingmate.ai` demo bot mentioning a SKU
   - Hand-crafted Shopify webhook payload referencing that SKU → `/v1/webhooks/shopify/orders`
   - `/app` ROI tiles increment within 5s
   - Drill-down shows order with SKU marked recommended

### Phase 3 — methodology validation

Re-run the harness on a snapshotted batch of JSON rows; confirm divergence-check and CI math reproduce. No code tests for the pilot itself.

### Regression guard

Existing Phase 2 71/71 vitest suite must stay green. Run `pnpm test` after every Plan 7 commit.

## 8. Bucket A — done criteria

### Hard gates (all must hold)

- [ ] Phase 1 ops items A2–A6 all green per their individual DoD
- [ ] `phase2-brand-dashboard-complete` git tag exists on origin
- [ ] Plan 7 schema migration applied to production
- [ ] Both ingest routes deployed
- [ ] Widget version-bump rolled out
- [ ] Plan 7 vitest suite green
- [ ] Manual E2E smoke runbook ticked
- [ ] Cost pilot runbook published with synth + real cohorts ≥ defined n
- [ ] Cost pilot verdict = **pass** (upper 95% CI ≤ $0.30/conv) OR explicit operator decision recorded on what pricing/architectural change unblocks pass

### End-to-end "stranger" smoke

Fresh browser, no cookies, no priors:

1. `shoppingmate.ai` → click "Get started" → magic-link signup → land on `/app/onboarding`
2. Stripe Checkout Starter $30 (test mode) → merchant provisioned
3. Connect Shopify dev store via Composio → catalog syncs
4. Paste script tag into a test product page on the dev store
5. Open the test page in a separate browser → converse with widget about a product
6. Place an order for that product in the dev store
7. Return to `/app` → both ROI tiles show the order; drill-down marks SKU recommended

**Target: ≤ 10 minutes from blank browser to attributed sale visible.**

### Out of scope for Bucket A (deferred)

- Cross-device attribution (no email-based stitch)
- Refund / partial-refund handling
- Multi-currency dashboard rollup
- Non-Shopify webhook ingest
- Bucket B / C surface area
