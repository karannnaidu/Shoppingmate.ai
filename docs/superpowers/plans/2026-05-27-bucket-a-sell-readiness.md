# Bucket A — Sell-Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make shoppingmate sellable end-to-end — a stranger can sign up at `shoppingmate.ai`, pay Starter $30, install the script tag, run a real voice conversation, and see the attributed sale in their dashboard.

**Architecture:** Three sequenced phases. Phase 1 is operator work (DNS, secrets, R2, acceptance) that unblocks real-domain testing. Phase 2 is the Plan 7 conversion-attribution engineering (hybrid assisted+influenced, 7-day window, webhook+gtag identity, new schema). Phase 3 is the Gemini Live cost pilot (instrumented harness + 80 synthetic + 20 real conversations, $/conv with 95% CI).

**Tech Stack:** TypeScript / pnpm / Hono (API) / drizzle-orm + Postgres / Next.js 15+ App Router (web, see `web/AGENTS.md` — version differs from training data) / vitest / LiveKit + Gemini Live (voice) / Cloudflare R2 / Resend / Composio Shopify / Stripe.

**Spec:** [`docs/superpowers/specs/2026-05-27-bucket-a-sell-readiness-design.md`](../specs/2026-05-27-bucket-a-sell-readiness-design.md)

---

## File Structure

**Phase 1 — ops (mostly configuration, minimal code):**
- Modify: `apps/api/src/**/*.ts` — grep `openkarta.org` → env-driven defaults
- Tick: `docs/runbooks/2026-05-04-phase2-acceptance.md`
- Create (operator-fill): nothing new — uses existing runbook

**Phase 2 — Plan 7 conversion attribution:**
- Modify: `packages/db/src/schema/conversionEvents.ts` — add attribution columns
- Modify: `packages/db/src/schema/merchants.ts` — add `script_secret`
- Modify: `packages/db/src/schema/index.ts` — export new schemas
- Create: `packages/db/src/schema/conversationSessions.ts` — new sessions table
- Create: `packages/db/src/schema/recommendationEvents.ts` — new table
- Generate: `packages/db/drizzle/0012_*.sql` — drizzle-kit generate
- Create: `apps/api/src/services/attributeOrder.ts` — pure helper
- Create: `apps/api/src/services/attributeOrder.test.ts` — unit tests
- Create: `apps/api/src/routes/conversion.ts` — POST /v1/conversion
- Create: `apps/api/src/routes/conversion.test.ts` — route tests
- Modify: `apps/api/src/routes/webhooks/shopify.ts` — add orders/create handler
- Modify: `apps/api/src/routes/webhooks/shopify.test.ts` — add tests
- Modify: `apps/api/src/index.ts` — register /v1/conversion route
- Modify: `packages/agent/src/runtime.ts` — session + recommendation hooks
- Modify: `packages/widget/src/bootstrap.ts` (and/or `index.ts`) — sm_visitor_id persist + cart.js
- Modify: `web/src/lib/kpi-repo.ts` — query conversion_events for revenue split
- Modify: `web/src/app/app/page.tsx` — replace one KPI tile with two
- Create: `web/src/app/app/revenue/page.tsx` — attribution drill-down
- Modify: `packages/db/src/schema/metricEvents.ts` — add new metric names
- Create: `docs/runbooks/2026-05-DD-plan7-e2e.md` — manual smoke

**Phase 3 — cost pilot:**
- Create: `apps/voice-agent/src/costMeter.ts` — cost calc helper
- Create: `apps/voice-agent/src/costMeter.test.ts` — unit tests
- Create: `apps/voice-agent/scripts/cost-pilot.mjs` — harness extending voice-smoke
- Create: `docs/runbooks/2026-05-DD-gemini-cost-pilot.md` — published runbook

---

## Phase 1 — Ops Punch-list

> Each task is operator action with a Definition-of-Done. Phase 1 may run in any order *internally*, but **A3 (DNS) must complete before A2 (acceptance run on `app.shoppingmate.ai`) and before A4 (Resend domain verification)**.

### Task 1: A3 — DNS records

**Files:** none (registrar UI)

- [ ] **Step 1: Add Vercel records at the `shoppingmate.ai` registrar**

  - Apex `shoppingmate.ai` → A record to Vercel's apex IP (per Vercel project domain UI), OR CNAME if registrar supports apex CNAME flattening
  - `app.shoppingmate.ai` → CNAME `cname.vercel-dns.com` (brand dashboard project)
  - `api.shoppingmate.ai` → CNAME to the Railway API service hostname (copy from Railway → Settings → Networking → Public Domain)
  - `agents.shoppingmate.ai` → CNAME placeholder for Bucket C (same Railway service for now; can repoint later)

- [ ] **Step 2: Add Resend domain verification records**

  In Resend → Domains → Add `shoppingmate.ai`, then paste the records it shows:
  - 3× CNAME (DKIM) under `resend._domainkey…`
  - 1× TXT (SPF): `v=spf1 include:_spf.resend.com ~all` on `shoppingmate.ai`
  - 1× TXT (DMARC): `v=DMARC1; p=none; rua=mailto:alerts@shoppingmate.ai` on `_dmarc.shoppingmate.ai`

- [ ] **Step 3: Wait for propagation (15min–2h)**

  Poll:
  ```bash
  dig +short shoppingmate.ai A
  dig +short app.shoppingmate.ai CNAME
  dig +short api.shoppingmate.ai CNAME
  dig +short shoppingmate.ai TXT
  dig +short _dmarc.shoppingmate.ai TXT
  ```

- [ ] **Step 4: Verify in Vercel + Resend**

  - Vercel: both domains show ✓ Valid Configuration
  - Resend: domain status = Verified (all 5 records green)

- [ ] **Step 5: Final smoke**

  ```bash
  curl -I https://shoppingmate.ai
  curl -I https://app.shoppingmate.ai
  curl -I https://api.shoppingmate.ai/health
  ```
  Expected: each returns `HTTP/2 200` with a valid cert (no warnings).

**DoD:** all four curls return 200; Resend domain shows Verified.

---

### Task 2: A4 — Resend domain switch + sender env

**Files:**
- Modify: `apps/api/src/**/*.ts` (grep targets)
- Modify: Railway env

- [ ] **Step 1: Inventory existing `openkarta.org` references in code**

  ```bash
  grep -rn 'openkarta\.org' apps/ packages/ --include='*.ts'
  ```
  Expected: hits in transactional / ops mailer code paths.

- [ ] **Step 2: Replace hardcodes with env-driven defaults**

  For each hit, replace the literal string with `process.env.RESEND_FROM_TRANSACTIONAL ?? 'hello@shoppingmate.ai'` (or `RESEND_FROM_OPS ?? 'alerts@shoppingmate.ai'` for ops mail). Example pattern:

  ```typescript
  const from = process.env.RESEND_FROM_TRANSACTIONAL ?? 'hello@shoppingmate.ai';
  await resend.emails.send({ from, to, subject, html });
  ```

- [ ] **Step 3: Commit code changes**

  ```bash
  git add apps/ packages/
  git commit -m "fix(mailer): env-driven sender addresses; default shoppingmate.ai"
  ```

- [ ] **Step 4: Set Railway env**

  In Railway → API service → Variables:
  - `RESEND_FROM_TRANSACTIONAL=hello@shoppingmate.ai`
  - `RESEND_FROM_OPS=alerts@shoppingmate.ai`

  Redeploy.

- [ ] **Step 5: Live smoke**

  Trigger magic-link signup from `https://app.shoppingmate.ai/signup` with a personal Gmail. Wait 60s.

  Verify in Gmail:
  - Sender = `hello@shoppingmate.ai`
  - Lands in Primary tab (not Promotions / Spam)
  - Open raw message source → search for `dkim=pass` and `spf=pass`

**DoD:** signup email arrives from new sender; DKIM + SPF both pass; not flagged spam.

---

### Task 3: A5 — R2 token rotate + CORS

**Files:** Cloudflare R2 dashboard + Railway env

- [ ] **Step 1: Identify buckets in use**

  ```bash
  grep -rn 'r2\.cloudflarestorage\.com\|R2_BUCKET\|cf-r2-bucket' apps/ packages/ --include='*.ts'
  ```
  Expected: KB documents bucket, site-graph bucket, chat-history bucket (3 total).

- [ ] **Step 2: Create new R2 API token in Cloudflare**

  Cloudflare dashboard → R2 → Manage R2 API Tokens → Create API Token:
  - Permissions: Object Read & Write
  - Specify bucket → tick only the buckets from Step 1 (no admin scope)
  - TTL: forever

  Copy the Access Key ID + Secret Access Key.

- [ ] **Step 3: Paste new token into Railway env (do not revoke old yet)**

  Railway → API service + worker service → Variables → update:
  - `R2_ACCESS_KEY_ID`
  - `R2_SECRET_ACCESS_KEY`

  Redeploy both services. Verify health.

- [ ] **Step 4: Smoke-test the new token**

  Hit `/app/knowledge` on `app.shoppingmate.ai`, upload a small PDF. Expected: upload succeeds; document shows in list with status `uploaded` → `ready` within a minute.

- [ ] **Step 5: Add CORS policy on each bucket**

  In Cloudflare R2 → each bucket → Settings → CORS Policy → paste:
  ```json
  [
    {
      "AllowedOrigins": [
        "https://shoppingmate.ai",
        "https://app.shoppingmate.ai"
      ],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```

- [ ] **Step 6: Verify CORS lockdown**

  ```bash
  curl -X PUT \
       -H 'Origin: https://example.com' \
       -H 'Content-Type: text/plain' \
       --data 'test' \
       "https://<account>.r2.cloudflarestorage.com/<bucket>/cors-test.txt" \
       -v 2>&1 | grep -i 'access-control-allow-origin'
  ```
  Expected: no `access-control-allow-origin: https://example.com` header in response.

- [ ] **Step 7: Revoke the old R2 token**

  Cloudflare → R2 API Tokens → old token → Revoke.

**DoD:** KB upload still works on new token; CORS rejects random origins; old token revoked.

---

### Task 4: A6 — Composio + Railway secrets paste-and-verify

**Files:** Railway env only

- [ ] **Step 1: Set `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID`**

  Pull the auth-config id from Composio dashboard → Auth Configs → Shopify entry → copy id. Paste into Railway API service → Variables.

- [ ] **Step 2: Verify env inventory against this checklist**

  Confirm every var in the list below has a non-empty value in Railway API service:

  ```
  COMPOSIO_SHOPIFY_AUTH_CONFIG_ID
  COMPOSIO_API_KEY
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
  DATABASE_URL
  REDIS_URL
  JWT_SECRET
  NEXT_PUBLIC_API_BASE_URL
  ```

  Worker service: same minus the `NEXT_PUBLIC_*` and Stripe webhook secret.

- [ ] **Step 3: Redeploy + health**

  ```bash
  curl -sS https://api.shoppingmate.ai/health | jq .
  ```
  Expected: `{ "ok": true, ... }`

- [ ] **Step 4: End-to-end voice-token issuance**

  ```bash
  curl -sS -X POST https://api.shoppingmate.ai/v1/voice/token \
       -H 'Content-Type: application/json' \
       -H 'Origin: https://shoppingmate.ai' \
       -d '{"merchantId":"<demo-merchant-id>"}' | jq .
  ```
  Expected: `{ token: "...", url: "...livekit..." }`

**DoD:** all env vars present; `/health` 200; voice token issues successfully against prod.

---

### Task 5: A2 — Phase 2 acceptance run + release tag

**Files:**
- Modify: `docs/runbooks/2026-05-04-phase2-acceptance.md` (tick boxes + notes)

- [ ] **Step 1: Open the runbook**

  ```bash
  code docs/runbooks/2026-05-04-phase2-acceptance.md
  ```

- [ ] **Step 2: Run all 11 items in order against `app.shoppingmate.ai`**

  Requires Stripe **test mode** keys, Shopify **dev store**, Composio **sandbox** entry. Tick each box as you go. For any item that fails, record the failure under Notes with a one-line reason and a follow-up task id.

- [ ] **Step 3: Commit the ticked runbook**

  ```bash
  git add docs/runbooks/2026-05-04-phase2-acceptance.md
  git commit -m "docs(runbook): Phase 2 acceptance run — all green"
  ```

- [ ] **Step 4: Tag the release**

  ```bash
  git tag phase2-brand-dashboard-complete
  git push origin phase2-brand-dashboard-complete
  ```

  If any item failed in Step 2: **do not tag.** Instead, fix the underlying issue as a hotfix commit, rerun the failed item, then tag.

**DoD:** runbook fully ticked on origin; tag `phase2-brand-dashboard-complete` visible on origin.

---

## Phase 2 — Plan 7 Conversion Attribution

> Phase 2 is gated on Phase 1 completion (real DNS unblocks gtag testing). Engineering work follows TDD: write the failing test, run it, implement, run again, commit.

### Task 6: Schema — define new tables and ALTER existing

**Files:**
- Modify: `packages/db/src/schema/conversionEvents.ts`
- Modify: `packages/db/src/schema/merchants.ts`
- Create: `packages/db/src/schema/conversationSessions.ts`
- Create: `packages/db/src/schema/recommendationEvents.ts`
- Modify: `packages/db/src/schema/index.ts`

- [ ] **Step 1: Create `conversationSessions` schema**

  Create `packages/db/src/schema/conversationSessions.ts`:

  ```typescript
  import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
  import { merchants } from './merchants.js';

  export const conversationSessions = pgTable(
    'conversation_sessions',
    {
      id: text('id').primaryKey(), // LiveKit room id
      merchantId: text('merchant_id')
        .notNull()
        .references(() => merchants.id, { onDelete: 'cascade' }),
      visitorId: text('visitor_id').notNull(),
      startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
      endedAt: timestamp('ended_at', { withTimezone: true }),
    },
    (t) => ({
      merchantVisitorEndedIdx: index('conversation_sessions_merchant_visitor_ended_idx').on(
        t.merchantId,
        t.visitorId,
        t.endedAt.desc(),
      ),
    }),
  );

  export type ConversationSession = typeof conversationSessions.$inferSelect;
  export type NewConversationSession = typeof conversationSessions.$inferInsert;
  ```

- [ ] **Step 2: Create `recommendationEvents` schema**

  Create `packages/db/src/schema/recommendationEvents.ts`:

  ```typescript
  import { bigserial, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
  import { conversationSessions } from './conversationSessions.js';

  export const recommendationEvents = pgTable(
    'recommendation_events',
    {
      id: bigserial('id', { mode: 'number' }).primaryKey(),
      sessionId: text('session_id')
        .notNull()
        .references(() => conversationSessions.id, { onDelete: 'cascade' }),
      sku: text('sku').notNull(),
      kind: text('kind').notNull(), // 'mentioned' | 'highlighted' | 'clicked'
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
      sessionSkuIdx: index('recommendation_events_session_sku_idx').on(t.sessionId, t.sku),
    }),
  );

  export type RecommendationEvent = typeof recommendationEvents.$inferSelect;
  export type NewRecommendationEvent = typeof recommendationEvents.$inferInsert;
  ```

- [ ] **Step 3: Extend `conversionEvents` schema**

  Replace `packages/db/src/schema/conversionEvents.ts` contents:

  ```typescript
  import {
    bigserial,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
  } from 'drizzle-orm/pg-core';
  import { merchants } from './merchants.js';

  export type ConversionLineItem = {
    sku: string;
    quantity: number;
    priceCents: number;
    wasRecommended: boolean;
  };

  export const conversionEvents = pgTable(
    'conversion_events',
    {
      id: bigserial('id', { mode: 'number' }).primaryKey(),
      merchantId: text('merchant_id')
        .notNull()
        .references(() => merchants.id, { onDelete: 'cascade' }),
      sessionId: text('session_id'), // nullable: pointer to conversation_sessions.id; no FK (sessions may roll off)
      orderId: text('order_id').notNull(),
      totalCents: integer('total_cents').notNull(),
      currency: text('currency').notNull(),
      attributionKind: text('attribution_kind').notNull(), // 'assisted' | 'influenced'
      attributionWindowDays: integer('attribution_window_days').notNull(),
      matchSource: text('match_source').notNull(), // 'shopify_webhook' | 'gtag'
      visitorId: text('visitor_id').notNull(),
      lineItems: jsonb('line_items').$type<ConversionLineItem[]>().notNull(),
      occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => ({
      uniqAttribution: uniqueIndex('conversion_events_merchant_order_kind_uniq').on(
        t.merchantId,
        t.orderId,
        t.attributionKind,
      ),
      merchantOccurredIdx: index('conversion_events_merchant_occurred_idx').on(
        t.merchantId,
        t.occurredAt.desc(),
      ),
    }),
  );

  export type ConversionEvent = typeof conversionEvents.$inferSelect;
  export type NewConversionEvent = typeof conversionEvents.$inferInsert;
  ```

- [ ] **Step 4: Add `scriptSecret` to `merchants`**

  In `packages/db/src/schema/merchants.ts`, inside the `pgTable('merchants', { ... })` columns object, add one line near the top (after `name`):

  ```typescript
    scriptSecret: text('script_secret'),
  ```

- [ ] **Step 5: Export new schemas from index**

  In `packages/db/src/schema/index.ts`, append:

  ```typescript
  export * from './conversationSessions.js';
  export * from './recommendationEvents.js';
  ```

- [ ] **Step 6: Commit schema edits**

  ```bash
  git add packages/db/src/schema/
  git commit -m "feat(db): bucket-a schema — conversation_sessions, recommendation_events, conversion_events attribution columns, merchants.script_secret"
  ```

---

### Task 7: Generate + verify drizzle migration

**Files:**
- Generate: `packages/db/drizzle/0012_*.sql`
- Modify: `packages/db/drizzle/meta/_journal.json`

- [ ] **Step 1: Generate migration**

  ```bash
  cd packages/db && pnpm exec drizzle-kit generate
  ```

  Expect a new `0012_*.sql` file plus an updated `_journal.json`.

- [ ] **Step 2: Inspect the generated SQL**

  Open the new `packages/db/drizzle/0012_*.sql`. Verify:
  - `CREATE TABLE conversation_sessions (...)`
  - `CREATE TABLE recommendation_events (...)`
  - `ALTER TABLE conversion_events ADD COLUMN attribution_kind text NOT NULL`, plus the other 6 new columns
  - `CREATE UNIQUE INDEX conversion_events_merchant_order_kind_uniq`
  - `ALTER TABLE merchants ADD COLUMN script_secret text`

  If drizzle-kit emits the NOT NULL adds without defaults against the non-empty `conversion_events` table, manually edit the SQL to first add columns as nullable, then set a backfill default for existing rows, then `SET NOT NULL`. Existing demo rows can be deleted before migration if simpler — note in commit message.

- [ ] **Step 3: Apply migration locally**

  Start local Postgres (see `packages/db/README.md` if needed):

  ```bash
  cd packages/db && pnpm exec drizzle-kit migrate
  ```
  Expected: migration runs without error.

- [ ] **Step 4: Sanity test schema imports**

  ```bash
  cd packages/db && pnpm test -- --run
  ```
  Expected: existing schema tests stay green.

- [ ] **Step 5: Commit migration**

  ```bash
  git add packages/db/drizzle/
  git commit -m "feat(db): generate migration 0012 — bucket-a attribution tables"
  ```

---

### Task 8: `attributeOrder()` helper — TDD

**Files:**
- Create: `apps/api/src/services/attributeOrder.ts`
- Create: `apps/api/src/services/attributeOrder.test.ts`

- [ ] **Step 1: Write the failing test file**

  Create `apps/api/src/services/attributeOrder.test.ts`:

  ```typescript
  import { describe, expect, it, vi, beforeEach } from 'vitest';
  import { attributeOrder, type AttributeOrderDeps, type OrderPayload } from './attributeOrder.js';

  const baseOrder = (): OrderPayload => ({
    merchantId: 'm1',
    orderId: 'ord-1',
    totalCents: 5000,
    currency: 'USD',
    visitorId: 'v1',
    occurredAt: new Date('2026-05-27T10:00:00Z'),
    lineItems: [{ sku: 'SKU-A', quantity: 1, priceCents: 5000 }],
    matchSource: 'gtag',
  });

  function makeDeps(overrides: Partial<AttributeOrderDeps>): AttributeOrderDeps {
    return {
      findRecentSessionsForVisitor: vi.fn().mockResolvedValue([]),
      findRecommendationsForSessionAndSkus: vi.fn().mockResolvedValue([]),
      insertConversion: vi.fn().mockResolvedValue({ inserted: true }),
      attributionWindowDays: 7,
      ...overrides,
    };
  }

  describe('attributeOrder', () => {
    it('returns no rows when visitor has no session in window', async () => {
      const deps = makeDeps({});
      const result = await attributeOrder(baseOrder(), deps);
      expect(result.wrote).toEqual([]);
      expect(result.missReason).toBe('no_visitor_in_window');
      expect(deps.insertConversion).not.toHaveBeenCalled();
    });

    it('writes influenced row when visitor has session in window but no recommendation match', async () => {
      const deps = makeDeps({
        findRecentSessionsForVisitor: vi.fn().mockResolvedValue([
          { id: 'sess-1', endedAt: new Date('2026-05-26T10:00:00Z') },
        ]),
      });
      const result = await attributeOrder(baseOrder(), deps);
      expect(result.wrote).toEqual(['influenced']);
      expect(deps.insertConversion).toHaveBeenCalledTimes(1);
      const [row] = (deps.insertConversion as any).mock.calls[0];
      expect(row.attributionKind).toBe('influenced');
      expect(row.sessionId).toBe('sess-1');
      expect(row.lineItems[0].wasRecommended).toBe(false);
    });

    it('writes both assisted and influenced when recommendation matches', async () => {
      const deps = makeDeps({
        findRecentSessionsForVisitor: vi.fn().mockResolvedValue([
          { id: 'sess-1', endedAt: new Date('2026-05-26T10:00:00Z') },
        ]),
        findRecommendationsForSessionAndSkus: vi.fn().mockResolvedValue([
          { sessionId: 'sess-1', sku: 'SKU-A' },
        ]),
      });
      const result = await attributeOrder(baseOrder(), deps);
      expect(result.wrote.sort()).toEqual(['assisted', 'influenced']);
      expect(deps.insertConversion).toHaveBeenCalledTimes(2);
      const assistedRow = (deps.insertConversion as any).mock.calls.find(
        ([r]: any[]) => r.attributionKind === 'assisted',
      )[0];
      expect(assistedRow.lineItems[0].wasRecommended).toBe(true);
    });

    it('is idempotent: skips when insert returns inserted=false', async () => {
      const deps = makeDeps({
        findRecentSessionsForVisitor: vi.fn().mockResolvedValue([
          { id: 'sess-1', endedAt: new Date('2026-05-26T10:00:00Z') },
        ]),
        insertConversion: vi.fn().mockResolvedValue({ inserted: false }),
      });
      const result = await attributeOrder(baseOrder(), deps);
      expect(result.wrote).toEqual([]);
      expect(result.skipped).toEqual(['influenced']);
    });

    it('excludes sessions ended outside the 7d window', async () => {
      const deps = makeDeps({
        findRecentSessionsForVisitor: vi.fn().mockResolvedValue([]), // repo filters by window
      });
      const result = await attributeOrder(baseOrder(), deps);
      expect(result.missReason).toBe('no_visitor_in_window');
    });

    it('picks the most recent session for influenced attribution', async () => {
      const older = { id: 'sess-old', endedAt: new Date('2026-05-22T10:00:00Z') };
      const newer = { id: 'sess-new', endedAt: new Date('2026-05-26T10:00:00Z') };
      const deps = makeDeps({
        findRecentSessionsForVisitor: vi.fn().mockResolvedValue([newer, older]),
      });
      const result = await attributeOrder(baseOrder(), deps);
      expect(result.wrote).toEqual(['influenced']);
      const [row] = (deps.insertConversion as any).mock.calls[0];
      expect(row.sessionId).toBe('sess-new');
    });
  });
  ```

- [ ] **Step 2: Run the failing test**

  ```bash
  cd apps/api && pnpm test -- attributeOrder --run
  ```
  Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

  Create `apps/api/src/services/attributeOrder.ts`:

  ```typescript
  import type { ConversionLineItem, NewConversionEvent } from '@shoppingmate/db';

  export type OrderPayload = {
    merchantId: string;
    orderId: string;
    totalCents: number;
    currency: string;
    visitorId: string;
    occurredAt: Date;
    lineItems: Array<Pick<ConversionLineItem, 'sku' | 'quantity' | 'priceCents'>>;
    matchSource: 'shopify_webhook' | 'gtag';
  };

  export type SessionRow = { id: string; endedAt: Date | null };
  export type RecommendationRow = { sessionId: string; sku: string };

  export type AttributeOrderDeps = {
    findRecentSessionsForVisitor: (args: {
      merchantId: string;
      visitorId: string;
      windowEnd: Date;
      windowStart: Date;
    }) => Promise<SessionRow[]>;
    findRecommendationsForSessionAndSkus: (args: {
      sessionIds: string[];
      skus: string[];
    }) => Promise<RecommendationRow[]>;
    insertConversion: (row: NewConversionEvent) => Promise<{ inserted: boolean }>;
    attributionWindowDays: number;
  };

  export type AttributeResult = {
    wrote: Array<'assisted' | 'influenced'>;
    skipped: Array<'assisted' | 'influenced'>;
    missReason: 'no_visitor_in_window' | 'no_recommendation_match' | null;
  };

  export async function attributeOrder(
    order: OrderPayload,
    deps: AttributeOrderDeps,
  ): Promise<AttributeResult> {
    const windowMs = deps.attributionWindowDays * 24 * 3600 * 1000;
    const windowEnd = order.occurredAt;
    const windowStart = new Date(windowEnd.getTime() - windowMs);

    const sessions = await deps.findRecentSessionsForVisitor({
      merchantId: order.merchantId,
      visitorId: order.visitorId,
      windowEnd,
      windowStart,
    });

    if (sessions.length === 0) {
      return { wrote: [], skipped: [], missReason: 'no_visitor_in_window' };
    }

    // Most recent first
    const sorted = [...sessions].sort((a, b) => {
      const ae = a.endedAt?.getTime() ?? a.endedAt === null ? Date.now() : 0;
      const be = b.endedAt?.getTime() ?? b.endedAt === null ? Date.now() : 0;
      return be - ae;
    });
    const mostRecent = sorted[0]!;

    const skus = order.lineItems.map((li) => li.sku);
    const recs = await deps.findRecommendationsForSessionAndSkus({
      sessionIds: sorted.map((s) => s.id),
      skus,
    });
    const recommendedSkus = new Set(recs.map((r) => r.sku));
    const hasAssistedMatch = recs.length > 0;

    const wrote: Array<'assisted' | 'influenced'> = [];
    const skipped: Array<'assisted' | 'influenced'> = [];

    const baseRow = {
      merchantId: order.merchantId,
      orderId: order.orderId,
      totalCents: order.totalCents,
      currency: order.currency,
      visitorId: order.visitorId,
      occurredAt: order.occurredAt,
      matchSource: order.matchSource,
      attributionWindowDays: deps.attributionWindowDays,
      sessionId: mostRecent.id,
    } as const;

    // Influenced row (always when a session matches)
    {
      const lineItems: ConversionLineItem[] = order.lineItems.map((li) => ({
        ...li,
        wasRecommended: false,
      }));
      const out = await deps.insertConversion({
        ...baseRow,
        attributionKind: 'influenced',
        lineItems,
      });
      if (out.inserted) wrote.push('influenced');
      else skipped.push('influenced');
    }

    // Assisted row (only when at least one line item was recommended)
    if (hasAssistedMatch) {
      const lineItems: ConversionLineItem[] = order.lineItems.map((li) => ({
        ...li,
        wasRecommended: recommendedSkus.has(li.sku),
      }));
      const out = await deps.insertConversion({
        ...baseRow,
        attributionKind: 'assisted',
        lineItems,
      });
      if (out.inserted) wrote.push('assisted');
      else skipped.push('assisted');
    }

    const missReason = hasAssistedMatch ? null : ('no_recommendation_match' as const);
    // Note: a no_recommendation_match miss is non-fatal — we still wrote the influenced row.
    // Routes should ignore missReason if wrote.length > 0; it's only informational here.
    return { wrote, skipped, missReason: wrote.length === 0 ? 'no_visitor_in_window' : missReason };
  }
  ```

- [ ] **Step 4: Run the test to verify it passes**

  ```bash
  cd apps/api && pnpm test -- attributeOrder --run
  ```
  Expected: PASS (all 6 cases).

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/services/attributeOrder.ts apps/api/src/services/attributeOrder.test.ts
  git commit -m "feat(api): attributeOrder helper — hybrid assisted+influenced attribution"
  ```

---

### Task 9: `POST /v1/conversion` route — TDD

**Files:**
- Create: `apps/api/src/routes/conversion.ts`
- Create: `apps/api/src/routes/conversion.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the failing route test**

  Create `apps/api/src/routes/conversion.test.ts`:

  ```typescript
  import { describe, expect, it, vi } from 'vitest';
  import { handleConversionIngest, computeHmac } from './conversion.js';

  describe('POST /v1/conversion handler', () => {
    const secret = 'shh-secret';
    const validBody = JSON.stringify({
      merchantId: 'm1',
      orderId: 'ord-1',
      totalCents: 5000,
      currency: 'USD',
      visitorId: 'v1',
      occurredAt: '2026-05-27T10:00:00Z',
      lineItems: [{ sku: 'SKU-A', quantity: 1, priceCents: 5000 }],
    });

    it('rejects missing HMAC header', async () => {
      const out = await handleConversionIngest({
        rawBody: validBody,
        hmacHeader: '',
        lookupMerchantSecret: async () => secret,
        attribute: vi.fn(),
      });
      expect(out.status).toBe(401);
      expect(out.body.error).toBe('auth_failed');
    });

    it('rejects bad HMAC', async () => {
      const out = await handleConversionIngest({
        rawBody: validBody,
        hmacHeader: 'definitely-wrong',
        lookupMerchantSecret: async () => secret,
        attribute: vi.fn(),
      });
      expect(out.status).toBe(401);
    });

    it('rejects unknown merchant', async () => {
      const out = await handleConversionIngest({
        rawBody: validBody,
        hmacHeader: computeHmac(validBody, 'whatever'),
        lookupMerchantSecret: async () => null,
        attribute: vi.fn(),
      });
      expect(out.status).toBe(404);
      expect(out.body.error).toBe('merchant_unknown');
    });

    it('accepts valid HMAC and invokes attribute()', async () => {
      const attribute = vi.fn().mockResolvedValue({ wrote: ['influenced'], skipped: [], missReason: null });
      const out = await handleConversionIngest({
        rawBody: validBody,
        hmacHeader: computeHmac(validBody, secret),
        lookupMerchantSecret: async () => secret,
        attribute,
      });
      expect(out.status).toBe(200);
      expect(out.body.wrote).toEqual(['influenced']);
      expect(attribute).toHaveBeenCalledOnce();
      const [order] = attribute.mock.calls[0]!;
      expect(order.merchantId).toBe('m1');
      expect(order.matchSource).toBe('gtag');
    });

    it('returns 400 on malformed body', async () => {
      const bad = '{not json';
      const out = await handleConversionIngest({
        rawBody: bad,
        hmacHeader: computeHmac(bad, secret),
        lookupMerchantSecret: async () => secret,
        attribute: vi.fn(),
      });
      expect(out.status).toBe(400);
    });
  });
  ```

- [ ] **Step 2: Run failing test**

  ```bash
  cd apps/api && pnpm test -- conversion --run
  ```
  Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route handler**

  Create `apps/api/src/routes/conversion.ts`:

  ```typescript
  import { Hono } from 'hono';
  import { createHmac, timingSafeEqual } from 'node:crypto';
  import { db, schema } from '@shoppingmate/db';
  import { and, eq, gte, inArray } from 'drizzle-orm';
  import { attributeOrder, type OrderPayload, type AttributeResult } from '../services/attributeOrder.js';

  export function computeHmac(rawBody: string, secret: string): string {
    return createHmac('sha256', secret).update(rawBody).digest('base64');
  }

  function safeEqual(a: string, b: string): boolean {
    try {
      const ab = Buffer.from(a);
      const bb = Buffer.from(b);
      if (ab.length !== bb.length) return false;
      return timingSafeEqual(ab, bb);
    } catch {
      return false;
    }
  }

  export type ConversionIngestArgs = {
    rawBody: string;
    hmacHeader: string;
    lookupMerchantSecret: (merchantId: string) => Promise<string | null>;
    attribute: (order: OrderPayload) => Promise<AttributeResult>;
  };

  export type ConversionIngestResponse = {
    status: number;
    body: { ok?: true; error?: string; wrote?: AttributeResult['wrote']; missReason?: string | null };
  };

  export async function handleConversionIngest(
    args: ConversionIngestArgs,
  ): Promise<ConversionIngestResponse> {
    if (!args.hmacHeader) return { status: 401, body: { error: 'auth_failed' } };

    let payload: any;
    try {
      payload = JSON.parse(args.rawBody);
    } catch {
      return { status: 400, body: { error: 'invalid_json' } };
    }
    if (!payload?.merchantId || !payload?.orderId || !payload?.visitorId) {
      return { status: 400, body: { error: 'missing_fields' } };
    }

    const secret = await args.lookupMerchantSecret(payload.merchantId);
    if (!secret) return { status: 404, body: { error: 'merchant_unknown' } };

    const expected = computeHmac(args.rawBody, secret);
    if (!safeEqual(expected, args.hmacHeader)) {
      return { status: 401, body: { error: 'auth_failed' } };
    }

    const order: OrderPayload = {
      merchantId: payload.merchantId,
      orderId: String(payload.orderId),
      totalCents: Number(payload.totalCents),
      currency: String(payload.currency ?? 'USD'),
      visitorId: payload.visitorId,
      occurredAt: new Date(payload.occurredAt ?? Date.now()),
      lineItems: Array.isArray(payload.lineItems)
        ? payload.lineItems.map((li: any) => ({
            sku: String(li.sku),
            quantity: Number(li.quantity ?? 1),
            priceCents: Number(li.priceCents ?? 0),
          }))
        : [],
      matchSource: 'gtag',
    };

    const result = await args.attribute(order);
    return { status: 200, body: { ok: true, wrote: result.wrote, missReason: result.missReason } };
  }

  // Default repo wiring for production use; the handler above stays pure for tests.
  export async function defaultLookupMerchantSecret(merchantId: string): Promise<string | null> {
    const row = await db.query.merchants.findFirst({
      where: eq(schema.merchants.id, merchantId),
    });
    return row?.scriptSecret ?? null;
  }

  export async function defaultAttribute(order: OrderPayload): Promise<AttributeResult> {
    return attributeOrder(order, {
      attributionWindowDays: 7,
      findRecentSessionsForVisitor: async ({ merchantId, visitorId, windowStart, windowEnd }) => {
        const rows = await db
          .select({ id: schema.conversationSessions.id, endedAt: schema.conversationSessions.endedAt })
          .from(schema.conversationSessions)
          .where(
            and(
              eq(schema.conversationSessions.merchantId, merchantId),
              eq(schema.conversationSessions.visitorId, visitorId),
              gte(schema.conversationSessions.startedAt, windowStart),
            ),
          );
        return rows.filter(
          (r) => (r.endedAt === null && true) || (r.endedAt !== null && r.endedAt <= windowEnd),
        );
      },
      findRecommendationsForSessionAndSkus: async ({ sessionIds, skus }) => {
        if (sessionIds.length === 0 || skus.length === 0) return [];
        const rows = await db
          .select({
            sessionId: schema.recommendationEvents.sessionId,
            sku: schema.recommendationEvents.sku,
          })
          .from(schema.recommendationEvents)
          .where(
            and(
              inArray(schema.recommendationEvents.sessionId, sessionIds),
              inArray(schema.recommendationEvents.sku, skus),
            ),
          );
        return rows;
      },
      insertConversion: async (row) => {
        const inserted = await db
          .insert(schema.conversionEvents)
          .values(row)
          .onConflictDoNothing({
            target: [
              schema.conversionEvents.merchantId,
              schema.conversionEvents.orderId,
              schema.conversionEvents.attributionKind,
            ],
          })
          .returning({ id: schema.conversionEvents.id });
        return { inserted: inserted.length > 0 };
      },
    });
  }

  export const conversionRoute = new Hono();

  conversionRoute.post('/', async (c) => {
    const rawBody = await c.req.text();
    const hmacHeader = c.req.header('X-SM-Signature') ?? '';
    const out = await handleConversionIngest({
      rawBody,
      hmacHeader,
      lookupMerchantSecret: defaultLookupMerchantSecret,
      attribute: defaultAttribute,
    });
    return c.json(out.body, out.status as 200 | 400 | 401 | 404);
  });
  ```

- [ ] **Step 4: Run test to verify passing**

  ```bash
  cd apps/api && pnpm test -- conversion --run
  ```
  Expected: PASS (all 5 cases).

- [ ] **Step 5: Register the route in `apps/api/src/index.ts`**

  Locate the existing route registration block (where `voiceTokenRoute`, `siteGraphRoute`, etc. are mounted). Add:

  ```typescript
  import { conversionRoute } from './routes/conversion.js';
  // ...
  app.route('/v1/conversion', conversionRoute);
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add apps/api/src/routes/conversion.ts apps/api/src/routes/conversion.test.ts apps/api/src/index.ts
  git commit -m "feat(api): POST /v1/conversion — HMAC-auth gtag attribution ingest"
  ```

---

### Task 10: Extend Shopify webhook for `orders/create`

**Files:**
- Modify: `apps/api/src/routes/webhooks/shopify.ts`
- Modify: `apps/api/src/routes/webhooks/shopify.test.ts`

- [ ] **Step 1: Add failing test for orders/create**

  Append to `apps/api/src/routes/webhooks/shopify.test.ts`:

  ```typescript
  import { handleShopifyOrderWebhook } from './shopify.js';

  describe('Shopify orders/create webhook', () => {
    const validBody = JSON.stringify({
      id: 12345,
      order_number: 'ORD-1',
      total_price: '50.00',
      currency: 'USD',
      created_at: '2026-05-27T10:00:00Z',
      line_items: [{ sku: 'SKU-A', quantity: 1, price: '50.00' }],
      note_attributes: [{ name: 'sm_visitor_id', value: 'v1' }],
    });

    it('verifies signature and calls attribute() with extracted visitor id', async () => {
      const attribute = vi.fn().mockResolvedValue({ wrote: ['influenced'], skipped: [], missReason: null });
      const out = await handleShopifyOrderWebhook({
        rawBody: validBody,
        hmacHeader: 'abc',
        shopDomain: 'x.myshopify.com',
        lookupMerchantId: async () => 'm1',
        verifyHmac: () => true,
        attribute,
      });
      expect(out.status).toBe(200);
      expect(attribute).toHaveBeenCalledOnce();
      const [order] = attribute.mock.calls[0]!;
      expect(order.merchantId).toBe('m1');
      expect(order.orderId).toBe('12345');
      expect(order.visitorId).toBe('v1');
      expect(order.matchSource).toBe('shopify_webhook');
      expect(order.totalCents).toBe(5000);
      expect(order.lineItems).toEqual([{ sku: 'SKU-A', quantity: 1, priceCents: 5000 }]);
    });

    it('rejects bad signature with 401', async () => {
      const out = await handleShopifyOrderWebhook({
        rawBody: validBody, hmacHeader: 'bad', shopDomain: 'x.myshopify.com',
        lookupMerchantId: async () => 'm1',
        verifyHmac: () => false,
        attribute: vi.fn(),
      });
      expect(out.status).toBe(401);
    });

    it('returns 200 with no_visitor when sm_visitor_id missing', async () => {
      const body = JSON.stringify({ id: 1, total_price: '5.00', currency: 'USD', created_at: '2026-05-27T10:00:00Z', line_items: [] });
      const attribute = vi.fn();
      const out = await handleShopifyOrderWebhook({
        rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
        lookupMerchantId: async () => 'm1',
        verifyHmac: () => true,
        attribute,
      });
      expect(out.status).toBe(200);
      expect(out.body?.skipped).toBe('no_visitor_id');
      expect(attribute).not.toHaveBeenCalled();
    });
  });
  ```

- [ ] **Step 2: Run failing test**

  ```bash
  cd apps/api && pnpm test -- shopify --run
  ```
  Expected: FAIL — `handleShopifyOrderWebhook` not exported.

- [ ] **Step 3: Implement the order webhook handler**

  Append to `apps/api/src/routes/webhooks/shopify.ts` (before the route declarations near the bottom):

  ```typescript
  import { defaultAttribute } from '../conversion.js';
  import type { OrderPayload } from '../../services/attributeOrder.js';
  import type { AttributeResult } from '../../services/attributeOrder.js';

  export type ShopifyOrderWebhookArgs = {
    rawBody: string;
    hmacHeader: string;
    shopDomain: string;
    lookupMerchantId: (domain: string) => Promise<string | null>;
    verifyHmac: (rawBody: string, hmacHeader: string) => boolean;
    attribute: (order: OrderPayload) => Promise<AttributeResult>;
  };

  export type ShopifyOrderWebhookResponse = {
    status: number;
    body?: { ok?: true; wrote?: string[]; skipped?: string; error?: string };
  };

  function dollarsToCents(amount: string | number): number {
    const n = typeof amount === 'number' ? amount : parseFloat(amount);
    return Math.round(n * 100);
  }

  export async function handleShopifyOrderWebhook(
    args: ShopifyOrderWebhookArgs,
  ): Promise<ShopifyOrderWebhookResponse> {
    if (!args.verifyHmac(args.rawBody, args.hmacHeader)) return { status: 401, body: { error: 'auth_failed' } };

    const merchantId = await args.lookupMerchantId(args.shopDomain);
    if (!merchantId) return { status: 404, body: { error: 'merchant_unknown' } };

    let payload: any;
    try {
      payload = JSON.parse(args.rawBody);
    } catch {
      return { status: 400, body: { error: 'invalid_json' } };
    }

    const attrs: Array<{ name: string; value: string }> = payload.note_attributes ?? [];
    const visitorId = attrs.find((a) => a.name === 'sm_visitor_id')?.value;
    if (!visitorId) {
      return { status: 200, body: { ok: true, skipped: 'no_visitor_id' } };
    }

    const order: OrderPayload = {
      merchantId,
      orderId: String(payload.id),
      totalCents: dollarsToCents(payload.total_price ?? '0'),
      currency: String(payload.currency ?? 'USD'),
      visitorId,
      occurredAt: new Date(payload.created_at ?? Date.now()),
      lineItems: (payload.line_items ?? []).map((li: any) => ({
        sku: String(li.sku ?? ''),
        quantity: Number(li.quantity ?? 1),
        priceCents: dollarsToCents(li.price ?? '0'),
      })),
      matchSource: 'shopify_webhook',
    };

    const result = await args.attribute(order);
    return { status: 200, body: { ok: true, wrote: result.wrote } };
  }
  ```

  Then add a new route below the existing `/products/update` handler:

  ```typescript
  shopifyWebhookRoute.post('/orders/create', async (c) => {
    const rawBody = await c.req.text();
    const hmacHeader = c.req.header('X-Shopify-Hmac-SHA256') ?? '';
    const shopDomain = c.req.header('X-Shopify-Shop-Domain') ?? '';
    const out = await handleShopifyOrderWebhook({
      rawBody, hmacHeader, shopDomain,
      lookupMerchantId: async (d) => {
        const row = await db.query.merchants.findFirst({ where: eq(schema.merchants.domain, d) });
        return row?.id ?? null;
      },
      verifyHmac: defaultVerifyHmac,
      attribute: defaultAttribute,
    });
    return c.json(out.body ?? {}, out.status as 200 | 400 | 401 | 404);
  });
  ```

- [ ] **Step 4: Run test to verify passing**

  ```bash
  cd apps/api && pnpm test -- shopify --run
  ```
  Expected: PASS (existing + 3 new cases).

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/routes/webhooks/shopify.ts apps/api/src/routes/webhooks/shopify.test.ts
  git commit -m "feat(api): Shopify orders/create webhook → attributeOrder"
  ```

---

### Task 11: Conversation session lifecycle in agent runtime

**Files:**
- Modify: `packages/agent/src/runtime.ts`
- Modify: `packages/agent/src/runtime.test.ts` (if exists) or create

- [ ] **Step 1: Read the existing runtime to find the session-start / session-close hooks**

  ```bash
  cat packages/agent/src/runtime.ts | head -100
  ```
  Locate the function that starts a session (LiveKit room joined + first turn) and the one that closes it (likely emitting `metricNames.agentSessionClosed`).

- [ ] **Step 2: Add an injected `sessionStore` interface**

  Near the top of `packages/agent/src/runtime.ts`, add:

  ```typescript
  export type SessionStore = {
    openSession: (args: { sessionId: string; merchantId: string; visitorId: string }) => Promise<void>;
    closeSession: (args: { sessionId: string }) => Promise<void>;
  };

  export type RecommendationStore = {
    logRecommendation: (args: {
      sessionId: string;
      sku: string;
      kind: 'mentioned' | 'highlighted' | 'clicked';
    }) => Promise<void>;
  };
  ```

  Thread both into whatever runtime-construction function exists (`createAgentRuntime` / equivalent) as additional dependency-injected parameters.

- [ ] **Step 3: Wire `openSession` at session-start, `closeSession` at session-close**

  At the existing point where a session-start observable event fires (e.g., after the LiveKit room confirms agent join and the first user turn dispatches), add:

  ```typescript
  await deps.sessionStore.openSession({
    sessionId: roomId,
    merchantId,
    visitorId,
  });
  ```

  At the existing point where `agent.session.closed` metric emits:

  ```typescript
  await deps.sessionStore.closeSession({ sessionId: roomId });
  ```

- [ ] **Step 4: Write a focused test for the wiring**

  In `packages/agent/src/runtime.test.ts` (create or extend), add a test that constructs the runtime with mock `sessionStore`, simulates a session-start event, and asserts `openSession` was called with the expected args. Then simulate close and assert `closeSession` was called.

  Pattern (adapt to actual runtime construction):

  ```typescript
  it('opens and closes a conversation session', async () => {
    const sessionStore: SessionStore = {
      openSession: vi.fn().mockResolvedValue(undefined),
      closeSession: vi.fn().mockResolvedValue(undefined),
    };
    const runtime = createAgentRuntime({ /* existing deps */, sessionStore, recommendationStore: /* mock */ });
    await runtime.handleSessionStart({ roomId: 'r1', merchantId: 'm1', visitorId: 'v1' });
    expect(sessionStore.openSession).toHaveBeenCalledWith({ sessionId: 'r1', merchantId: 'm1', visitorId: 'v1' });
    await runtime.handleSessionClose({ roomId: 'r1' });
    expect(sessionStore.closeSession).toHaveBeenCalledWith({ sessionId: 'r1' });
  });
  ```

- [ ] **Step 5: Implement the default repo bindings**

  In `apps/voice-agent` (the runtime consumer) or wherever the runtime is wired, supply:

  ```typescript
  import { db, schema } from '@shoppingmate/db';
  import { eq } from 'drizzle-orm';

  const sessionStore: SessionStore = {
    openSession: async ({ sessionId, merchantId, visitorId }) => {
      await db
        .insert(schema.conversationSessions)
        .values({ id: sessionId, merchantId, visitorId, startedAt: new Date() })
        .onConflictDoNothing();
    },
    closeSession: async ({ sessionId }) => {
      await db
        .update(schema.conversationSessions)
        .set({ endedAt: new Date() })
        .where(eq(schema.conversationSessions.id, sessionId));
    },
  };
  ```

- [ ] **Step 6: Run tests**

  ```bash
  cd packages/agent && pnpm test -- --run
  ```
  Expected: PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/agent/src/runtime.ts packages/agent/src/runtime.test.ts apps/voice-agent/
  git commit -m "feat(agent): write conversation_sessions rows on session start/close"
  ```

---

### Task 12: Recommendation logging in agent runtime

**Files:**
- Modify: `packages/agent/src/runtime.ts`
- Modify: `packages/agent/src/runtime.test.ts`

- [ ] **Step 1: Find the tool-dispatch path**

  ```bash
  grep -n 'pricing\.quote\|site\.highlight\|toolCall\|dispatchTool' packages/agent/src/runtime.ts
  ```

- [ ] **Step 2: Add a SKU-extraction helper and recommendation log call**

  In `packages/agent/src/runtime.ts`, add near the tool-dispatch code:

  ```typescript
  function extractSkuFromToolCall(toolName: string, args: Record<string, unknown>): { sku: string; kind: 'mentioned' | 'highlighted' | 'clicked' } | null {
    if (toolName === 'pricing.quote' && typeof args.plan_id === 'string') {
      return { sku: args.plan_id, kind: 'mentioned' };
    }
    if (toolName === 'site.highlight' && typeof args.sku === 'string') {
      return { sku: args.sku, kind: 'highlighted' };
    }
    if (toolName === 'product.show' && typeof args.sku === 'string') {
      return { sku: args.sku, kind: 'mentioned' };
    }
    // Add more tool→SKU mappings here as new tools land.
    return null;
  }
  ```

  At the point a tool call is dispatched, wrap:

  ```typescript
  const rec = extractSkuFromToolCall(toolName, toolArgs);
  if (rec && currentSessionId) {
    await deps.recommendationStore.logRecommendation({
      sessionId: currentSessionId,
      sku: rec.sku,
      kind: rec.kind,
    });
  }
  ```

- [ ] **Step 3: Add a test**

  Add to `packages/agent/src/runtime.test.ts`:

  ```typescript
  it('logs a recommendation when pricing.quote is invoked', async () => {
    const recommendationStore = {
      logRecommendation: vi.fn().mockResolvedValue(undefined),
    };
    const runtime = createAgentRuntime({ /* existing */, recommendationStore });
    await runtime.handleSessionStart({ roomId: 'r1', merchantId: 'm1', visitorId: 'v1' });
    await runtime.handleToolCall({ name: 'pricing.quote', args: { plan_id: 'STARTER' } });
    expect(recommendationStore.logRecommendation).toHaveBeenCalledWith({
      sessionId: 'r1',
      sku: 'STARTER',
      kind: 'mentioned',
    });
  });
  ```

- [ ] **Step 4: Implement the default repo binding**

  Alongside `sessionStore` in the voice-agent wiring:

  ```typescript
  const recommendationStore: RecommendationStore = {
    logRecommendation: async ({ sessionId, sku, kind }) => {
      await db.insert(schema.recommendationEvents).values({ sessionId, sku, kind });
    },
  };
  ```

- [ ] **Step 5: Run tests + commit**

  ```bash
  cd packages/agent && pnpm test -- --run
  git add packages/agent/ apps/voice-agent/
  git commit -m "feat(agent): log recommendation_events on tool calls that name a SKU"
  ```

---

### Task 13: Widget — persist `sm_visitor_id` to localStorage

**Files:**
- Modify: `packages/widget/src/bootstrap.ts` (or `index.ts` — see Step 1)
- Create or extend: `packages/widget/src/identity.ts` + `identity.test.ts`

- [ ] **Step 1: Find current widget bootstrap**

  ```bash
  grep -n 'visitor\|init\|bootstrap' packages/widget/src/bootstrap.ts packages/widget/src/index.ts
  ```

- [ ] **Step 2: Write the failing identity-helper test**

  Create `packages/widget/src/identity.test.ts`:

  ```typescript
  import { describe, expect, it, beforeEach, vi } from 'vitest';
  import { getOrCreateVisitorId, VISITOR_ID_KEY, VISITOR_ID_TTL_MS } from './identity.js';

  describe('getOrCreateVisitorId', () => {
    beforeEach(() => {
      localStorage.clear();
      document.cookie = `${VISITOR_ID_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    });

    it('returns a new id when none exists', () => {
      const id = getOrCreateVisitorId();
      expect(id).toMatch(/^v_[a-z0-9]+$/);
      expect(localStorage.getItem(VISITOR_ID_KEY)).toBeTruthy();
    });

    it('returns the existing id from localStorage when fresh', () => {
      localStorage.setItem(VISITOR_ID_KEY, JSON.stringify({ id: 'v_abc', expiresAt: Date.now() + VISITOR_ID_TTL_MS }));
      expect(getOrCreateVisitorId()).toBe('v_abc');
    });

    it('regenerates when stored id is expired', () => {
      localStorage.setItem(VISITOR_ID_KEY, JSON.stringify({ id: 'v_old', expiresAt: Date.now() - 1 }));
      const id = getOrCreateVisitorId();
      expect(id).not.toBe('v_old');
    });

    it('refreshes the TTL on every read (rolling)', () => {
      localStorage.setItem(VISITOR_ID_KEY, JSON.stringify({ id: 'v_x', expiresAt: Date.now() + 1000 }));
      getOrCreateVisitorId();
      const stored = JSON.parse(localStorage.getItem(VISITOR_ID_KEY)!);
      expect(stored.expiresAt).toBeGreaterThan(Date.now() + VISITOR_ID_TTL_MS - 1000);
    });
  });
  ```

- [ ] **Step 3: Run failing test**

  ```bash
  cd packages/widget && pnpm test -- identity --run
  ```
  Expected: FAIL.

- [ ] **Step 4: Implement `identity.ts`**

  Create `packages/widget/src/identity.ts`:

  ```typescript
  export const VISITOR_ID_KEY = 'sm_visitor_id';
  export const VISITOR_ID_TTL_MS = 7 * 24 * 3600 * 1000;

  type Stored = { id: string; expiresAt: number };

  function generate(): string {
    // 16 hex chars of crypto random
    const buf = new Uint8Array(8);
    (globalThis.crypto ?? window.crypto).getRandomValues(buf);
    const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
    return `v_${hex}`;
  }

  function readStored(): Stored | null {
    try {
      const raw = localStorage.getItem(VISITOR_ID_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Stored;
      if (!parsed?.id || typeof parsed.expiresAt !== 'number') return null;
      return parsed;
    } catch {
      return null;
    }
  }

  function writeStored(s: Stored): void {
    try {
      localStorage.setItem(VISITOR_ID_KEY, JSON.stringify(s));
      // Cookie fallback for cross-subdomain Shopify checkouts
      const maxAgeSec = Math.floor(VISITOR_ID_TTL_MS / 1000);
      document.cookie = `${VISITOR_ID_KEY}=${s.id}; max-age=${maxAgeSec}; path=/; SameSite=Lax`;
    } catch {
      /* swallow — private mode etc. */
    }
  }

  export function getOrCreateVisitorId(): string {
    const now = Date.now();
    const stored = readStored();
    if (stored && stored.expiresAt > now) {
      writeStored({ id: stored.id, expiresAt: now + VISITOR_ID_TTL_MS });
      return stored.id;
    }
    const id = generate();
    writeStored({ id, expiresAt: now + VISITOR_ID_TTL_MS });
    return id;
  }
  ```

- [ ] **Step 5: Run test to verify passing**

  ```bash
  cd packages/widget && pnpm test -- identity --run
  ```
  Expected: PASS.

- [ ] **Step 6: Wire into widget bootstrap**

  In `packages/widget/src/bootstrap.ts` (or `index.ts` — the entry that runs on script load), import and call early:

  ```typescript
  import { getOrCreateVisitorId } from './identity.js';
  // ... at the start of the bootstrap function:
  const visitorId = getOrCreateVisitorId();
  ```

  Pass `visitorId` into the existing widget state store / session handshake so it travels with every WS message and the voice-token request.

- [ ] **Step 7: Commit**

  ```bash
  git add packages/widget/src/identity.ts packages/widget/src/identity.test.ts packages/widget/src/bootstrap.ts
  git commit -m "feat(widget): persist sm_visitor_id with 7d rolling TTL (localStorage + cookie fallback)"
  ```

---

### Task 14: Widget — Shopify cart attribute injection

**Files:**
- Create: `packages/widget/src/shopifyCart.ts` + `shopifyCart.test.ts`
- Modify: `packages/widget/src/bootstrap.ts`

- [ ] **Step 1: Write the failing test**

  Create `packages/widget/src/shopifyCart.test.ts`:

  ```typescript
  import { describe, expect, it, vi } from 'vitest';
  import { injectShopifyCartAttribute } from './shopifyCart.js';

  describe('injectShopifyCartAttribute', () => {
    it('POSTs sm_visitor_id to /cart/update.js when on a Shopify storefront', async () => {
      const fetchFn = vi.fn().mockResolvedValue({ ok: true });
      await injectShopifyCartAttribute({ visitorId: 'v_abc', platform: 'shopify', fetchFn });
      expect(fetchFn).toHaveBeenCalledWith(
        '/cart/update.js',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ attributes: { sm_visitor_id: 'v_abc' } }),
        }),
      );
    });

    it('is a no-op on non-Shopify platforms', async () => {
      const fetchFn = vi.fn();
      await injectShopifyCartAttribute({ visitorId: 'v_abc', platform: 'woocommerce', fetchFn });
      expect(fetchFn).not.toHaveBeenCalled();
    });

    it('swallows fetch errors silently (best-effort)', async () => {
      const fetchFn = vi.fn().mockRejectedValue(new Error('CORS'));
      await expect(
        injectShopifyCartAttribute({ visitorId: 'v_abc', platform: 'shopify', fetchFn }),
      ).resolves.not.toThrow();
    });
  });
  ```

- [ ] **Step 2: Run failing test**

  ```bash
  cd packages/widget && pnpm test -- shopifyCart --run
  ```
  Expected: FAIL.

- [ ] **Step 3: Implement**

  Create `packages/widget/src/shopifyCart.ts`:

  ```typescript
  export async function injectShopifyCartAttribute(args: {
    visitorId: string;
    platform: string;
    fetchFn?: typeof fetch;
  }): Promise<void> {
    if (args.platform !== 'shopify') return;
    const fetchFn = args.fetchFn ?? fetch;
    try {
      await fetchFn('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attributes: { sm_visitor_id: args.visitorId } }),
      });
    } catch {
      /* best-effort */
    }
  }
  ```

- [ ] **Step 4: Run + wire**

  ```bash
  cd packages/widget && pnpm test -- shopifyCart --run
  ```
  Expected: PASS.

  In `bootstrap.ts`, after `getOrCreateVisitorId()`:

  ```typescript
  import { injectShopifyCartAttribute } from './shopifyCart.js';
  // ... merchantPlatform comes from existing widget config / bootstrap handshake
  void injectShopifyCartAttribute({ visitorId, platform: merchantPlatform });
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/widget/src/shopifyCart.ts packages/widget/src/shopifyCart.test.ts packages/widget/src/bootstrap.ts
  git commit -m "feat(widget): inject sm_visitor_id into Shopify cart attributes at init"
  ```

---

### Task 15: API endpoint — attribution summary for dashboard

**Files:**
- Create: `apps/api/src/routes/dashboard-attribution.ts`
- Create: `apps/api/src/routes/dashboard-attribution.test.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the failing test**

  Create `apps/api/src/routes/dashboard-attribution.test.ts`:

  ```typescript
  import { describe, expect, it, vi } from 'vitest';
  import { computeAttributionSummary } from './dashboard-attribution.js';

  describe('computeAttributionSummary', () => {
    it('sums totals split by kind for the given window', async () => {
      const queryConversions = vi.fn().mockResolvedValue([
        { kind: 'assisted', totalCents: 3000, orderId: 'o1' },
        { kind: 'assisted', totalCents: 2000, orderId: 'o2' },
        { kind: 'influenced', totalCents: 5000, orderId: 'o1' },
        { kind: 'influenced', totalCents: 5000, orderId: 'o3' },
      ]);
      const out = await computeAttributionSummary({
        merchantId: 'm1',
        days: 7,
        queryConversions,
      });
      expect(out).toEqual({
        assisted: { revenueCents: 5000, orderCount: 2 },
        influenced: { revenueCents: 10000, orderCount: 2 },
        windowDays: 7,
      });
    });

    it('returns zeros when no conversions', async () => {
      const queryConversions = vi.fn().mockResolvedValue([]);
      const out = await computeAttributionSummary({ merchantId: 'm1', days: 7, queryConversions });
      expect(out.assisted.revenueCents).toBe(0);
      expect(out.influenced.revenueCents).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run failing**

  ```bash
  cd apps/api && pnpm test -- dashboard-attribution --run
  ```
  Expected: FAIL.

- [ ] **Step 3: Implement**

  Create `apps/api/src/routes/dashboard-attribution.ts`:

  ```typescript
  import { Hono } from 'hono';
  import { db, schema } from '@shoppingmate/db';
  import { and, eq, gte } from 'drizzle-orm';

  export type AttributionSummary = {
    assisted: { revenueCents: number; orderCount: number };
    influenced: { revenueCents: number; orderCount: number };
    windowDays: number;
  };

  export type ConversionRow = {
    kind: 'assisted' | 'influenced';
    totalCents: number;
    orderId: string;
  };

  export async function computeAttributionSummary(args: {
    merchantId: string;
    days: number;
    queryConversions: (args: { merchantId: string; since: Date }) => Promise<ConversionRow[]>;
  }): Promise<AttributionSummary> {
    const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
    const rows = await args.queryConversions({ merchantId: args.merchantId, since });

    const assisted = rows.filter((r) => r.kind === 'assisted');
    const influenced = rows.filter((r) => r.kind === 'influenced');

    return {
      assisted: {
        revenueCents: assisted.reduce((s, r) => s + r.totalCents, 0),
        orderCount: new Set(assisted.map((r) => r.orderId)).size,
      },
      influenced: {
        revenueCents: influenced.reduce((s, r) => s + r.totalCents, 0),
        orderCount: new Set(influenced.map((r) => r.orderId)).size,
      },
      windowDays: args.days,
    };
  }

  export async function defaultQueryConversions(args: { merchantId: string; since: Date }): Promise<ConversionRow[]> {
    const rows = await db
      .select({
        kind: schema.conversionEvents.attributionKind,
        totalCents: schema.conversionEvents.totalCents,
        orderId: schema.conversionEvents.orderId,
      })
      .from(schema.conversionEvents)
      .where(
        and(
          eq(schema.conversionEvents.merchantId, args.merchantId),
          gte(schema.conversionEvents.occurredAt, args.since),
        ),
      );
    return rows.map((r) => ({
      kind: r.kind as 'assisted' | 'influenced',
      totalCents: r.totalCents,
      orderId: r.orderId,
    }));
  }

  export const dashboardAttributionRoute = new Hono();
  dashboardAttributionRoute.get('/:merchantId', async (c) => {
    const merchantId = c.req.param('merchantId');
    const days = Number(c.req.query('days') ?? '7');
    const out = await computeAttributionSummary({
      merchantId,
      days,
      queryConversions: defaultQueryConversions,
    });
    return c.json(out);
  });
  ```

- [ ] **Step 4: Run test + register route**

  ```bash
  cd apps/api && pnpm test -- dashboard-attribution --run
  ```
  Expected: PASS.

  In `apps/api/src/index.ts`:

  ```typescript
  import { dashboardAttributionRoute } from './routes/dashboard-attribution.js';
  app.route('/v1/dashboard/attribution', dashboardAttributionRoute);
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add apps/api/src/routes/dashboard-attribution.ts apps/api/src/routes/dashboard-attribution.test.ts apps/api/src/index.ts
  git commit -m "feat(api): /v1/dashboard/attribution — assisted/influenced split for ROI tiles"
  ```

---

### Task 16: Dashboard — swap one KPI tile for two attribution tiles

**Files:**
- Modify: `web/src/lib/kpi-repo.ts`
- Modify: `web/src/app/app/page.tsx`
- Modify: `web/src/lib/kpi-repo.test.ts`

> **Before editing web files:** read `web/AGENTS.md` and the relevant guide in `node_modules/next/dist/docs/` if any Next.js-specific API is involved. The version in this repo differs from training data.

- [ ] **Step 1: Extend `Kpis` type and `computeKpis` to source attribution from `conversion_events`**

  In `web/src/lib/kpi-repo.ts`, change the `Kpis` type and replace the revenue-from-metricEvents path:

  ```typescript
  import { db } from './db';
  import { metricEvents, conversionEvents } from '@shoppingmate/db/schema';
  import { and, eq, gte, sql } from 'drizzle-orm';

  export type Kpis = {
    conversations: number;
    assistedRevenueCents: number;
    assistedOrderCount: number;
    influencedRevenueCents: number;
    influencedOrderCount: number;
    voiceRatio: number;
    voiceConversations: number;
  };

  export async function computeKpis(args: { merchantId: string; days: number }): Promise<Kpis> {
    const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);

    const metricRows = await db
      .select({
        name: metricEvents.metricName,
        count: sql<number>`count(*)::int`,
      })
      .from(metricEvents)
      .where(and(eq(metricEvents.merchantId, args.merchantId), gte(metricEvents.ts, since)))
      .groupBy(metricEvents.metricName);

    const byName = new Map(metricRows.map((r) => [r.name, r]));
    const conversations = byName.get('conversationCompleted')?.count ?? 0;
    const voiceConversations = byName.get('voiceConversation')?.count ?? 0;

    const conversionRows = await db
      .select({
        kind: conversionEvents.attributionKind,
        totalCents: conversionEvents.totalCents,
        orderId: conversionEvents.orderId,
      })
      .from(conversionEvents)
      .where(and(eq(conversionEvents.merchantId, args.merchantId), gte(conversionEvents.occurredAt, since)));

    const assistedRows = conversionRows.filter((r) => r.kind === 'assisted');
    const influencedRows = conversionRows.filter((r) => r.kind === 'influenced');

    return {
      conversations,
      assistedRevenueCents: assistedRows.reduce((s, r) => s + r.totalCents, 0),
      assistedOrderCount: new Set(assistedRows.map((r) => r.orderId)).size,
      influencedRevenueCents: influencedRows.reduce((s, r) => s + r.totalCents, 0),
      influencedOrderCount: new Set(influencedRows.map((r) => r.orderId)).size,
      voiceConversations,
      voiceRatio: conversations > 0 ? voiceConversations / conversations : 0,
    };
  }
  ```

- [ ] **Step 2: Update kpi-repo tests**

  Open `web/src/lib/kpi-repo.test.ts`. Update the mock to also return rows from `conversionEvents` queries, and assert new field names. Example shape of an added test:

  ```typescript
  it('splits assisted and influenced revenue from conversion_events', async () => {
    // mock returns 2 assisted rows summing $30 and 1 influenced row of $50
    const kpis = await computeKpis({ merchantId: 'm1', days: 7 });
    expect(kpis.assistedRevenueCents).toBe(3000);
    expect(kpis.assistedOrderCount).toBe(2);
    expect(kpis.influencedRevenueCents).toBe(5000);
    expect(kpis.influencedOrderCount).toBe(1);
  });
  ```

  Update the existing assertions that referenced `revenueCents` and `conversionRate` to use the new fields (delete those that no longer apply).

- [ ] **Step 3: Run tests**

  ```bash
  cd web && pnpm test -- kpi-repo --run
  ```
  Expected: PASS.

- [ ] **Step 4: Update dashboard tiles in `web/src/app/app/page.tsx`**

  Replace the existing KPI grid (lines around 35–44) with:

  ```tsx
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KpiTile label="Conversations" value={String(kpis.conversations)} />
          <KpiTile
            label="Assisted revenue · 7d"
            value={usd(kpis.assistedRevenueCents)}
            hint={`${kpis.assistedOrderCount} orders Sage recommended`}
          />
          <KpiTile
            label="Influenced revenue · 7d"
            value={usd(kpis.influencedRevenueCents)}
            hint={`${kpis.influencedOrderCount} orders after a Sage conversation`}
          />
          <KpiTile
            label="Voice ratio"
            value={`${(kpis.voiceRatio * 100).toFixed(0)}%`}
            hint={kpis.voiceRatio > 0.2 ? `Surcharge active: $0.30 × ${kpis.voiceConversations}` : undefined}
          />
        </div>
  ```

  (Verify `KpiTile` accepts a `hint` prop — if not, extend it minimally.)

- [ ] **Step 5: Verify no other call sites use removed fields**

  ```bash
  grep -rn 'revenueCents\|conversionRate' web/src/
  ```
  Fix any remaining references.

- [ ] **Step 6: Run web tests**

  ```bash
  cd web && pnpm test -- --run
  ```
  Expected: PASS.

- [ ] **Step 7: Commit**

  ```bash
  git add web/src/lib/kpi-repo.ts web/src/lib/kpi-repo.test.ts web/src/app/app/page.tsx
  git commit -m "feat(web): replace single revenue tile with assisted+influenced split from conversion_events"
  ```

---

### Task 17: `/app/revenue` drill-down page

**Files:**
- Create: `web/src/app/app/revenue/page.tsx`
- Create: `web/src/lib/revenue-repo.ts` + `revenue-repo.test.ts`

- [ ] **Step 1: Write the failing repo test**

  Create `web/src/lib/revenue-repo.test.ts`:

  ```typescript
  import { describe, expect, it, vi } from 'vitest';
  import { listRevenueRows } from './revenue-repo';

  describe('listRevenueRows', () => {
    it('returns rows ordered by occurredAt desc with recommended SKUs marked', async () => {
      const queryRows = vi.fn().mockResolvedValue([
        { orderId: 'o2', kind: 'influenced', totalCents: 5000, currency: 'USD', occurredAt: new Date('2026-05-27T11:00Z'), lineItems: [{ sku: 'A', quantity: 1, priceCents: 5000, wasRecommended: false }] },
        { orderId: 'o1', kind: 'assisted', totalCents: 3000, currency: 'USD', occurredAt: new Date('2026-05-27T10:00Z'), lineItems: [{ sku: 'A', quantity: 1, priceCents: 3000, wasRecommended: true }] },
      ]);
      const out = await listRevenueRows({ merchantId: 'm1', days: 7, queryRows });
      expect(out[0]!.orderId).toBe('o2');
      expect(out[1]!.lineItems[0]!.wasRecommended).toBe(true);
    });
  });
  ```

- [ ] **Step 2: Implement repo**

  Create `web/src/lib/revenue-repo.ts`:

  ```typescript
  import { db } from './db';
  import { conversionEvents, type ConversionLineItem } from '@shoppingmate/db/schema';
  import { and, eq, gte, desc } from 'drizzle-orm';

  export type RevenueRow = {
    orderId: string;
    kind: 'assisted' | 'influenced';
    totalCents: number;
    currency: string;
    occurredAt: Date;
    lineItems: ConversionLineItem[];
  };

  export async function listRevenueRows(args: {
    merchantId: string;
    days: number;
    queryRows?: typeof defaultQuery;
  }): Promise<RevenueRow[]> {
    const query = args.queryRows ?? defaultQuery;
    return query({ merchantId: args.merchantId, days: args.days });
  }

  async function defaultQuery(args: { merchantId: string; days: number }): Promise<RevenueRow[]> {
    const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
    const rows = await db
      .select({
        orderId: conversionEvents.orderId,
        kind: conversionEvents.attributionKind,
        totalCents: conversionEvents.totalCents,
        currency: conversionEvents.currency,
        occurredAt: conversionEvents.occurredAt,
        lineItems: conversionEvents.lineItems,
      })
      .from(conversionEvents)
      .where(and(eq(conversionEvents.merchantId, args.merchantId), gte(conversionEvents.occurredAt, since)))
      .orderBy(desc(conversionEvents.occurredAt));
    return rows.map((r) => ({ ...r, kind: r.kind as 'assisted' | 'influenced' }));
  }
  ```

- [ ] **Step 3: Run repo test**

  ```bash
  cd web && pnpm test -- revenue-repo --run
  ```
  Expected: PASS.

- [ ] **Step 4: Build the page**

  Create `web/src/app/app/revenue/page.tsx`:

  ```tsx
  import { headers } from 'next/headers';
  import { redirect } from 'next/navigation';
  import { getDashboardSession } from '@/lib/session';
  import { listRevenueRows } from '@/lib/revenue-repo';

  export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
    const hdrs = await headers();
    const session = await getDashboardSession({ headers: hdrs });
    if (!session?.merchant) redirect('/app/onboarding?step=2');

    const { days: daysParam } = await searchParams;
    const days = Number(daysParam ?? '7');
    const rows = await listRevenueRows({ merchantId: session.merchant.id, days });

    const usd = (cents: number, ccy: string) => `${ccy === 'USD' ? '$' : ccy + ' '}${(cents / 100).toFixed(2)}`;

    return (
      <div className="flex flex-col gap-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Revenue</h1>
        <p className="text-text-muted">Attributed orders over the last {days} days. Recommended SKUs are marked.</p>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border-default text-left text-text-muted">
              <th className="py-2">When</th>
              <th>Order</th>
              <th>Kind</th>
              <th>Total</th>
              <th>Line items</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.orderId}-${row.kind}`} className="border-b border-border-subtle">
                <td className="py-2">{row.occurredAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                <td className="font-mono">{row.orderId}</td>
                <td>
                  <span className={row.kind === 'assisted' ? 'rounded bg-emerald-100 px-2 py-0.5 text-emerald-700' : 'rounded bg-sky-100 px-2 py-0.5 text-sky-700'}>
                    {row.kind}
                  </span>
                </td>
                <td>{usd(row.totalCents, row.currency)}</td>
                <td>
                  {row.lineItems.map((li, i) => (
                    <span key={i} className={li.wasRecommended ? 'mr-2 font-medium text-emerald-700' : 'mr-2'}>
                      {li.wasRecommended && '★ '}
                      {li.sku} × {li.quantity}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && <p className="text-text-muted">No attributed orders in the last {days} days yet.</p>}
      </div>
    );
  }
  ```

- [ ] **Step 5: Wire tile click → drill-down**

  In `web/src/app/app/page.tsx`, wrap each of the two new KPI tiles in a `<Link href="/app/revenue">…</Link>` (import from `next/link`). If `KpiTile` doesn't accept being inside a Link or doesn't propagate, wrap externally.

- [ ] **Step 6: Run web tests + manual smoke**

  ```bash
  cd web && pnpm test -- --run
  cd web && pnpm dev
  ```
  Browse to `http://localhost:3000/app/revenue` (after signing in to a merchant with at least one conversion row in the DB) and verify the page renders.

- [ ] **Step 7: Commit**

  ```bash
  git add web/src/app/app/revenue/page.tsx web/src/lib/revenue-repo.ts web/src/lib/revenue-repo.test.ts web/src/app/app/page.tsx
  git commit -m "feat(web): /app/revenue drill-down — attributed orders with recommended SKUs"
  ```

---

### Task 18: Telemetry — new metric names + counters

**Files:**
- Modify: `packages/db/src/schema/metricEvents.ts`
- Modify: `apps/api/src/routes/conversion.ts`
- Modify: `apps/api/src/routes/webhooks/shopify.ts`

- [ ] **Step 1: Add new metric names**

  In `packages/db/src/schema/metricEvents.ts`, extend the `metricNames` object with:

  ```typescript
    conversionIngested: 'conversion.ingested',
    conversionMissNoVisitor: 'conversion.miss.no_visitor_in_window',
    conversionMissNoRecommendation: 'conversion.miss.no_recommendation_match',
    conversionMissMerchantUnknown: 'conversion.miss.merchant_unknown',
    conversionMissAuthFailed: 'conversion.miss.auth_failed',
    conversionMissDuplicate: 'conversion.miss.duplicate',
  ```

- [ ] **Step 2: Emit counters from the routes**

  In `apps/api/src/routes/conversion.ts`, after a successful attribute call, write a `conversionIngested` row tagged with `{ source: 'gtag', kind }` for each item in `result.wrote`. For miss branches (`merchant_unknown`, `auth_failed`, `invalid_json`), emit the corresponding `conversionMiss*` row.

  Pattern (add a thin helper or inline depending on existing telemetry style — check how `apps/api` currently writes metric events):

  ```typescript
  await db.insert(schema.metricEvents).values({
    merchantId: payload.merchantId,
    metricName: 'conversion.ingested',
    value: '1',
    tags: { source: 'gtag', kind },
  });
  ```

  Same pattern for the Shopify webhook in `webhooks/shopify.ts` (`source: 'shopify_webhook'`).

- [ ] **Step 3: Test miss-counter emission**

  Extend `conversion.test.ts` to assert: when the handler 401s on bad HMAC, the test repo's `recordMetric` mock is called with the `conversionMissAuthFailed` name. (Inject a `recordMetric` dep into the handler signature similarly to how `attribute` is injected.)

- [ ] **Step 4: Run tests**

  ```bash
  cd apps/api && pnpm test -- conversion shopify --run
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add packages/db/src/schema/metricEvents.ts apps/api/src/routes/
  git commit -m "feat(api): telemetry — conversion.ingested + conversion.miss.* counters with source+kind tags"
  ```

---

### Task 19: Manual E2E smoke runbook

**Files:**
- Create: `docs/runbooks/2026-06-DD-plan7-e2e.md` (replace `DD` with the run date)

- [ ] **Step 1: Write the runbook**

  Create the file with this content:

  ```markdown
  # Plan 7 — Conversion Attribution E2E Smoke

  Run after Plan 7 deploys to prod. Verifies both webhook + gtag ingest paths produce dashboard tiles.

  ## Prerequisites
  - `phase2-brand-dashboard-complete` tag present
  - DNS for `shoppingmate.ai` resolves (A3 done)
  - Demo merchant present with `script_secret` set in DB
  - A throwaway Shopify dev store admin token + webhook URL pointing at `https://api.shoppingmate.ai/v1/webhooks/shopify/orders/create`

  ## Steps

  - [ ] Open `shoppingmate.ai` in a fresh browser (no cookies). Confirm `sm_visitor_id` is written to `localStorage` after page load.
  - [ ] Start a voice conversation with Sage. Ask about a specific product/plan by name (e.g. "tell me about Starter"). Confirm tool call `pricing.quote` or `product.show` fires in network logs.
  - [ ] Verify in DB: `select * from conversation_sessions where visitor_id = '<id>' order by started_at desc limit 1;` — a row exists.
  - [ ] Verify in DB: `select * from recommendation_events where session_id = '<sess>';` — at least one row.
  - [ ] In Shopify dev store admin, create a fake order containing the SKU you discussed (use the `Draft order` flow → mark as paid). In `Additional details → Notes / Custom attributes`, add `sm_visitor_id = <id>`.
  - [ ] Verify Shopify dashboard fires `orders/create` webhook (check Settings → Notifications → Webhooks → recent deliveries → 200 OK).
  - [ ] Verify in DB: `select * from conversion_events where order_id = '<id>';` — **two** rows (assisted + influenced).
  - [ ] Open `app.shoppingmate.ai/app` signed in as the merchant. Within 5s of refresh, both Assisted and Influenced KPI tiles show non-zero.
  - [ ] Click Assisted tile → lands on `/app/revenue` → row shows the SKU with the ★ recommendation marker.
  - [ ] **gtag path:** add the merchant's gtag snippet (from onboarding) to a separate test page. Place a second fake order through that page (any flow that calls the snippet). Verify `conversion_events` row count increments and dedup holds (same order_id → still 2 rows, no third).

  ## Pass criteria
  All 10 steps tick green; dashboard reflects both attribution kinds; no errors in API logs.

  ## Failure modes & quick fixes
  - **No conversation_sessions row** → check `packages/agent/src/runtime.ts` session-start wiring; check voice-agent process logs
  - **Webhook 401** → Shopify webhook secret mismatch in Railway env
  - **No recommendation match** → tool name not in `extractSkuFromToolCall` mapping; extend it
  - **Tile shows zero** → check `/v1/dashboard/attribution/<merchantId>` directly
  ```

- [ ] **Step 2: Commit the runbook (skeleton; ticked on run-day)**

  ```bash
  git add docs/runbooks/2026-06-DD-plan7-e2e.md
  git commit -m "docs(runbook): Plan 7 E2E smoke checklist"
  ```

---

## Phase 3 — Cost Pilot

### Task 20: `costMeter` helper — TDD

**Files:**
- Create: `apps/voice-agent/src/costMeter.ts`
- Create: `apps/voice-agent/src/costMeter.test.ts`

- [ ] **Step 1: Write the failing test**

  Create `apps/voice-agent/src/costMeter.test.ts`:

  ```typescript
  import { describe, expect, it } from 'vitest';
  import { computeConversationCost, type CostInputs } from './costMeter.js';

  describe('computeConversationCost', () => {
    it('sums Gemini Live + Sonnet + LiveKit costs', () => {
      const inputs: CostInputs = {
        geminiAudioInSeconds: 60,
        geminiAudioOutSeconds: 45,
        sonnetPromptTokens: 1000,
        sonnetCompletionTokens: 500,
        livekitMinutes: 1.5,
        composioCallCount: 3,
      };
      const out = computeConversationCost(inputs);
      expect(out.totalCostUsd).toBeCloseTo(
        out.geminiCostUsd + out.sonnetCostUsd + out.livekitCostUsd + out.composioCostUsd,
        6,
      );
      expect(out.geminiCostUsd).toBeGreaterThan(0);
      expect(out.sonnetCostUsd).toBeGreaterThan(0);
    });

    it('returns zero across the board for an empty conversation', () => {
      const out = computeConversationCost({
        geminiAudioInSeconds: 0,
        geminiAudioOutSeconds: 0,
        sonnetPromptTokens: 0,
        sonnetCompletionTokens: 0,
        livekitMinutes: 0,
        composioCallCount: 0,
      });
      expect(out.totalCostUsd).toBe(0);
    });
  });
  ```

- [ ] **Step 2: Run failing test**

  ```bash
  cd apps/voice-agent && pnpm test -- costMeter --run
  ```
  Expected: FAIL.

- [ ] **Step 3: Implement with current published rates (2026-05 snapshot)**

  Create `apps/voice-agent/src/costMeter.ts`:

  ```typescript
  // Rates snapshot 2026-05. Update from vendor pricing pages periodically.
  // Anchored at https://ai.google.dev/pricing (Gemini Live native-audio) and https://docs.anthropic.com/.../pricing
  export const RATES = {
    geminiAudioInUsdPerSec: 0.0001875,    // adjust per current published Gemini Live audio in
    geminiAudioOutUsdPerSec: 0.000375,    // Gemini Live audio out
    sonnetPromptUsdPerToken: 3e-6,        // $3 / 1M tokens
    sonnetCompletionUsdPerToken: 15e-6,   // $15 / 1M tokens
    livekitUsdPerMinute: 0.004,           // LiveKit Cloud egress
    composioUsdPerCall: 0.0005,           // approx; refine
  } as const;

  export type CostInputs = {
    geminiAudioInSeconds: number;
    geminiAudioOutSeconds: number;
    sonnetPromptTokens: number;
    sonnetCompletionTokens: number;
    livekitMinutes: number;
    composioCallCount: number;
  };

  export type CostOutputs = {
    geminiCostUsd: number;
    sonnetCostUsd: number;
    livekitCostUsd: number;
    composioCostUsd: number;
    totalCostUsd: number;
  };

  export function computeConversationCost(inputs: CostInputs): CostOutputs {
    const geminiCostUsd =
      inputs.geminiAudioInSeconds * RATES.geminiAudioInUsdPerSec +
      inputs.geminiAudioOutSeconds * RATES.geminiAudioOutUsdPerSec;
    const sonnetCostUsd =
      inputs.sonnetPromptTokens * RATES.sonnetPromptUsdPerToken +
      inputs.sonnetCompletionTokens * RATES.sonnetCompletionUsdPerToken;
    const livekitCostUsd = inputs.livekitMinutes * RATES.livekitUsdPerMinute;
    const composioCostUsd = inputs.composioCallCount * RATES.composioUsdPerCall;
    const totalCostUsd = geminiCostUsd + sonnetCostUsd + livekitCostUsd + composioCostUsd;
    return { geminiCostUsd, sonnetCostUsd, livekitCostUsd, composioCostUsd, totalCostUsd };
  }
  ```

- [ ] **Step 4: Run test passing**

  ```bash
  cd apps/voice-agent && pnpm test -- costMeter --run
  ```
  Expected: PASS.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/voice-agent/src/costMeter.ts apps/voice-agent/src/costMeter.test.ts
  git commit -m "feat(voice-agent): costMeter helper — per-conversation USD with vendor rate snapshot"
  ```

---

### Task 21: `cost-pilot.mjs` harness

**Files:**
- Create: `apps/voice-agent/scripts/cost-pilot.mjs`

- [ ] **Step 1: Read the existing voice-smoke for the pattern**

  ```bash
  cat apps/voice-agent/scripts/voice-smoke.mjs
  ```

  Note how it spins up a LiveKit room, drives turns, and tears down.

- [ ] **Step 2: Write the harness**

  Create `apps/voice-agent/scripts/cost-pilot.mjs`:

  ```javascript
  #!/usr/bin/env node
  // Cost-pilot harness — drives N synthetic conversations through prod-shape stack and writes per-call JSON rows.
  // Usage: node apps/voice-agent/scripts/cost-pilot.mjs --count=80 --out=./cost-pilot-rows.jsonl

  import { writeFileSync, appendFileSync } from 'node:fs';
  import { computeConversationCost } from '../src/costMeter.js'; // tsx/loader required; see Step 4

  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, v] = a.replace(/^--/, '').split('=');
      return [k, v ?? true];
    }),
  );
  const count = Number(args.count ?? 80);
  const out = String(args.out ?? './cost-pilot-rows.jsonl');

  const DURATION_WEIGHTS = [
    [30, 0.30],
    [60, 0.30],
    [120, 0.20],
    [240, 0.15],
    [480, 0.05],
  ];
  const INTENTS = ['product-discovery', 'pricing-q', 'policy-q', 'edge'];
  const INTENT_WEIGHTS = [0.3, 0.3, 0.2, 0.2];

  function pickWeighted(items) {
    const r = Math.random();
    let acc = 0;
    for (const [val, w] of items) {
      acc += w;
      if (r <= acc) return val;
    }
    return items[items.length - 1][0];
  }
  function pickIntent() {
    const r = Math.random();
    let acc = 0;
    for (let i = 0; i < INTENTS.length; i++) {
      acc += INTENT_WEIGHTS[i];
      if (r <= acc) return INTENTS[i];
    }
    return INTENTS[INTENTS.length - 1];
  }
  function poisson(lambda) {
    let L = Math.exp(-lambda), k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return k - 1;
  }

  writeFileSync(out, ''); // truncate

  for (let i = 0; i < count; i++) {
    const durationS = pickWeighted(DURATION_WEIGHTS);
    const userTurns = Math.max(1, poisson(durationS / 25));
    const assistantTurns = userTurns;
    const intent = pickIntent();

    // TODO when running for real: invoke the voice-smoke driver here against LiveKit + Gemini Live,
    // record actual audio-in / audio-out seconds, Sonnet token counts, LiveKit minutes, Composio calls.
    // For an initial dry-run, estimate from duration + turn counts:
    const inputs = {
      geminiAudioInSeconds: durationS * 0.4,        // ~40% of wall-clock is user audio
      geminiAudioOutSeconds: durationS * 0.4,
      sonnetPromptTokens: assistantTurns * 800,
      sonnetCompletionTokens: assistantTurns * 200,
      livekitMinutes: durationS / 60,
      composioCallCount: Math.min(userTurns, 3),
    };
    const cost = computeConversationCost(inputs);

    const row = {
      conversationId: `synth_${Date.now()}_${i}`,
      cohort: 'synthetic',
      intent,
      durationS,
      userTurns,
      assistantTurns,
      ...inputs,
      ...cost,
    };
    appendFileSync(out, JSON.stringify(row) + '\n');

    if ((i + 1) % 10 === 0) {
      console.log(`[cost-pilot] ${i + 1}/${count} synthetic rows written → ${out}`);
      await new Promise((r) => setTimeout(r, 30_000)); // 30s pause between batches of 10
    }
  }

  // Summary
  const lines = require('node:fs').readFileSync(out, 'utf-8').trim().split('\n').filter(Boolean);
  const rows = lines.map((l) => JSON.parse(l));
  const totals = rows.map((r) => r.totalCostUsd);
  const mean = totals.reduce((s, x) => s + x, 0) / totals.length;
  const variance = totals.reduce((s, x) => s + (x - mean) ** 2, 0) / (totals.length - 1);
  const sd = Math.sqrt(variance);
  const ci95 = 1.96 * sd / Math.sqrt(totals.length);
  console.log(`[cost-pilot] n=${totals.length} mean=$${mean.toFixed(4)} 95% CI ±$${ci95.toFixed(4)} (sd=$${sd.toFixed(4)})`);
  ```

- [ ] **Step 3: Confirm tsx/loader path for `.ts` import from `.mjs`**

  The harness imports from `../src/costMeter.js`. Verify the voice-agent build produces `.js` from `.ts` (check existing `voice-smoke.mjs` for the same pattern). If voice-agent uses `tsx` at dev time, the script may need to be `.ts` instead. Adjust the file extension accordingly to match the existing pattern.

- [ ] **Step 4: Dry-run with estimated inputs**

  ```bash
  node apps/voice-agent/scripts/cost-pilot.mjs --count=10 --out=./cost-pilot-dryrun.jsonl
  ```
  Expected: 10 JSONL rows written; summary line prints with mean + CI.

- [ ] **Step 5: Commit**

  ```bash
  git add apps/voice-agent/scripts/cost-pilot.mjs
  git commit -m "feat(voice-agent): cost-pilot harness — synthetic cohort driver + JSONL output + summary stats"
  ```

---

### Task 22: Run synthetic cohort (n = 80) against prod

**Files:** none in repo; produces `cost-pilot-synth.jsonl` (operator-local)

> Requires Phase 1 (DNS + secrets) complete so Gemini Live + LiveKit + Anthropic + Composio all work against prod from the operator machine.

- [ ] **Step 1: Wire the real voice-smoke driver into the harness**

  The dry-run uses estimates. Before the real run, replace the "TODO when running for real" block in `cost-pilot.mjs` with a call into the existing `voice-smoke.mjs` driver that:
  - Joins a real LiveKit room
  - Plays scripted user audio (one canned WAV per `intent`)
  - Listens for assistant audio
  - Captures actual durations from the LiveKit room metadata
  - Captures actual token counts from Sonnet response logs

  If wiring this is a half-day in itself, you may instead start with the dry-run rate-card numbers and label the cohort `synthetic-estimated` (lower confidence) — call this out in the final runbook.

- [ ] **Step 2: Run the synthetic cohort**

  ```bash
  node apps/voice-agent/scripts/cost-pilot.mjs --count=80 --out=./cost-pilot-synth.jsonl
  ```
  Expected: 80 rows, ~40 minutes wall-clock (with 30s pauses between batches of 10).

- [ ] **Step 3: Stash the JSONL**

  Save `cost-pilot-synth.jsonl` to `docs/runbooks/data/` (create the dir if needed) so the runbook can reference raw data:

  ```bash
  mkdir -p docs/runbooks/data
  cp cost-pilot-synth.jsonl docs/runbooks/data/2026-MM-DD-cost-pilot-synth.jsonl
  ```

**DoD:** 80 rows captured; summary statistics printed; raw JSONL stashed.

---

### Task 23: Collect real cohort (n = 20)

**Files:** none in repo; produces `cost-pilot-real.jsonl`

- [ ] **Step 1: Check for existing pilot-replay traces**

  ```bash
  ls apps/voice-agent/scripts/pilot-replay.ts
  # And check for any saved trace files (location depends on existing harness)
  ```

  If ≥ 20 traces exist: extend `pilot-replay.ts` to wrap each replay with `computeConversationCost` and write JSONL rows. Skip Step 2.

- [ ] **Step 2: Otherwise, accumulate from live demo bot**

  - Enable cost-meter logging in the voice-agent runtime (gated by `COST_METER_ENABLED=true` env var)
  - Wait for 20 real visitor conversations to accumulate on shoppingmate.ai (post-DNS cutover)
  - Pull rows from the metric_events table (or wherever cost logs land) and emit a JSONL file in the same format as Task 22

- [ ] **Step 3: Stash**

  ```bash
  cp cost-pilot-real.jsonl docs/runbooks/data/2026-MM-DD-cost-pilot-real.jsonl
  ```

**DoD:** ≥ 20 rows from real visitor traffic with full cost breakdown.

---

### Task 24: Publish cost-pilot runbook with verdict

**Files:**
- Create: `docs/runbooks/2026-MM-DD-gemini-cost-pilot.md` (use the actual run-completion date)

- [ ] **Step 1: Compute the divergence check**

  ```bash
  # Quick analysis with node:
  node -e "
    const fs = require('fs');
    const synth = fs.readFileSync('docs/runbooks/data/<synth file>', 'utf-8').trim().split('\n').map(JSON.parse);
    const real = fs.readFileSync('docs/runbooks/data/<real file>', 'utf-8').trim().split('\n').map(JSON.parse);
    const mean = (xs) => xs.reduce((s,x) => s+x, 0)/xs.length;
    const sm = mean(synth.map(r => r.totalCostUsd));
    const rm = mean(real.map(r => r.totalCostUsd));
    console.log('synth mean', sm, 'real mean', rm, 'divergence', Math.abs(sm-rm)/sm);
  "
  ```

  If divergence > 0.5: re-tune the synthetic script weights from the real cohort's actual duration / turn distribution, rerun Task 22 once.

- [ ] **Step 2: Write the runbook**

  Create `docs/runbooks/2026-MM-DD-gemini-cost-pilot.md`:

  ```markdown
  # Gemini Live Cost Pilot — 2026-MM-DD

  ## Goal
  Measure $/conversation with 95% CI; pass if synth upper-95%-CI ≤ $0.30/conv.

  ## Methodology
  Hybrid 80 synthetic + 20 real cohorts run against prod stack (LiveKit Cloud + Gemini Live native-audio + Anthropic Sonnet ambient + Composio). Cost meter at `apps/voice-agent/src/costMeter.ts` (rate snapshot: 2026-05).

  Conversation definition: LiveKit room session with ≥1 user turn and ≥1 assistant turn. Abandoned connects logged separately, excluded from the per-conversation denominator.

  Synthetic distribution: durations {30:30%, 60:30%, 120:20%, 240:15%, 480:5%} sec; user turns ~Poisson(λ = duration/25); intents 30/30/20/20 product/pricing/policy/edge.

  Real cohort: <where it came from — pilot-replay traces / live demo bot accumulation>.

  ## Raw data
  - Synthetic: `data/2026-MM-DD-cost-pilot-synth.jsonl`
  - Real:      `data/2026-MM-DD-cost-pilot-real.jsonl`

  ## Results

  | Cohort | n | mean $/conv | sd | 95% CI | upper 95% |
  |---|---|---|---|---|---|
  | Synthetic | 80 | $X.XXXX | $Y.YYYY | ±$Z.ZZZZ | $W.WWWW |
  | Real      | 20 | $X.XXXX | $Y.YYYY | ±$Z.ZZZZ | $W.WWWW |

  | Component | Synthetic mean | Real mean |
  |---|---|---|
  | Gemini Live | $... | $... |
  | Sonnet ambient | $... | $... |
  | LiveKit | $... | $... |
  | Composio | $... | $... |

  Divergence: |synth − real| / synth = X.XX (threshold 0.50: <pass/fail>)

  ## Verdict
  - **Synth upper-95% CI:** $X.XXXX
  - **Target:** ≤ $0.30/conv
  - **Result:** <PASS / FAIL>

  ## If FAIL: operator options (not pre-decided)
  - Raise Starter price to $XX / conv to clear gross-margin floor
  - Switch Gemini Live to a cheaper region
  - Drop to Gemini Flash for non-voice (text-mode) sessions
  - Reduce session timeout cap (default 8min → 4min)
  - Add per-merchant per-day cap

  ## Notes
  <anything that surfaced during the runs — fix-ups, surprising line items, things to revisit>
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add docs/runbooks/2026-MM-DD-gemini-cost-pilot.md docs/runbooks/data/
  git commit -m "docs(runbook): Gemini Live cost pilot — published with verdict"
  ```

**DoD:** runbook published; verdict recorded; if FAIL, operator decision on the unblocking path noted.

---

## Bucket A — Completion Verification

> Final integrated check. Run after all 24 tasks complete.

- [ ] All 11 hard-gate boxes from spec § 8 are ticked
- [ ] End-to-end "stranger" smoke runs in ≤ 10 minutes:
  - Fresh browser → `shoppingmate.ai` → magic-link signup → Stripe Checkout Starter $30 (test mode) → Shopify dev store connect → script tag pasted → conversation about a product → place order on dev store → return to `/app` → both attribution tiles increment → drill-down shows the SKU marked recommended

When that smoke passes, Bucket A is done. Sellable.
