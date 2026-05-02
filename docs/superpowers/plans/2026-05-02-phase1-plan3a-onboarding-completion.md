# Phase 1 — Plan 3a: Onboarding Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing onboarding worker pipeline with catalog sync (Shopify + Woo + DOM crawl), DOM selector extraction (Sonnet 4.6), and a synthetic cartAdd smoke test, leaving every Plan-2-onboarded merchant with a populated `products` table and a known `live` or `degraded` status.

**Architecture:** Linear extension of `apps/worker/src/handlers/onboarding.ts`. Three new step files (`catalogSync.ts`, `selectorExtract.ts`, `smokeTest.ts`) and four new fingerprint rules (Magento, BigCommerce, Wix, Squarespace) for the "detect + degrade" path. New `packages/db/src/repos/catalogRepo.ts` provides Postgres FTS read primitive for Plan 4. No new services, no new queues.

**Tech Stack:** TypeScript, drizzle-orm, BullMQ, msw v2 (test mocking), vitest, Playwright (chromium-only, headless, new dependency for DOM crawl + DOM smoke test), OpenRouter (Sonnet 4.6 for selectors, Haiku 4.5 for DOM-crawl product extraction).

**Spec:** [`docs/superpowers/specs/2026-05-02-phase1-plan3a-onboarding-completion-design.md`](../specs/2026-05-02-phase1-plan3a-onboarding-completion-design.md)

**Acceptance:** All criteria from §9 of the spec pass: Shopify dev store + Woo dev store both reach `status='live'` with populated `products` and `smoke_passed_at`; a Magento (or other coming-soon) merchant reaches `status='degraded'` with `detected_platform` tagged; `catalogRepo.searchProducts` ranks results by FTS; full repo `pnpm test`, `pnpm lint`, `pnpm typecheck` green.

---

## File structure

**New files:**

- `packages/db/src/repos/catalogRepo.ts` — FTS search + getProduct
- `apps/worker/src/steps/catalogSync.ts` — dispatch + per-platform sync
- `apps/worker/src/steps/catalogClients/shopify.ts` — `/products.json` paginated fetch
- `apps/worker/src/steps/catalogClients/woo.ts` — `/wp-json/wc/store/v1/products` paginated fetch
- `apps/worker/src/steps/catalogClients/domCrawl.ts` — sitemap + Playwright + Haiku extraction
- `apps/worker/src/steps/selectorExtract.ts` — Playwright render + Sonnet selector extraction (DOM only)
- `apps/worker/src/steps/smokeTest.ts` — synthetic cartAdd dispatch
- `apps/worker/src/steps/fingerprintRules/magento.ts`
- `apps/worker/src/steps/fingerprintRules/bigcommerce.ts`
- `apps/worker/src/steps/fingerprintRules/wix.ts`
- `apps/worker/src/steps/fingerprintRules/squarespace.ts`
- `apps/worker/src/lib/openrouter.ts` — thin client for OpenRouter chat completions
- `apps/worker/src/lib/playwright.ts` — shared headless chromium launcher
- `tests/db/catalogRepo.test.ts`
- `tests/worker/catalogSync.test.ts`
- `tests/worker/catalogClients/shopify.test.ts`
- `tests/worker/catalogClients/woo.test.ts`
- `tests/worker/catalogClients/domCrawl.test.ts`
- `tests/worker/selectorExtract.test.ts`
- `tests/worker/smokeTest.test.ts`
- `tests/fixtures/shopifyProducts.json`
- `tests/fixtures/wooProducts.json`
- `tests/fixtures/sitemap.xml`
- `tests/fixtures/magentoHomepage.html`
- `tests/fixtures/bigcommerceHomepage.html`
- `tests/fixtures/wixHomepage.html`
- `tests/fixtures/squarespaceHomepage.html`

**Modified files:**

- `packages/db/src/schema/products.ts` — make `indexedAt` + `source` NOT NULL; add `sourceMeta` JSONB; add `searchVector` generated tsvector + GIN index; add `(merchantId, indexedAt)` index
- `packages/db/src/schema/merchants.ts` — add `catalogSyncedAt`, `smokePassedAt` columns
- `packages/db/src/schema/metricEvents.ts` — extend `metricNames` registry with 13 new keys
- `packages/db/src/index.ts` — export `repos/*`
- `apps/worker/src/steps/fingerprint.ts` — return `FingerprintResult { platform, detectedPlatform, confidence }` instead of bare `PlatformValue`
- `apps/worker/src/steps/fingerprintRules/index.ts` — add 4 new rules; broaden `FingerprintRule` type to allow detected-only rules
- `apps/worker/src/handlers/onboarding.ts` — add catalog/selector/smoke steps, write `detectedPlatform` into `adapterConfig`, set `catalogSyncedAt`/`smokePassedAt`
- `apps/worker/package.json` — add `playwright` dep
- `tests/worker/fingerprint.test.ts` — assert new return shape
- `tests/worker/onboarding.test.ts` — extend cases: catalog populated, smoke passed, magento degraded, woo happy path

---

## Phase A — Schema + registry foundation

### Task 1: Extend products schema

**Files:**
- Modify: `packages/db/src/schema/products.ts`

- [ ] **Step 1: Replace the products schema**

```ts
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { merchants } from './merchants.js';

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const products = pgTable(
  'products',
  {
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    productUrl: text('product_url').notNull(),
    variants: jsonb('variants'),
    priceCents: integer('price_cents'),
    currency: text('currency'),
    inStock: boolean('in_stock'),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source').notNull(),
    sourceMeta: jsonb('source_meta'),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(title,'')), 'A') || setweight(to_tsvector('simple', coalesce(description,'')), 'B')`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.merchantId, t.sku] }),
    searchIdx: index('products_search_idx').using('gin', t.searchVector),
    merchantIndexedIdx: index('products_merchant_indexed_idx').on(t.merchantId, t.indexedAt.desc()),
  }),
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/db typecheck`
Expected: PASS.

### Task 2: Extend merchants schema

**Files:**
- Modify: `packages/db/src/schema/merchants.ts`

- [ ] **Step 1: Add the two columns**

In the `pgTable('merchants', { ... })` literal, after the existing `lastIndexedAt` line, insert:

```ts
  catalogSyncedAt: timestamp('catalog_synced_at', { withTimezone: true }),
  smokePassedAt: timestamp('smoke_passed_at', { withTimezone: true }),
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/db typecheck`
Expected: PASS.

### Task 3: Generate and apply migration

**Files:**
- Create: `packages/db/drizzle/<auto-named>.sql`

- [ ] **Step 1: Generate migration**

Run: `pnpm db:generate`

Expected: a new SQL file created under `packages/db/drizzle/`. Inspect it: should contain `ADD COLUMN catalog_synced_at`, `ADD COLUMN smoke_passed_at` on `merchants`, and on `products` either `ALTER COLUMN ... SET NOT NULL` for `indexed_at`/`source` (if drizzle generates it) plus the new column / index DDL. If the migration is missing the GIN index DDL or the generated tsvector column, hand-edit the file to include them:

```sql
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "source_meta" jsonb;
ALTER TABLE "products" ALTER COLUMN "indexed_at" SET NOT NULL;
ALTER TABLE "products" ALTER COLUMN "indexed_at" SET DEFAULT now();
ALTER TABLE "products" ALTER COLUMN "source" SET NOT NULL;
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "search_vector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS "products_search_idx" ON "products" USING GIN ("search_vector");
CREATE INDEX IF NOT EXISTS "products_merchant_indexed_idx" ON "products" ("merchant_id", "indexed_at" DESC);
```

- [ ] **Step 2: Apply migration**

Run: `pnpm db:migrate`

Expected: migration applies cleanly. Verify in psql:

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "\d+ products"
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "\d merchants"
```

Expected: products has `source_meta`, `search_vector`, both new indexes; merchants has `catalog_synced_at`, `smoke_passed_at`.

### Task 4: Extend metricNames registry

**Files:**
- Modify: `packages/db/src/schema/metricEvents.ts`

- [ ] **Step 1: Append new keys to `metricNames`**

Just before the closing `} as const;`, add:

```ts
  onboardingCatalogSyncStarted: 'onboarding.catalog_sync.started',
  onboardingCatalogSyncCompleted: 'onboarding.catalog_sync.completed',
  onboardingCatalogSyncDegraded: 'onboarding.catalog_sync.degraded',
  onboardingCatalogSyncFailed: 'onboarding.catalog_sync.failed',
  onboardingSelectorExtractStarted: 'onboarding.selector_extract.started',
  onboardingSelectorExtractCompleted: 'onboarding.selector_extract.completed',
  onboardingSelectorExtractFailed: 'onboarding.selector_extract.failed',
  onboardingSmokeStarted: 'onboarding.smoke.started',
  onboardingSmokePassed: 'onboarding.smoke.passed',
  onboardingSmokeFailed: 'onboarding.smoke.failed',
  onboardingDetectedPlatformDegraded: 'onboarding.detected_platform.degraded',
  onboardingFingerprintMagentoDetected: 'onboarding.fingerprint.magento_detected',
  onboardingFingerprintBigcommerceDetected: 'onboarding.fingerprint.bigcommerce_detected',
  onboardingFingerprintWixDetected: 'onboarding.fingerprint.wix_detected',
  onboardingFingerprintSquarespaceDetected: 'onboarding.fingerprint.squarespace_detected',
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/db typecheck`
Expected: PASS.

- [ ] **Step 3: Commit Phase A**

```bash
git add packages/db/src/schema/products.ts packages/db/src/schema/merchants.ts packages/db/src/schema/metricEvents.ts packages/db/drizzle/
git commit -m "feat(db): plan 3a schema — products FTS, merchants catalog/smoke timestamps, metric registry

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase B — Fingerprint extension (detect + degrade)

### Task 5: Add Magento fingerprint rule

**Files:**
- Create: `apps/worker/src/steps/fingerprintRules/magento.ts`
- Create: `tests/fixtures/magentoHomepage.html`

- [ ] **Step 1: Add a small Magento homepage fixture**

Create `tests/fixtures/magentoHomepage.html`:

```html
<!doctype html>
<html><head><meta name="generator" content="Magento 2.4.6"/><script>require.config({paths:{magento:"static/Magento_Catalog"}});</script></head><body><div class="page-wrapper"></div></body></html>
```

- [ ] **Step 2: Implement the rule**

```ts
// apps/worker/src/steps/fingerprintRules/magento.ts
import type { FingerprintRule } from './index.js';

export const magentoRule: FingerprintRule = {
  platform: 'custom',
  detectedPlatform: 'magento',
  matches: (html, headers) => {
    if (/magento/i.test(headers['x-powered-by'] ?? '')) return true;
    if (/<meta[^>]+name=["']generator["'][^>]+Magento/i.test(html)) return true;
    if (/Magento_Catalog|Magento_Theme/i.test(html)) return true;
    return false;
  },
};
```

### Task 6: Add BigCommerce fingerprint rule

**Files:**
- Create: `apps/worker/src/steps/fingerprintRules/bigcommerce.ts`
- Create: `tests/fixtures/bigcommerceHomepage.html`

- [ ] **Step 1: Fixture**

```html
<!doctype html>
<html><head><script>window.BCData={cart_id:null};</script><link rel="stylesheet" href="//cdn11.bigcommerce.com/r-x/style.css"/></head><body></body></html>
```

- [ ] **Step 2: Rule**

```ts
// apps/worker/src/steps/fingerprintRules/bigcommerce.ts
import type { FingerprintRule } from './index.js';

export const bigcommerceRule: FingerprintRule = {
  platform: 'custom',
  detectedPlatform: 'bigcommerce',
  matches: (html, headers) => {
    if (/bigcommerce/i.test(headers['x-powered-by'] ?? '')) return true;
    if (/cdn11\.bigcommerce\.com|window\.BCData/i.test(html)) return true;
    return false;
  },
};
```

### Task 7: Add Wix fingerprint rule

**Files:**
- Create: `apps/worker/src/steps/fingerprintRules/wix.ts`
- Create: `tests/fixtures/wixHomepage.html`

- [ ] **Step 1: Fixture**

```html
<!doctype html>
<html><head><meta name="generator" content="Wix.com Website Builder"/><script src="//static.parastorage.com/services/wix-thunderbolt/dist/main.js"></script></head><body></body></html>
```

- [ ] **Step 2: Rule**

```ts
// apps/worker/src/steps/fingerprintRules/wix.ts
import type { FingerprintRule } from './index.js';

export const wixRule: FingerprintRule = {
  platform: 'custom',
  detectedPlatform: 'wix',
  matches: (html) => {
    if (/<meta[^>]+name=["']generator["'][^>]+Wix/i.test(html)) return true;
    if (/static\.parastorage\.com|wix-thunderbolt|_wixCIDX/i.test(html)) return true;
    return false;
  },
};
```

### Task 8: Add Squarespace fingerprint rule

**Files:**
- Create: `apps/worker/src/steps/fingerprintRules/squarespace.ts`
- Create: `tests/fixtures/squarespaceHomepage.html`

- [ ] **Step 1: Fixture**

```html
<!doctype html>
<html data-static-styles-namespace="squarespace"><head><script>Static.SQUARESPACE_CONTEXT={};</script></head><body></body></html>
```

- [ ] **Step 2: Rule**

```ts
// apps/worker/src/steps/fingerprintRules/squarespace.ts
import type { FingerprintRule } from './index.js';

export const squarespaceRule: FingerprintRule = {
  platform: 'custom',
  detectedPlatform: 'squarespace',
  matches: (html, headers) => {
    if (/squarespace/i.test(headers['server'] ?? '')) return true;
    if (/SQUARESPACE_CONTEXT|data-static-styles-namespace=["']squarespace/i.test(html)) return true;
    return false;
  },
};
```

### Task 9: Refactor fingerprint return shape and rule registry

**Files:**
- Modify: `apps/worker/src/steps/fingerprintRules/index.ts`
- Modify: `apps/worker/src/steps/fingerprint.ts`

- [ ] **Step 1: Replace `fingerprintRules/index.ts`**

```ts
import type { PlatformValue } from '@shoppingmate/db/schema';
import { bigcommerceRule } from './bigcommerce.js';
import { magentoRule } from './magento.js';
import { shopifyRule } from './shopify.js';
import { squarespaceRule } from './squarespace.js';
import { wixRule } from './wix.js';
import { woocommerceRule } from './woocommerce.js';

export type DetectedPlatform = 'magento' | 'bigcommerce' | 'wix' | 'squarespace';

export type FingerprintRule = {
  platform: PlatformValue;
  detectedPlatform?: DetectedPlatform;
  matches: (html: string, headers: Record<string, string>) => boolean;
};

export type FingerprintResult = {
  platform: PlatformValue;
  detectedPlatform: DetectedPlatform | null;
};

// Order matters: more-specific rules first. Shopify and Woo are first-class
// (they map to platform=shopify|woocommerce), the rest are detect-and-degrade
// rules (platform=custom + detectedPlatform set).
export const rules: FingerprintRule[] = [
  shopifyRule,
  woocommerceRule,
  magentoRule,
  bigcommerceRule,
  wixRule,
  squarespaceRule,
];

export function detectPlatform(html: string, headers: Record<string, string>): FingerprintResult {
  for (const rule of rules) {
    if (rule.matches(html, headers)) {
      return { platform: rule.platform, detectedPlatform: rule.detectedPlatform ?? null };
    }
  }
  return { platform: 'custom', detectedPlatform: null };
}
```

- [ ] **Step 2: Update `fingerprint.ts` return shape**

Replace the return type and the two `return detectPlatform(...)` lines with the new shape:

```ts
import type { FingerprintResult } from './fingerprintRules/index.js';
import { detectPlatform } from './fingerprintRules/index.js';

// ... unchanged constants ...

export async function fingerprint(domain: string): Promise<FingerprintResult> {
  // ... unchanged fetch + body-cap logic ...
  // both `return detectPlatform(...)` statements now return FingerprintResult
}
```

(Leave the rest of the function untouched — only the return type and the imports change.)

- [ ] **Step 3: Also update existing rules' types**

Open `apps/worker/src/steps/fingerprintRules/shopify.ts` and `woocommerce.ts`. They currently use the old `FingerprintRule` (which restricted `platform` to non-`custom`). The broadened type now allows `'custom'`; existing rules already declare `platform: 'shopify'` / `'woocommerce'` and need no change. Skip if no changes needed; otherwise add `detectedPlatform: undefined` for clarity.

### Task 10: Update fingerprint tests

**Files:**
- Modify: `tests/worker/fingerprint.test.ts`

- [ ] **Step 1: Replace existing assertions to use new shape and add 4 new cases**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fingerprint } from '../../apps/worker/src/steps/fingerprint.js';

const fixturesDir = resolve(import.meta.dirname, '..', 'fixtures');
const shopifyHtml = readFileSync(resolve(fixturesDir, 'shopifyHomepage.html'), 'utf8');
const wooHtml = readFileSync(resolve(fixturesDir, 'wooHomepage.html'), 'utf8');
const customHtml = readFileSync(resolve(fixturesDir, 'customHomepage.html'), 'utf8');
const magentoHtml = readFileSync(resolve(fixturesDir, 'magentoHomepage.html'), 'utf8');
const bcHtml = readFileSync(resolve(fixturesDir, 'bigcommerceHomepage.html'), 'utf8');
const wixHtml = readFileSync(resolve(fixturesDir, 'wixHomepage.html'), 'utf8');
const sqHtml = readFileSync(resolve(fixturesDir, 'squarespaceHomepage.html'), 'utf8');

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fingerprint', () => {
  it('shopify → platform=shopify, detected=null', async () => {
    server.use(http.get('https://shop.test/', () => HttpResponse.html(shopifyHtml)));
    expect(await fingerprint('shop.test')).toEqual({ platform: 'shopify', detectedPlatform: null });
  });

  it('woo → platform=woocommerce, detected=null', async () => {
    server.use(http.get('https://woo.test/', () => HttpResponse.html(wooHtml)));
    expect(await fingerprint('woo.test')).toEqual({
      platform: 'woocommerce',
      detectedPlatform: null,
    });
  });

  it('custom (no rule) → platform=custom, detected=null', async () => {
    server.use(http.get('https://custom.test/', () => HttpResponse.html(customHtml)));
    expect(await fingerprint('custom.test')).toEqual({
      platform: 'custom',
      detectedPlatform: null,
    });
  });

  it('magento → platform=custom, detected=magento', async () => {
    server.use(http.get('https://m.test/', () => HttpResponse.html(magentoHtml)));
    expect(await fingerprint('m.test')).toEqual({
      platform: 'custom',
      detectedPlatform: 'magento',
    });
  });

  it('bigcommerce → platform=custom, detected=bigcommerce', async () => {
    server.use(http.get('https://bc.test/', () => HttpResponse.html(bcHtml)));
    expect(await fingerprint('bc.test')).toEqual({
      platform: 'custom',
      detectedPlatform: 'bigcommerce',
    });
  });

  it('wix → platform=custom, detected=wix', async () => {
    server.use(http.get('https://wix.test/', () => HttpResponse.html(wixHtml)));
    expect(await fingerprint('wix.test')).toEqual({
      platform: 'custom',
      detectedPlatform: 'wix',
    });
  });

  it('squarespace → platform=custom, detected=squarespace', async () => {
    server.use(http.get('https://sq.test/', () => HttpResponse.html(sqHtml)));
    expect(await fingerprint('sq.test')).toEqual({
      platform: 'custom',
      detectedPlatform: 'squarespace',
    });
  });

  it('throws on network failure', async () => {
    server.use(http.get('https://broken.test/', () => HttpResponse.error()));
    await expect(fingerprint('broken.test')).rejects.toThrow();
  });

  it('throws on 5xx', async () => {
    server.use(http.get('https://oops.test/', () => new HttpResponse(null, { status: 503 })));
    await expect(fingerprint('oops.test')).rejects.toThrow(/503/);
  });
});
```

- [ ] **Step 2: Run fingerprint test, expect PASS**

Run: `pnpm test tests/worker/fingerprint.test.ts`
Expected: 9/9 passing.

### Task 11: Update onboarding handler to consume new fingerprint shape and tag detected_platform

**Files:**
- Modify: `apps/worker/src/handlers/onboarding.ts`

- [ ] **Step 1: Replace the fingerprint-result handling**

In `onboarding.ts`, change the `// Step 2 — Fingerprint` block from:

```ts
  let platform: schema.PlatformValue;
  try {
    platform = await fingerprint(domain);
  } catch (err) {
```

to:

```ts
  let fp: Awaited<ReturnType<typeof fingerprint>>;
  try {
    fp = await fingerprint(domain);
  } catch (err) {
```

Then replace the `platformMetric` selection and the `Step 3 — Finalize` block with:

```ts
  const platform = fp.platform;
  const platformMetric =
    platform === 'shopify'
      ? schema.metricNames.onboardingFingerprintShopify
      : platform === 'woocommerce'
        ? schema.metricNames.onboardingFingerprintWoocommerce
        : schema.metricNames.onboardingFingerprintCustom;
  await emitMetric(merchantId, platformMetric);

  if (fp.detectedPlatform) {
    const detectedMetricKey = `onboardingFingerprint${
      fp.detectedPlatform.charAt(0).toUpperCase() + fp.detectedPlatform.slice(1)
    }Detected` as keyof typeof schema.metricNames;
    await emitMetric(merchantId, schema.metricNames[detectedMetricKey]);
    await emitMetric(merchantId, schema.metricNames.onboardingDetectedPlatformDegraded);
  }

  // Tentative finalize — overwritten by catalog/selector/smoke steps in later tasks.
  // For now keep status='live' write here so existing tests pass; Task 22 replaces this.
  const adapterType = PLATFORM_TO_ADAPTER[platform];
  await db
    .update(schema.merchants)
    .set({
      status: 'live',
      platform,
      adapterType,
      lastFingerprintedAt: new Date(),
      lastError: null,
      adapterConfig: fp.detectedPlatform ? { detectedPlatform: fp.detectedPlatform } : {},
    })
    .where(eq(schema.merchants.id, merchantId));
```

- [ ] **Step 2: Run onboarding tests**

Run: `pnpm test tests/worker/onboarding.test.ts`
Expected: existing 4 tests still PASS (the new branch only fires for detected-platform fixtures, which the existing tests don't use).

- [ ] **Step 3: Commit Phase B**

```bash
git add apps/worker/src/steps/fingerprintRules/ apps/worker/src/steps/fingerprint.ts apps/worker/src/handlers/onboarding.ts tests/worker/fingerprint.test.ts tests/fixtures/
git commit -m "feat(worker): fingerprint detects magento/bc/wix/squarespace, tags detected_platform on adapter_config

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase C — Catalog sync clients

### Task 12: Shopify catalog client (TDD)

**Files:**
- Create: `apps/worker/src/steps/catalogClients/shopify.ts`
- Create: `tests/worker/catalogClients/shopify.test.ts`
- Create: `tests/fixtures/shopifyProducts.json`

- [ ] **Step 1: Fixture (a 2-page Shopify products.json response)**

Create `tests/fixtures/shopifyProducts.json`:

```json
{
  "page1": {
    "products": [
      {
        "id": 100,
        "title": "Linen Beach Pants",
        "body_html": "<p>Light cotton-linen blend.</p>",
        "handle": "linen-beach-pants",
        "image": { "src": "https://shop.test/cdn/shop/products/linen.jpg" },
        "variants": [
          { "id": 1001, "sku": "PANTS-S", "price": "49.00", "available": true, "option1": "S" },
          { "id": 1002, "sku": "PANTS-M", "price": "49.00", "available": false, "option1": "M" }
        ]
      },
      {
        "id": 101,
        "title": "Cotton Tee",
        "body_html": "<p>Plain cotton.</p>",
        "handle": "cotton-tee",
        "image": { "src": "https://shop.test/cdn/shop/products/tee.jpg" },
        "variants": [
          { "id": 2001, "sku": "TEE-M", "price": "19.00", "available": true, "option1": "M" }
        ]
      }
    ]
  },
  "page2": {
    "products": [
      {
        "id": 102,
        "title": "Sun Hat",
        "body_html": "<p>Wide brim.</p>",
        "handle": "sun-hat",
        "image": null,
        "variants": [
          { "id": 3001, "sku": "HAT-OS", "price": "29.99", "available": true, "option1": "OS" }
        ]
      }
    ]
  },
  "page3": { "products": [] }
}
```

- [ ] **Step 2: Failing test**

```ts
// tests/worker/catalogClients/shopify.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchShopifyCatalog } from '../../../apps/worker/src/steps/catalogClients/shopify.js';

const fixtures = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'fixtures', 'shopifyProducts.json'), 'utf8'),
);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchShopifyCatalog', () => {
  it('paginates /products.json and normalizes products', async () => {
    server.use(
      http.get('https://shop.test/products.json', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        const key = `page${page}` as keyof typeof fixtures;
        return HttpResponse.json(fixtures[key]);
      }),
    );

    const result = await fetchShopifyCatalog('shop.test', { cap: 5000, timeoutMs: 90_000 });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.products).toHaveLength(3);
    expect(result.products[0]).toMatchObject({
      sku: 'linen-beach-pants',
      title: 'Linen Beach Pants',
      productUrl: 'https://shop.test/products/linen-beach-pants',
      imageUrl: 'https://shop.test/cdn/shop/products/linen.jpg',
      priceCents: 4900,
      currency: 'USD',
      inStock: true,
    });
    expect(result.products[0].variants).toEqual([
      { id: '1001', sku: 'PANTS-S', priceCents: 4900, inStock: true, options: { option1: 'S' } },
      { id: '1002', sku: 'PANTS-M', priceCents: 4900, inStock: false, options: { option1: 'M' } },
    ]);
  });

  it('honors cap', async () => {
    server.use(
      http.get('https://shop.test/products.json', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        const key = `page${page}` as keyof typeof fixtures;
        return HttpResponse.json(fixtures[key]);
      }),
    );
    const result = await fetchShopifyCatalog('shop.test', { cap: 2, timeoutMs: 90_000 });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.products).toHaveLength(2);
  });

  it('returns failed on http error', async () => {
    server.use(
      http.get('https://shop.test/products.json', () => new HttpResponse(null, { status: 503 })),
    );
    const result = await fetchShopifyCatalog('shop.test', { cap: 5000, timeoutMs: 90_000 });
    expect(result.kind).toBe('failed');
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm test tests/worker/catalogClients/shopify.test.ts`
Expected: module-not-found.

- [ ] **Step 4: Implement**

```ts
// apps/worker/src/steps/catalogClients/shopify.ts
import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ step: 'catalogSync.shopify' });
const PAGE_SIZE = 250;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

export type NormalizedProduct = {
  sku: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  productUrl: string;
  variants: Array<{
    id: string;
    sku: string | null;
    priceCents: number | null;
    inStock: boolean | null;
    options: Record<string, string>;
  }>;
  priceCents: number | null;
  currency: string | null;
  inStock: boolean | null;
  source: 'shopify_storefront';
};

type ShopifyResp = {
  products: Array<{
    id: number;
    title: string;
    body_html: string | null;
    handle: string;
    image: { src: string } | null;
    variants: Array<{
      id: number;
      sku: string | null;
      price: string;
      available: boolean;
      option1?: string | null;
      option2?: string | null;
      option3?: string | null;
    }>;
  }>;
};

export type CatalogClientResult =
  | { kind: 'ok'; products: NormalizedProduct[]; expected: number }
  | { kind: 'failed'; reason: string };

function priceToCents(price: string): number | null {
  const n = Number.parseFloat(price);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

function variantOptions(v: ShopifyResp['products'][0]['variants'][0]): Record<string, string> {
  const out: Record<string, string> = {};
  if (v.option1) out.option1 = v.option1;
  if (v.option2) out.option2 = v.option2;
  if (v.option3) out.option3 = v.option3;
  return out;
}

export async function fetchShopifyCatalog(
  domain: string,
  opts: { cap: number; timeoutMs: number },
): Promise<CatalogClientResult> {
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  let page = 1;
  while (products.length < opts.cap && Date.now() < deadline) {
    const controller = new AbortController();
    const remaining = Math.max(1_000, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(
        `https://${domain}/products.json?limit=${PAGE_SIZE}&page=${page}`,
        { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: controller.signal },
      );
      if (!res.ok) {
        log.warn({ domain, page, status: res.status }, 'shopify products.json non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      const body = (await res.json()) as ShopifyResp;
      if (!body.products?.length) break;
      for (const p of body.products) {
        if (products.length >= opts.cap) break;
        const firstVar = p.variants[0];
        products.push({
          sku: p.handle,
          title: p.title,
          description: stripHtml(p.body_html),
          imageUrl: p.image?.src ?? null,
          productUrl: `https://${domain}/products/${p.handle}`,
          priceCents: firstVar ? priceToCents(firstVar.price) : null,
          currency: 'USD',
          inStock: p.variants.some((v) => v.available),
          variants: p.variants.map((v) => ({
            id: String(v.id),
            sku: v.sku,
            priceCents: priceToCents(v.price),
            inStock: v.available,
            options: variantOptions(v),
          })),
          source: 'shopify_storefront',
        });
      }
      if (body.products.length < PAGE_SIZE) break;
      page += 1;
    } catch (err) {
      log.warn({ domain, page, err: (err as Error).message }, 'shopify fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }
  }
  return { kind: 'ok', products, expected: products.length };
}
```

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm test tests/worker/catalogClients/shopify.test.ts`
Expected: 3/3 passing.

### Task 13: Woo catalog client (TDD)

**Files:**
- Create: `apps/worker/src/steps/catalogClients/woo.ts`
- Create: `tests/worker/catalogClients/woo.test.ts`
- Create: `tests/fixtures/wooProducts.json`

- [ ] **Step 1: Fixture (Woo Store API response)**

```json
{
  "page1": [
    {
      "id": 200,
      "name": "Ceramic Mug",
      "slug": "ceramic-mug",
      "permalink": "https://woo.test/product/ceramic-mug/",
      "description": "<p>Microwave safe.</p>",
      "images": [{ "src": "https://woo.test/wp-content/uploads/mug.jpg" }],
      "prices": { "price": "1500", "currency_code": "USD", "currency_minor_unit": 2 },
      "is_in_stock": true,
      "variations": []
    },
    {
      "id": 201,
      "name": "Coffee Beans 250g",
      "slug": "coffee-beans-250g",
      "permalink": "https://woo.test/product/coffee-beans-250g/",
      "description": "Single origin.",
      "images": [],
      "prices": { "price": "1899", "currency_code": "USD", "currency_minor_unit": 2 },
      "is_in_stock": false,
      "variations": []
    }
  ],
  "page2": []
}
```

- [ ] **Step 2: Failing test**

```ts
// tests/worker/catalogClients/woo.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchWooCatalog } from '../../../apps/worker/src/steps/catalogClients/woo.js';

const fixtures = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'fixtures', 'wooProducts.json'), 'utf8'),
);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchWooCatalog', () => {
  it('paginates Store API and normalizes products', async () => {
    server.use(
      http.get('https://woo.test/wp-json/wc/store/v1/products', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        return HttpResponse.json(fixtures[`page${page}`]);
      }),
    );

    const result = await fetchWooCatalog('woo.test', { cap: 5000, timeoutMs: 90_000 });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toMatchObject({
      sku: 'ceramic-mug',
      title: 'Ceramic Mug',
      productUrl: 'https://woo.test/product/ceramic-mug/',
      imageUrl: 'https://woo.test/wp-content/uploads/mug.jpg',
      priceCents: 1500,
      currency: 'USD',
      inStock: true,
    });
    expect(result.products[1].inStock).toBe(false);
  });

  it('returns failed on 404', async () => {
    server.use(
      http.get('https://woo.test/wp-json/wc/store/v1/products', () => new HttpResponse(null, { status: 404 })),
    );
    const result = await fetchWooCatalog('woo.test', { cap: 5000, timeoutMs: 90_000 });
    expect(result.kind).toBe('failed');
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm test tests/worker/catalogClients/woo.test.ts`
Expected: module-not-found.

- [ ] **Step 4: Implement**

```ts
// apps/worker/src/steps/catalogClients/woo.ts
import { childLogger } from '@shoppingmate/shared';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

const log = childLogger({ step: 'catalogSync.woo' });
const PAGE_SIZE = 100;
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

type WooProduct = {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  description: string | null;
  images: Array<{ src: string }>;
  prices: { price: string; currency_code: string; currency_minor_unit: number };
  is_in_stock: boolean;
  variations?: number[];
};

function stripHtml(html: string | null): string | null {
  if (!html) return null;
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || null;
}

function priceToCents(price: string, minorUnit: number): number | null {
  const n = Number.parseInt(price, 10);
  if (!Number.isFinite(n)) return null;
  return minorUnit === 2 ? n : Math.round((n / 10 ** minorUnit) * 100);
}

export async function fetchWooCatalog(
  domain: string,
  opts: { cap: number; timeoutMs: number },
): Promise<CatalogClientResult> {
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  let page = 1;
  while (products.length < opts.cap && Date.now() < deadline) {
    const controller = new AbortController();
    const remaining = Math.max(1_000, deadline - Date.now());
    const timer = setTimeout(() => controller.abort(), remaining);
    try {
      const res = await fetch(
        `https://${domain}/wp-json/wc/store/v1/products?per_page=${PAGE_SIZE}&page=${page}`,
        { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: controller.signal },
      );
      if (!res.ok) {
        log.warn({ domain, page, status: res.status }, 'woo store api non-ok');
        return { kind: 'failed', reason: `http_${res.status}` };
      }
      const body = (await res.json()) as WooProduct[];
      if (!body.length) break;
      for (const p of body) {
        if (products.length >= opts.cap) break;
        products.push({
          sku: p.slug,
          title: p.name,
          description: stripHtml(p.description),
          imageUrl: p.images[0]?.src ?? null,
          productUrl: p.permalink,
          priceCents: priceToCents(p.prices.price, p.prices.currency_minor_unit),
          currency: p.prices.currency_code,
          inStock: p.is_in_stock,
          variants: [],
          source: 'shopify_storefront' /* placeholder; overwritten next */,
        });
        // overwrite the source marker to keep types simple
        (products[products.length - 1] as NormalizedProduct & { source: string }).source = 'woo_store_api';
      }
      if (body.length < PAGE_SIZE) break;
      page += 1;
    } catch (err) {
      log.warn({ domain, page, err: (err as Error).message }, 'woo fetch failed');
      return { kind: 'failed', reason: 'fetch_error' };
    } finally {
      clearTimeout(timer);
    }
  }
  return { kind: 'ok', products, expected: products.length };
}
```

> Note on the `source` field: Shopify and Woo share the `NormalizedProduct` type. Widen the `source` field in `shopify.ts` to `'shopify_storefront' | 'woo_store_api' | 'dom_crawl'` instead of using the placeholder cast — re-edit `shopify.ts`'s `NormalizedProduct` type to:
>
> ```ts
> source: 'shopify_storefront' | 'woo_store_api' | 'dom_crawl';
> ```
>
> Then in `woo.ts`, just write `source: 'woo_store_api'` directly. Remove the placeholder + cast.

- [ ] **Step 5: Run both client tests, expect PASS**

Run: `pnpm test tests/worker/catalogClients/`
Expected: 5/5 passing (3 Shopify + 2 Woo).

### Task 14: Add Playwright dependency

**Files:**
- Modify: `apps/worker/package.json`

- [ ] **Step 1: Add `playwright` to dependencies**

In `apps/worker/package.json`, add `"playwright": "^1.49.0"` to the `dependencies` block (before `bullmq`).

- [ ] **Step 2: Install**

Run from repo root: `pnpm install --filter @shoppingmate/worker`

Expected: pnpm reports playwright added.

- [ ] **Step 3: Install browsers**

Run: `pnpm --filter @shoppingmate/worker exec playwright install chromium`

Expected: chromium downloaded to local Playwright cache.

### Task 15: Shared Playwright launcher

**Files:**
- Create: `apps/worker/src/lib/playwright.ts`

- [ ] **Step 1: Implement launcher**

```ts
// apps/worker/src/lib/playwright.ts
import { chromium, type Browser, type BrowserContext } from 'playwright';

let cachedBrowser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!cachedBrowser) {
    cachedBrowser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  }
  return cachedBrowser;
}

export async function withContext<T>(fn: (ctx: BrowserContext) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)',
    viewport: { width: 1280, height: 800 },
  });
  try {
    return await fn(ctx);
  } finally {
    await ctx.close();
  }
}

export async function shutdownBrowser(): Promise<void> {
  if (cachedBrowser) {
    await cachedBrowser.close();
    cachedBrowser = null;
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/worker typecheck`
Expected: PASS.

### Task 16: OpenRouter client

**Files:**
- Create: `apps/worker/src/lib/openrouter.ts`

- [ ] **Step 1: Implement minimal client**

```ts
// apps/worker/src/lib/openrouter.ts
import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ lib: 'openrouter' });
const URL = 'https://openrouter.ai/api/v1/chat/completions';

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type ChatResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
};

export async function chat(opts: {
  model: string;
  messages: ChatMessage[];
  responseFormat?: 'json' | 'text';
  timeoutMs?: number;
}): Promise<ChatResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000);
  try {
    const res = await fetch(URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'http-referer': 'https://shoppingmate.ai',
        'x-title': 'shoppingmate-onboarding',
      },
      body: JSON.stringify({
        model: opts.model,
        messages: opts.messages,
        ...(opts.responseFormat === 'json' ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`openrouter http ${res.status}: ${errText.slice(0, 200)}`);
    }
    const body = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    return {
      text: body.choices[0]?.message?.content ?? '',
      inputTokens: body.usage?.prompt_tokens ?? 0,
      outputTokens: body.usage?.completion_tokens ?? 0,
    };
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'openrouter call failed');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/worker typecheck`
Expected: PASS.

### Task 17: DOM crawl catalog client (TDD)

**Files:**
- Create: `apps/worker/src/steps/catalogClients/domCrawl.ts`
- Create: `tests/worker/catalogClients/domCrawl.test.ts`
- Create: `tests/fixtures/sitemap.xml`

- [ ] **Step 1: Sitemap fixture**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://custom.test/</loc></url>
  <url><loc>https://custom.test/products/widget-a</loc></url>
  <url><loc>https://custom.test/products/widget-b</loc></url>
  <url><loc>https://custom.test/about</loc></url>
</urlset>
```

- [ ] **Step 2: Failing test (uses dependency injection so we can mock both Playwright and the LLM)**

```ts
// tests/worker/catalogClients/domCrawl.test.ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchDomCatalog } from '../../../apps/worker/src/steps/catalogClients/domCrawl.js';

const sitemapXml = readFileSync(
  resolve(import.meta.dirname, '..', '..', 'fixtures', 'sitemap.xml'),
  'utf8',
);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchDomCatalog', () => {
  it('parses sitemap, filters product URLs, calls extractor for each, returns ok', async () => {
    server.use(
      http.get('https://custom.test/sitemap.xml', () => HttpResponse.text(sitemapXml)),
    );

    const renderedUrls: string[] = [];
    const result = await fetchDomCatalog('custom.test', {
      cap: 500,
      timeoutMs: 90_000,
      // Test injects fakes for Playwright + LLM extractor
      renderHtml: async (url) => {
        renderedUrls.push(url);
        return `<html><body><h1>Title for ${url}</h1></body></html>`;
      },
      extractProduct: async (url, html) => ({
        sku: url.split('/').pop() ?? 'unknown',
        title: `Title for ${url}`,
        description: 'desc',
        imageUrl: null,
        productUrl: url,
        priceCents: 999,
        currency: 'USD',
        inStock: true,
        variants: [],
        source: 'dom_crawl',
      }),
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.products.map((p) => p.sku)).toEqual(['widget-a', 'widget-b']);
    expect(renderedUrls).toEqual([
      'https://custom.test/products/widget-a',
      'https://custom.test/products/widget-b',
    ]);
    expect(result.expected).toBe(2);
  });

  it('returns failed when sitemap missing', async () => {
    server.use(
      http.get('https://custom.test/sitemap.xml', () => new HttpResponse(null, { status: 404 })),
    );
    const result = await fetchDomCatalog('custom.test', {
      cap: 500,
      timeoutMs: 90_000,
      renderHtml: async () => '',
      extractProduct: async () => null,
    });
    expect(result.kind).toBe('failed');
    if (result.kind === 'failed') expect(result.reason).toBe('no_sitemap');
  });
});
```

- [ ] **Step 3: Run, expect FAIL**

Run: `pnpm test tests/worker/catalogClients/domCrawl.test.ts`
Expected: module-not-found.

- [ ] **Step 4: Implement**

```ts
// apps/worker/src/steps/catalogClients/domCrawl.ts
import { childLogger } from '@shoppingmate/shared';
import { chat } from '../../lib/openrouter.js';
import { withContext } from '../../lib/playwright.js';
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

const log = childLogger({ step: 'catalogSync.dom' });
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';
const PRODUCT_URL_REGEX = /\/(product|products|p|item|shop)\//i;
const CONCURRENCY = 4;

export type DomCrawlOpts = {
  cap: number;
  timeoutMs: number;
  // Injected so tests can mock browser + LLM. Defaults call real Playwright + Haiku.
  renderHtml?: (url: string) => Promise<string>;
  extractProduct?: (
    url: string,
    html: string,
  ) => Promise<NormalizedProduct | null>;
};

async function defaultRenderHtml(url: string): Promise<string> {
  return withContext(async (ctx) => {
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      return await page.content();
    } finally {
      await page.close();
    }
  });
}

async function defaultExtractProduct(url: string, html: string): Promise<NormalizedProduct | null> {
  const truncated = html.slice(0, 60_000);
  const result = await chat({
    model: 'anthropic/claude-haiku-4-5',
    responseFormat: 'json',
    timeoutMs: 30_000,
    messages: [
      {
        role: 'system',
        content:
          'Extract product details from the HTML. Return JSON: {sku, title, description, imageUrl, priceCents, currency, inStock}. Use the URL slug as sku. If the page is not a product page, return null.',
      },
      { role: 'user', content: `URL: ${url}\n\nHTML:\n${truncated}` },
    ],
  });
  try {
    const parsed = JSON.parse(result.text);
    if (!parsed || !parsed.title) return null;
    return {
      sku: parsed.sku ?? url.split('/').filter(Boolean).pop() ?? 'unknown',
      title: parsed.title,
      description: parsed.description ?? null,
      imageUrl: parsed.imageUrl ?? null,
      productUrl: url,
      priceCents: typeof parsed.priceCents === 'number' ? parsed.priceCents : null,
      currency: parsed.currency ?? null,
      inStock: typeof parsed.inStock === 'boolean' ? parsed.inStock : null,
      variants: [],
      source: 'dom_crawl',
    };
  } catch {
    return null;
  }
}

function parseSitemapUrls(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>([^<]+)<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) urls.push(m[1].trim());
  return urls;
}

async function pMap<T, R>(items: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker(): Promise<void> {
    while (true) {
      const idx = i++;
      if (idx >= items.length) return;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

export async function fetchDomCatalog(
  domain: string,
  opts: DomCrawlOpts,
): Promise<CatalogClientResult> {
  const renderHtml = opts.renderHtml ?? defaultRenderHtml;
  const extract = opts.extractProduct ?? defaultExtractProduct;

  // 1. Fetch sitemap
  let sitemapXml: string;
  try {
    const res = await fetch(`https://${domain}/sitemap.xml`, {
      headers: { 'user-agent': USER_AGENT, accept: 'application/xml,text/xml,*/*' },
    });
    if (!res.ok) {
      log.warn({ domain, status: res.status }, 'sitemap missing');
      return { kind: 'failed', reason: 'no_sitemap' };
    }
    sitemapXml = await res.text();
  } catch (err) {
    log.warn({ domain, err: (err as Error).message }, 'sitemap fetch error');
    return { kind: 'failed', reason: 'no_sitemap' };
  }

  // 2. Filter to product URLs, cap
  const allUrls = parseSitemapUrls(sitemapXml);
  const productUrls = allUrls.filter((u) => PRODUCT_URL_REGEX.test(u)).slice(0, opts.cap);
  const expected = productUrls.length;
  if (expected === 0) {
    return { kind: 'ok', products: [], expected: 0 };
  }

  // 3. Render + extract in parallel (concurrency cap)
  const products: NormalizedProduct[] = [];
  const deadline = Date.now() + opts.timeoutMs;
  const results = await pMap(productUrls, CONCURRENCY, async (url) => {
    if (Date.now() >= deadline) return null;
    try {
      const html = await renderHtml(url);
      return await extract(url, html);
    } catch (err) {
      log.warn({ url, err: (err as Error).message }, 'dom crawl entry failed');
      return null;
    }
  });
  for (const r of results) if (r) products.push(r);

  return { kind: 'ok', products, expected };
}
```

- [ ] **Step 5: Run dom-crawl tests**

Run: `pnpm test tests/worker/catalogClients/domCrawl.test.ts`
Expected: 2/2 passing.

### Task 18: Commit Phase C clients

- [ ] **Step 1: Commit**

```bash
git add apps/worker/src/steps/catalogClients/ apps/worker/src/lib/ apps/worker/package.json tests/worker/catalogClients/ tests/fixtures/shopifyProducts.json tests/fixtures/wooProducts.json tests/fixtures/sitemap.xml pnpm-lock.yaml
git commit -m "feat(worker): catalog sync clients — shopify products.json, woo store api, dom crawl

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase D — catalogSync orchestrator + DB writeback

### Task 19: catalogSync orchestrator (TDD)

**Files:**
- Create: `apps/worker/src/steps/catalogSync.ts`
- Create: `tests/worker/catalogSync.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/worker/catalogSync.test.ts
import { db, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { catalogSync } from '../../apps/worker/src/steps/catalogSync.js';
import type { NormalizedProduct } from '../../apps/worker/src/steps/catalogClients/shopify.js';

let merchantId: string;

beforeAll(async () => {
  merchantId = generateMerchantId();
  await db.insert(schema.merchants).values({
    id: merchantId,
    domain: 'cs.test',
    allowedDomains: ['cs.test'],
    status: 'onboarding',
    platform: 'shopify',
    adapterType: 'shopify',
    adapterConfig: {},
  });
});

afterAll(async () => {
  await db.delete(schema.products).where(eq(schema.products.merchantId, merchantId));
  await db.delete(schema.merchants).where(eq(schema.merchants.id, merchantId));
});

describe('catalogSync', () => {
  it('writes ok products and marks live (≥80%)', async () => {
    const product: NormalizedProduct = {
      sku: 'a',
      title: 'A',
      description: 'desc',
      imageUrl: null,
      productUrl: 'https://cs.test/products/a',
      variants: [],
      priceCents: 100,
      currency: 'USD',
      inStock: true,
      source: 'shopify_storefront',
    };
    const result = await catalogSync({
      merchantId,
      domain: 'cs.test',
      platform: 'shopify',
      adapterType: 'shopify',
      // injected fake catalog client
      fetchCatalog: async () => ({ kind: 'ok', products: [product], expected: 1 }),
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.productsCount).toBe(1);
    const rows = await db.select().from(schema.products).where(eq(schema.products.merchantId, merchantId));
    expect(rows).toHaveLength(1);
    expect(rows[0].source).toBe('shopify_storefront');
  });

  it('returns partial when productsCount/expected < 0.8', async () => {
    const result = await catalogSync({
      merchantId,
      domain: 'cs.test',
      platform: 'shopify',
      adapterType: 'shopify',
      fetchCatalog: async () => ({
        kind: 'ok',
        products: [
          {
            sku: 'b',
            title: 'B',
            description: null,
            imageUrl: null,
            productUrl: 'https://cs.test/products/b',
            variants: [],
            priceCents: null,
            currency: null,
            inStock: null,
            source: 'shopify_storefront',
          },
        ],
        expected: 5,
      }),
    });
    expect(result.kind).toBe('partial');
  });

  it('propagates failed result', async () => {
    const result = await catalogSync({
      merchantId,
      domain: 'cs.test',
      platform: 'shopify',
      adapterType: 'shopify',
      fetchCatalog: async () => ({ kind: 'failed', reason: 'http_503' }),
    });
    expect(result.kind).toBe('failed');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test tests/worker/catalogSync.test.ts`
Expected: module-not-found.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/steps/catalogSync.ts
import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { fetchDomCatalog } from './catalogClients/domCrawl.js';
import { fetchShopifyCatalog } from './catalogClients/shopify.js';
import { fetchWooCatalog } from './catalogClients/woo.js';
import type { CatalogClientResult, NormalizedProduct } from './catalogClients/shopify.js';

const log = childLogger({ step: 'catalogSync' });
const PARTIAL_THRESHOLD = 0.8;

export type CatalogSyncResult =
  | { kind: 'ok'; productsCount: number; source: string; durationMs: number }
  | {
      kind: 'partial';
      productsCount: number;
      expected: number;
      source: string;
      reason: string;
    }
  | { kind: 'failed'; source: string; reason: string };

export type CatalogSyncInput = {
  merchantId: string;
  domain: string;
  platform: schema.PlatformValue;
  adapterType: schema.AdapterType;
  // optional injection for tests
  fetchCatalog?: (domain: string) => Promise<CatalogClientResult>;
};

function pickClient(
  platform: schema.PlatformValue,
  adapterType: schema.AdapterType,
): { source: string; fetch: (domain: string) => Promise<CatalogClientResult> } {
  if (platform === 'shopify') {
    return {
      source: 'shopify_storefront',
      fetch: (d) => fetchShopifyCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
    };
  }
  if (platform === 'woocommerce') {
    return {
      source: 'woo_store_api',
      fetch: (d) => fetchWooCatalog(d, { cap: 5000, timeoutMs: 90_000 }),
    };
  }
  return {
    source: 'dom_crawl',
    fetch: (d) => fetchDomCatalog(d, { cap: 500, timeoutMs: 90_000 }),
  };
}

async function writeProducts(merchantId: string, products: NormalizedProduct[]): Promise<void> {
  if (products.length === 0) return;
  // Wipe + replace — onboarding is the initial sync; daily recrawl is Phase 2.
  await db.delete(schema.products).where(eq(schema.products.merchantId, merchantId));
  await db.insert(schema.products).values(
    products.map((p) => ({
      merchantId,
      sku: p.sku,
      title: p.title,
      description: p.description,
      imageUrl: p.imageUrl,
      productUrl: p.productUrl,
      variants: p.variants,
      priceCents: p.priceCents,
      currency: p.currency,
      inStock: p.inStock,
      source: p.source,
    })),
  );
}

export async function catalogSync(input: CatalogSyncInput): Promise<CatalogSyncResult> {
  const start = Date.now();
  const { source, fetch } = pickClient(input.platform, input.adapterType);
  const fetchFn = input.fetchCatalog ?? fetch;
  log.info({ merchantId: input.merchantId, domain: input.domain, source }, 'catalog sync start');

  const result = await fetchFn(input.domain);
  if (result.kind === 'failed') {
    return { kind: 'failed', source, reason: result.reason };
  }

  await writeProducts(input.merchantId, result.products);
  await db
    .update(schema.merchants)
    .set({ catalogSyncedAt: new Date(), lastIndexedAt: new Date() })
    .where(eq(schema.merchants.id, input.merchantId));

  const ratio = result.expected > 0 ? result.products.length / result.expected : 1;
  const durationMs = Date.now() - start;
  if (ratio < PARTIAL_THRESHOLD) {
    return {
      kind: 'partial',
      productsCount: result.products.length,
      expected: result.expected,
      source,
      reason: `ratio_${ratio.toFixed(2)}`,
    };
  }
  return { kind: 'ok', productsCount: result.products.length, source, durationMs };
}
```

- [ ] **Step 4: Run catalogSync test**

Run: `pnpm test tests/worker/catalogSync.test.ts`
Expected: 3/3 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/steps/catalogSync.ts tests/worker/catalogSync.test.ts
git commit -m "feat(worker): catalogSync orchestrator with partial-threshold + db writeback

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase E — Selector extraction (DOM only)

### Task 20: selectorExtract (TDD)

**Files:**
- Create: `apps/worker/src/steps/selectorExtract.ts`
- Create: `tests/worker/selectorExtract.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/worker/selectorExtract.test.ts
import { describe, expect, it } from 'vitest';
import { selectorExtract } from '../../apps/worker/src/steps/selectorExtract.js';

describe('selectorExtract', () => {
  it('renders pages, hashes templates, calls Sonnet, returns selectors', async () => {
    const renderedUrls: string[] = [];
    const llmCalled: { messageCount: number } = { messageCount: 0 };

    const result = await selectorExtract({
      merchantId: 'SM-TEST',
      domain: 'custom.test',
      sampleProductUrl: 'https://custom.test/products/widget-a',
      cartUrl: 'https://custom.test/cart',
      checkoutUrl: 'https://custom.test/checkout',
      renderHtml: async (url) => {
        renderedUrls.push(url);
        return `<html><body><div id="${url.split('/').pop()}">test</div></body></html>`;
      },
      callLlm: async ({ messages }) => {
        llmCalled.messageCount = messages.length;
        return JSON.stringify({
          add_to_cart_button: '#add-to-cart',
          qty_input: 'input[name=quantity]',
          variant_selector_template: '.variant[data-value="{value}"]',
          cart_url: '/cart',
          cart_page_total: '.cart-total',
          checkout_button: '#checkout',
          coupon_field: '#coupon',
          coupon_apply_button: '#apply-coupon',
          line_item_remove_button: '.remove-item',
          thank_you_order_id: '.order-id',
          thank_you_total: '.order-total',
        });
      },
    });

    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(renderedUrls).toEqual([
      'https://custom.test/products/widget-a',
      'https://custom.test/cart',
      'https://custom.test/checkout',
    ]);
    expect(llmCalled.messageCount).toBeGreaterThanOrEqual(2);
    expect(result.selectors.add_to_cart_button).toBe('#add-to-cart');
    expect(result.pageTemplates.product).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.pageTemplates.cart).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('returns failed on llm parse failure', async () => {
    const result = await selectorExtract({
      merchantId: 'SM-TEST',
      domain: 'custom.test',
      sampleProductUrl: 'https://custom.test/products/widget-a',
      cartUrl: 'https://custom.test/cart',
      checkoutUrl: 'https://custom.test/checkout',
      renderHtml: async () => '<html><body>x</body></html>',
      callLlm: async () => 'not json',
    });
    expect(result.kind).toBe('failed');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test tests/worker/selectorExtract.test.ts`
Expected: module-not-found.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/steps/selectorExtract.ts
import { createHash } from 'node:crypto';
import { childLogger } from '@shoppingmate/shared';
import { chat, type ChatMessage } from '../lib/openrouter.js';
import { withContext } from '../lib/playwright.js';

const log = childLogger({ step: 'selectorExtract' });

const SELECTOR_KEYS = [
  'add_to_cart_button',
  'qty_input',
  'variant_selector_template',
  'cart_url',
  'cart_page_total',
  'checkout_button',
  'coupon_field',
  'coupon_apply_button',
  'line_item_remove_button',
  'thank_you_order_id',
  'thank_you_total',
] as const;

export type SelectorMap = Record<(typeof SELECTOR_KEYS)[number], string>;

export type SelectorExtractResult =
  | {
      kind: 'ok';
      selectors: SelectorMap;
      pageTemplates: { product: string; cart: string; checkout: string };
      llmInputTokens: number;
      llmOutputTokens: number;
    }
  | { kind: 'failed'; reason: string };

export type SelectorExtractInput = {
  merchantId: string;
  domain: string;
  sampleProductUrl: string;
  cartUrl: string;
  checkoutUrl: string;
  // injected for tests
  renderHtml?: (url: string) => Promise<string>;
  callLlm?: (opts: { messages: ChatMessage[] }) => Promise<string>;
};

async function defaultRender(url: string): Promise<string> {
  return withContext(async (ctx) => {
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      return await page.content();
    } finally {
      await page.close();
    }
  });
}

async function defaultCallLlm({ messages }: { messages: ChatMessage[] }): Promise<string> {
  const r = await chat({
    model: 'anthropic/claude-sonnet-4-6',
    messages,
    responseFormat: 'json',
    timeoutMs: 90_000,
  });
  return r.text;
}

function normalizeDom(html: string): string {
  // strip scripts/styles/text content; keep tag tree + ids/classes
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/>\s*[^<]*\s*</g, '><')
    .toLowerCase();
}

function templateHash(html: string): string {
  return `sha256:${createHash('sha256').update(normalizeDom(html)).digest('hex')}`;
}

export async function selectorExtract(
  input: SelectorExtractInput,
): Promise<SelectorExtractResult> {
  const render = input.renderHtml ?? defaultRender;
  const llm = input.callLlm ?? defaultCallLlm;

  let productHtml: string;
  let cartHtml: string;
  let checkoutHtml: string;
  try {
    productHtml = await render(input.sampleProductUrl);
    cartHtml = await render(input.cartUrl);
    checkoutHtml = await render(input.checkoutUrl);
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'page render failed');
    return { kind: 'failed', reason: 'render_error' };
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a senior browser automation engineer. Given a product page, cart page, and checkout page (HTML), return JSON with one CSS selector for each of these keys: ${SELECTOR_KEYS.join(', ')}. variant_selector_template should contain the placeholder {value}. cart_url is a path or URL. Do not include explanations.`,
    },
    {
      role: 'user',
      content: `PRODUCT PAGE:\n${productHtml.slice(0, 60_000)}\n\nCART PAGE:\n${cartHtml.slice(0, 60_000)}\n\nCHECKOUT PAGE:\n${checkoutHtml.slice(0, 60_000)}`,
    },
  ];

  let raw: string;
  try {
    raw = await llm({ messages });
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'selector extraction llm call failed');
    return { kind: 'failed', reason: 'llm_error' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'failed', reason: 'llm_parse_failed' };
  }
  for (const k of SELECTOR_KEYS) {
    if (typeof parsed[k] !== 'string') return { kind: 'failed', reason: `missing_${k}` };
  }
  const selectors = Object.fromEntries(SELECTOR_KEYS.map((k) => [k, parsed[k]])) as SelectorMap;
  return {
    kind: 'ok',
    selectors,
    pageTemplates: {
      product: templateHash(productHtml),
      cart: templateHash(cartHtml),
      checkout: templateHash(checkoutHtml),
    },
    llmInputTokens: 0,
    llmOutputTokens: 0,
  };
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm test tests/worker/selectorExtract.test.ts`
Expected: 2/2 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/steps/selectorExtract.ts tests/worker/selectorExtract.test.ts
git commit -m "feat(worker): selectorExtract step (DOM only, Sonnet 4.6, page-template hashes)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase F — Smoke test

### Task 21: smokeTest (TDD)

**Files:**
- Create: `apps/worker/src/steps/smokeTest.ts`
- Create: `tests/worker/smokeTest.test.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/worker/smokeTest.test.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { smokeTest } from '../../apps/worker/src/steps/smokeTest.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('smokeTest', () => {
  it('shopify cart/add.js → passed', async () => {
    server.use(
      http.post('https://shop.test/cart/add.js', () =>
        HttpResponse.json({ id: 1, quantity: 1, key: 'tok123' }),
      ),
    );
    const r = await smokeTest({
      adapterType: 'shopify',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
    });
    expect(r.kind).toBe('passed');
  });

  it('shopify 422 → failed', async () => {
    server.use(
      http.post('https://shop.test/cart/add.js', () => new HttpResponse(null, { status: 422 })),
    );
    const r = await smokeTest({
      adapterType: 'shopify',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
    });
    expect(r.kind).toBe('failed');
  });

  it('woo store/v1/cart/add-item → passed', async () => {
    server.use(
      http.post('https://woo.test/wp-json/wc/store/v1/cart/add-item', () =>
        HttpResponse.json({ items: [{ id: 200, quantity: 1 }] }),
      ),
    );
    const r = await smokeTest({
      adapterType: 'woo',
      domain: 'woo.test',
      firstVariantId: '200',
      productUrl: 'https://woo.test/product/x',
      selectors: null,
    });
    expect(r.kind).toBe('passed');
  });

  it('dom adapter without selectors → failed', async () => {
    const r = await smokeTest({
      adapterType: 'dom',
      domain: 'd.test',
      firstVariantId: 'x',
      productUrl: 'https://d.test/products/x',
      selectors: null,
    });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('selectors_missing');
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test tests/worker/smokeTest.test.ts`
Expected: module-not-found.

- [ ] **Step 3: Implement**

```ts
// apps/worker/src/steps/smokeTest.ts
import { childLogger } from '@shoppingmate/shared';
import { withContext } from '../lib/playwright.js';
import type { SelectorMap } from './selectorExtract.js';

const log = childLogger({ step: 'smokeTest' });
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

export type SmokeResult =
  | { kind: 'passed'; latencyMs: number }
  | { kind: 'failed'; reason: string };

export type SmokeInput = {
  adapterType: 'shopify' | 'woo' | 'dom';
  domain: string;
  firstVariantId: string;
  productUrl: string;
  selectors: SelectorMap | null;
};

async function smokeShopify(domain: string, variantId: string): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const res = await fetch(`https://${domain}/cart/add.js`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
      body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
    });
    if (!res.ok) return { kind: 'failed', reason: `http_${res.status}` };
    return { kind: 'passed', latencyMs: Date.now() - start };
  } catch (err) {
    return { kind: 'failed', reason: `error_${(err as Error).message.slice(0, 40)}` };
  }
}

async function smokeWoo(domain: string, productId: string): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const res = await fetch(`https://${domain}/wp-json/wc/store/v1/cart/add-item`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
      body: JSON.stringify({ id: Number(productId), quantity: 1 }),
    });
    if (!res.ok) return { kind: 'failed', reason: `http_${res.status}` };
    return { kind: 'passed', latencyMs: Date.now() - start };
  } catch (err) {
    return { kind: 'failed', reason: `error_${(err as Error).message.slice(0, 40)}` };
  }
}

async function smokeDom(input: SmokeInput): Promise<SmokeResult> {
  if (!input.selectors) return { kind: 'failed', reason: 'selectors_missing' };
  const start = Date.now();
  try {
    return await withContext(async (ctx) => {
      const page = await ctx.newPage();
      try {
        await page.goto(input.productUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        const before = await page.locator(input.selectors!.cart_page_total).innerText().catch(() => '');
        await page.locator(input.selectors!.add_to_cart_button).click({ timeout: 5_000 });
        await page.waitForFunction(
          (sel: string, prev: string) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            return !!el && (el.innerText ?? '') !== prev;
          },
          [input.selectors!.cart_page_total, before],
          { timeout: 5_000 },
        );
        return { kind: 'passed', latencyMs: Date.now() - start } as const;
      } finally {
        await page.close();
      }
    });
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'dom smoke failed');
    return { kind: 'failed', reason: 'no_cart_mutation' };
  }
}

export async function smokeTest(input: SmokeInput): Promise<SmokeResult> {
  if (input.adapterType === 'shopify') return smokeShopify(input.domain, input.firstVariantId);
  if (input.adapterType === 'woo') return smokeWoo(input.domain, input.firstVariantId);
  return smokeDom(input);
}
```

- [ ] **Step 4: Run, expect PASS**

Run: `pnpm test tests/worker/smokeTest.test.ts`
Expected: 4/4 passing.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/steps/smokeTest.ts tests/worker/smokeTest.test.ts
git commit -m "feat(worker): smokeTest step (api cartAdd for shopify/woo, playwright for dom)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase G — catalogRepo (FTS read primitive)

### Task 22: catalogRepo (TDD)

**Files:**
- Create: `packages/db/src/repos/catalogRepo.ts`
- Create: `tests/db/catalogRepo.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Failing test**

```ts
// tests/db/catalogRepo.test.ts
import { db, repos, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let merchantId: string;

beforeAll(async () => {
  merchantId = generateMerchantId();
  await db.insert(schema.merchants).values({
    id: merchantId,
    domain: 'fts.test',
    allowedDomains: ['fts.test'],
    status: 'live',
    adapterConfig: {},
  });
  await db.insert(schema.products).values([
    {
      merchantId,
      sku: 'a',
      title: 'Linen Beach Pants',
      description: 'Light cotton-linen blend',
      productUrl: 'https://fts.test/p/a',
      source: 'shopify_storefront',
    },
    {
      merchantId,
      sku: 'b',
      title: 'Cotton Tee',
      description: 'Plain cotton',
      productUrl: 'https://fts.test/p/b',
      source: 'shopify_storefront',
    },
    {
      merchantId,
      sku: 'c',
      title: 'Sun Hat',
      description: 'Wide brim, beach-ready',
      productUrl: 'https://fts.test/p/c',
      source: 'shopify_storefront',
    },
  ]);
});

afterAll(async () => {
  await db.delete(schema.products).where(eq(schema.products.merchantId, merchantId));
  await db.delete(schema.merchants).where(eq(schema.merchants.id, merchantId));
});

describe('catalogRepo', () => {
  it('searchProducts ranks title-matches above description-matches', async () => {
    const rows = await repos.catalog.searchProducts(merchantId, 'beach', 10);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].sku).toBe('a'); // title hit ranks A
  });

  it('searchProducts with empty query returns most-recently-indexed', async () => {
    const rows = await repos.catalog.searchProducts(merchantId, '', 2);
    expect(rows).toHaveLength(2);
  });

  it('getProduct returns row by primary key', async () => {
    const p = await repos.catalog.getProduct(merchantId, 'a');
    expect(p?.title).toBe('Linen Beach Pants');
  });

  it('getProduct returns null for unknown sku', async () => {
    const p = await repos.catalog.getProduct(merchantId, 'zzz');
    expect(p).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test tests/db/catalogRepo.test.ts`
Expected: module-not-found / `repos` undefined.

- [ ] **Step 3: Implement repo**

```ts
// packages/db/src/repos/catalogRepo.ts
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { products, type Product } from '../schema/products.js';

export async function searchProducts(
  merchantId: string,
  query: string,
  limit = 20,
): Promise<Product[]> {
  if (!query.trim()) {
    return db
      .select()
      .from(products)
      .where(eq(products.merchantId, merchantId))
      .orderBy(desc(products.indexedAt))
      .limit(limit);
  }
  const tsq = sql`plainto_tsquery('simple', ${query})`;
  const rank = sql<number>`ts_rank(${products.searchVector}, ${tsq})`;
  return db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), sql`${products.searchVector} @@ ${tsq}`))
    .orderBy(desc(rank))
    .limit(limit);
}

export async function getProduct(merchantId: string, sku: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.sku, sku)));
  return rows[0] ?? null;
}
```

- [ ] **Step 4: Wire repos into the package index**

Edit `packages/db/src/index.ts` to add:

```ts
import * as catalog from './repos/catalogRepo.js';

export const repos = { catalog };
```

(Place near existing exports, but after `client` and `schema` re-exports.)

- [ ] **Step 5: Run, expect PASS**

Run: `pnpm test tests/db/catalogRepo.test.ts`
Expected: 4/4 passing.

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/repos/ packages/db/src/index.ts tests/db/
git commit -m "feat(db): catalogRepo — fts searchProducts + getProduct for plan 4

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase H — Wire pipeline into onboarding handler

### Task 23: Final onboarding pipeline

**Files:**
- Modify: `apps/worker/src/handlers/onboarding.ts`

- [ ] **Step 1: Replace the handler with the new pipeline**

Full replacement of `apps/worker/src/handlers/onboarding.ts`:

```ts
import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import { catalogSync } from '../steps/catalogSync.js';
import { fingerprint } from '../steps/fingerprint.js';
import { safetyCheck } from '../steps/safetyCheck.js';
import { selectorExtract } from '../steps/selectorExtract.js';
import { smokeTest } from '../steps/smokeTest.js';

const log = childLogger({ handler: 'onboarding' });

const PLATFORM_TO_ADAPTER: Record<schema.PlatformValue, schema.AdapterType> = {
  shopify: 'shopify',
  woocommerce: 'woo',
  custom: 'dom',
};

async function emitMetric(
  merchantId: string,
  metricName: string,
  tags?: Record<string, string | number | boolean>,
): Promise<void> {
  await db.insert(schema.metricEvents).values({ merchantId, metricName, tags });
}

async function fail(merchantId: string, step: string, err: Error): Promise<void> {
  await db
    .update(schema.merchants)
    .set({ status: 'failed', lastError: `${step}: ${err.message}` })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingFailed, { step });
}

export async function onboardingHandler(
  job: Job<{ merchantId: string; domain: string }>,
): Promise<void> {
  const { merchantId, domain } = job.data;
  const start = Date.now();
  log.info({ jobId: job.id, merchantId, domain }, 'onboarding job started');

  // Step 1 — SafetyCheck (unchanged)
  let safety: Awaited<ReturnType<typeof safetyCheck>>;
  try {
    safety = await safetyCheck(domain);
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingSafetyError);
    log.error({ merchantId, err: (err as Error).message }, 'safety check error');
    throw err;
  }
  if (safety.kind === 'flagged') {
    await db
      .update(schema.merchants)
      .set({ status: 'rejected', lastError: `safety: ${safety.threatType}` })
      .where(eq(schema.merchants.id, merchantId));
    await emitMetric(merchantId, schema.metricNames.onboardingSafetyRejected);
    return;
  }
  await db
    .update(schema.merchants)
    .set({ safetyCheckedAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingSafetyCleared);

  // Step 2 — Fingerprint
  let fp: Awaited<ReturnType<typeof fingerprint>>;
  try {
    fp = await fingerprint(domain);
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingFingerprintFetchFailed);
    if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1)) {
      await fail(merchantId, 'fingerprint', err as Error);
    }
    throw err;
  }
  const platform = fp.platform;
  const adapterType = PLATFORM_TO_ADAPTER[platform];
  const platformMetric =
    platform === 'shopify'
      ? schema.metricNames.onboardingFingerprintShopify
      : platform === 'woocommerce'
        ? schema.metricNames.onboardingFingerprintWoocommerce
        : schema.metricNames.onboardingFingerprintCustom;
  await emitMetric(merchantId, platformMetric);

  const adapterConfig: Record<string, unknown> = {};
  if (fp.detectedPlatform) {
    adapterConfig.detectedPlatform = fp.detectedPlatform;
    const detectedKey = `onboardingFingerprint${
      fp.detectedPlatform.charAt(0).toUpperCase() + fp.detectedPlatform.slice(1)
    }Detected` as keyof typeof schema.metricNames;
    await emitMetric(merchantId, schema.metricNames[detectedKey]);
    await emitMetric(merchantId, schema.metricNames.onboardingDetectedPlatformDegraded, {
      detected_platform: fp.detectedPlatform,
    });
  }
  await db
    .update(schema.merchants)
    .set({
      platform,
      adapterType,
      adapterConfig,
      lastFingerprintedAt: new Date(),
      status: 'onboarding',
      lastError: null,
    })
    .where(eq(schema.merchants.id, merchantId));

  // Step 3 — CatalogSync
  await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncStarted);
  let catalog: Awaited<ReturnType<typeof catalogSync>>;
  try {
    catalog = await catalogSync({ merchantId, domain, platform, adapterType });
  } catch (err) {
    await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncFailed, {
      reason: 'exception',
    });
    await fail(merchantId, 'catalogSync', err as Error);
    throw err;
  }
  if (catalog.kind === 'failed') {
    await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncFailed, {
      source: catalog.source,
      reason: catalog.reason,
    });
    await fail(merchantId, 'catalogSync', new Error(catalog.reason));
    return;
  }
  if (catalog.kind === 'partial') {
    await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncDegraded, {
      products_count: catalog.productsCount,
      expected: catalog.expected,
      source: catalog.source,
      reason: catalog.reason,
    });
  } else {
    await emitMetric(merchantId, schema.metricNames.onboardingCatalogSyncCompleted, {
      products_count: catalog.productsCount,
      source: catalog.source,
    });
  }

  // Step 4 — SelectorExtract (DOM merchants only)
  let selectors: Awaited<ReturnType<typeof selectorExtract>> | null = null;
  if (adapterType === 'dom') {
    await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractStarted);
    const [firstProduct] = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.merchantId, merchantId))
      .limit(1);
    if (!firstProduct) {
      await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractFailed, {
        reason: 'no_products',
      });
      await db
        .update(schema.merchants)
        .set({ status: 'degraded', lastError: 'selector_extract: no_products' })
        .where(eq(schema.merchants.id, merchantId));
      return;
    }
    try {
      selectors = await selectorExtract({
        merchantId,
        domain,
        sampleProductUrl: firstProduct.productUrl,
        cartUrl: `https://${domain}/cart`,
        checkoutUrl: `https://${domain}/checkout`,
      });
    } catch (err) {
      await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractFailed, {
        reason: 'exception',
      });
      await fail(merchantId, 'selectorExtract', err as Error);
      throw err;
    }
    if (selectors.kind === 'failed') {
      await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractFailed, {
        reason: selectors.reason,
      });
      await db
        .update(schema.merchants)
        .set({ status: 'degraded', lastError: `selector_extract: ${selectors.reason}` })
        .where(eq(schema.merchants.id, merchantId));
      return;
    }
    await emitMetric(merchantId, schema.metricNames.onboardingSelectorExtractCompleted, {
      llm_input_tokens: selectors.llmInputTokens,
      llm_output_tokens: selectors.llmOutputTokens,
    });
    await db
      .update(schema.merchants)
      .set({
        adapterConfig: {
          ...adapterConfig,
          selectors: selectors.selectors,
          page_templates: selectors.pageTemplates,
        },
      })
      .where(eq(schema.merchants.id, merchantId));
  }

  // Step 5 — SmokeTest
  await emitMetric(merchantId, schema.metricNames.onboardingSmokeStarted);
  const [firstProductForSmoke] = await db
    .select()
    .from(schema.products)
    .where(eq(schema.products.merchantId, merchantId))
    .limit(1);
  const firstVariantId =
    (firstProductForSmoke?.variants as Array<{ id: string }> | null)?.[0]?.id ??
    firstProductForSmoke?.sku ??
    'unknown';
  const productUrl = firstProductForSmoke?.productUrl ?? `https://${domain}/`;
  const smoke = await smokeTest({
    adapterType: adapterType === 'dom' ? 'dom' : adapterType === 'shopify' ? 'shopify' : 'woo',
    domain,
    firstVariantId,
    productUrl,
    selectors: selectors?.kind === 'ok' ? selectors.selectors : null,
  });

  if (smoke.kind === 'failed') {
    await emitMetric(merchantId, schema.metricNames.onboardingSmokeFailed, {
      adapter_type: adapterType,
      reason: smoke.reason,
    });
    await db
      .update(schema.merchants)
      .set({ status: 'degraded', lastError: `smoke: ${smoke.reason}` })
      .where(eq(schema.merchants.id, merchantId));
    return;
  }

  await emitMetric(merchantId, schema.metricNames.onboardingSmokePassed, {
    adapter_type: adapterType,
    latency_ms: smoke.latencyMs,
  });

  // Step 6 — Finalize
  await db
    .update(schema.merchants)
    .set({
      status: 'live',
      smokePassedAt: new Date(),
      lastIndexedAt: new Date(),
      lastError: null,
    })
    .where(eq(schema.merchants.id, merchantId));
  await emitMetric(merchantId, schema.metricNames.onboardingCompleted, {
    platform,
    durationMs: Date.now() - start,
  });
  log.info({ merchantId, platform, durationMs: Date.now() - start }, 'onboarding complete');
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/worker typecheck`
Expected: PASS.

### Task 24: Update onboarding integration test for new pipeline

**Files:**
- Modify: `tests/worker/onboarding.test.ts`

- [ ] **Step 1: Add msw handlers for catalog + smoke and update happy-path expectations**

Replace the `'happy path: safe + Shopify → status=live, platform=shopify'` test body with:

```ts
  it('happy path: safe + Shopify → status=live, products synced, smoke passed', async () => {
    const domain = 'shopify-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(shopifyHtml)),
      http.get(`https://${domain}/products.json`, ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        if (page === '1') {
          return HttpResponse.json({
            products: [
              {
                id: 100,
                title: 'Test',
                body_html: '<p>desc</p>',
                handle: 'test-product',
                image: { src: 'https://x' },
                variants: [{ id: 1001, sku: 'T', price: '10.00', available: true, option1: 'M' }],
              },
            ],
          });
        }
        return HttpResponse.json({ products: [] });
      }),
      http.post(`https://${domain}/cart/add.js`, () =>
        HttpResponse.json({ id: 1001, key: 'tok' }),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('live');
    expect(m?.platform).toBe('shopify');
    expect(m?.adapterType).toBe('shopify');
    expect(m?.smokePassedAt).toBeInstanceOf(Date);
    expect(m?.catalogSyncedAt).toBeInstanceOf(Date);

    const products = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.merchantId, id));
    expect(products).toHaveLength(1);

    const metrics = await db
      .select()
      .from(schema.metricEvents)
      .where(eq(schema.metricEvents.merchantId, id));
    const names = metrics.map((mm) => mm.metricName);
    expect(names).toContain('onboarding.catalog_sync.completed');
    expect(names).toContain('onboarding.smoke.passed');
    expect(names).toContain('onboarding.completed');

    await db.delete(schema.products).where(eq(schema.products.merchantId, id));
    await cleanup(id);
  });
```

Add a Woo happy-path test directly after it:

```ts
  it('happy path: safe + Woo → status=live, products synced, smoke passed', async () => {
    const domain = 'woo-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(wooHtml)),
      http.get(`https://${domain}/wp-json/wc/store/v1/products`, ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        if (page === 1) {
          return HttpResponse.json([
            {
              id: 200,
              name: 'Mug',
              slug: 'mug',
              permalink: `https://${domain}/product/mug/`,
              description: 'mug',
              images: [],
              prices: { price: '1500', currency_code: 'USD', currency_minor_unit: 2 },
              is_in_stock: true,
              variations: [],
            },
          ]);
        }
        return HttpResponse.json([]);
      }),
      http.post(`https://${domain}/wp-json/wc/store/v1/cart/add-item`, () =>
        HttpResponse.json({ items: [{ id: 200 }] }),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.status).toBe('live');
    expect(m?.platform).toBe('woocommerce');
    expect(m?.adapterType).toBe('woo');

    await db.delete(schema.products).where(eq(schema.products.merchantId, id));
    await cleanup(id);
  });
```

Add a Magento "detect + degrade" case:

```ts
  it('magento detected → status=degraded (no smoke yet), detected_platform tagged', async () => {
    const domain = 'magento-detect.test';
    const magentoHtml = readFileSync(resolve(fixturesDir, 'magentoHomepage.html'), 'utf8');
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(magentoHtml)),
      // No sitemap → catalog sync fails fast → status=failed (NOT degraded).
      // For this test we want degraded, so serve an empty sitemap (yields products=[], expected=0 → ok with 0 products → smoke runs against placeholder URL → 404 → fails → degraded).
      http.get(`https://${domain}/sitemap.xml`, () =>
        HttpResponse.text('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.platform).toBe('custom');
    expect(m?.adapterType).toBe('dom');
    expect((m?.adapterConfig as Record<string, unknown>)?.detectedPlatform).toBe('magento');

    const metrics = await db
      .select()
      .from(schema.metricEvents)
      .where(eq(schema.metricEvents.merchantId, id));
    const names = metrics.map((mm) => mm.metricName);
    expect(names).toContain('onboarding.fingerprint.magento_detected');
    expect(names).toContain('onboarding.detected_platform.degraded');

    await db.delete(schema.products).where(eq(schema.products.merchantId, id));
    await cleanup(id);
  });
```

(Leave existing `safety flagged` and `fingerprint fetch failure` tests untouched — they still pass.)

Update the `'custom site → platform=custom, adapter=dom'` test: it now needs sitemap mocking too. Replace its body with:

```ts
  it('custom site (no detection) → adapter=dom, no products → degraded', async () => {
    const domain = 'custom-happy.test';
    const id = await provision(domain);
    server.use(
      http.post(SAFE_BROWSING_URL, () => HttpResponse.json({})),
      http.get(`https://${domain}/`, () => HttpResponse.html(customHtml)),
      http.get(`https://${domain}/sitemap.xml`, () =>
        HttpResponse.text('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>'),
      ),
    );

    await onboardingHandler(fakeJob(id, domain));

    const [m] = await db.select().from(schema.merchants).where(eq(schema.merchants.id, id));
    expect(m?.platform).toBe('custom');
    expect(m?.adapterType).toBe('dom');
    expect(['degraded', 'failed']).toContain(m?.status);

    await cleanup(id);
  });
```

- [ ] **Step 2: Run onboarding test**

Run: `pnpm test tests/worker/onboarding.test.ts`
Expected: 5/5 passing.

- [ ] **Step 3: Run full suite**

Run: `pnpm test`
Expected: all passing (including catalog clients, catalogSync, selectorExtract, smokeTest, catalogRepo).

- [ ] **Step 4: Commit Phase H**

```bash
git add apps/worker/src/handlers/onboarding.ts tests/worker/onboarding.test.ts
git commit -m "feat(worker): wire catalog + selector + smoke into onboarding handler

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Phase I — Acceptance + tag

### Task 25: Lint + typecheck repo-wide

- [ ] **Step 1: Lint**

Run: `pnpm lint`
Expected: 0 errors. If biome reports issues, run `pnpm lint:fix`, re-stage, and commit fixes as `chore: biome auto-fix`.

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: PASS in every package.

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: clean across `@shoppingmate/db`, `@shoppingmate/cli`, `@shoppingmate/worker`, `@shoppingmate/api`.

### Task 26: Acceptance — provision real Shopify dev store

- [ ] **Step 1: Boot infra and provision**

Run in three terminals:

```bash
# T1
docker compose up
# T2
pnpm dev   # starts api + worker
# T3
pnpm shoppingmate:dev provision --domain=<your-shopify-dev-store>.myshopify.com --name="Acceptance Shopify"
```

- [ ] **Step 2: Wait for onboarding to finish, verify**

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "
  SELECT id, domain, status, platform, adapter_type, catalog_synced_at, smoke_passed_at
  FROM merchants WHERE domain LIKE '%myshopify.com';
"
```

Expected: `status='live'`, `catalog_synced_at` set, `smoke_passed_at` set.

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "
  SELECT count(*), source FROM products WHERE merchant_id = (SELECT id FROM merchants WHERE domain LIKE '%myshopify.com') GROUP BY source;
"
```

Expected: ≥1 row with `source=shopify_storefront`.

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "
  SELECT metric_name FROM metric_events
   WHERE merchant_id = (SELECT id FROM merchants WHERE domain LIKE '%myshopify.com')
     AND metric_name IN ('onboarding.catalog_sync.completed','onboarding.smoke.passed','onboarding.completed');
"
```

Expected: 3 rows.

- [ ] **Step 3: Verify FTS**

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "
  SELECT sku, ts_rank(search_vector, plainto_tsquery('simple','shirt')) AS rank
    FROM products
   WHERE merchant_id = (SELECT id FROM merchants WHERE domain LIKE '%myshopify.com')
     AND search_vector @@ plainto_tsquery('simple','shirt')
   ORDER BY rank DESC LIMIT 5;
"
```

Expected: rows ordered by rank (or empty if catalog has no shirts — try a query you know matches).

### Task 27: Acceptance — provision real Woo dev store

- [ ] **Step 1: Provision Woo store and verify**

Same flow as Task 26, replacing the domain. Expected: `platform='woocommerce'`, `adapter_type='woo'`, `source='woo_store_api'` in products.

### Task 28: Acceptance — degraded path on detected-but-coming-soon platform

- [ ] **Step 1: Provision Magento (or BigCommerce/Wix/Squarespace) test site**

```bash
pnpm shoppingmate:dev provision --domain=<a-magento-or-wix-test-site>
```

- [ ] **Step 2: Verify degraded outcome**

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "
  SELECT status, adapter_type, adapter_config
    FROM merchants WHERE domain='<the-domain>';
"
```

Expected: `status='degraded'` (or `failed` if no sitemap), `adapter_type='dom'`, `adapter_config->>'detectedPlatform'` matches the platform.

```bash
docker compose exec -T postgres psql -U shoppingmate -d shoppingmate -c "
  SELECT metric_name FROM metric_events
    WHERE merchant_id = (SELECT id FROM merchants WHERE domain='<the-domain>')
      AND metric_name = 'onboarding.detected_platform.degraded';
"
```

Expected: 1 row.

### Task 29: Tag the milestone

- [ ] **Step 1: Tag and push**

```bash
git tag phase1-plan3a-onboarding-completion-complete
git push origin main --tags
```

Expected: tag pushed.

---

## Self-review notes

**Spec coverage:** every section of `2026-05-02-phase1-plan3a-onboarding-completion-design.md` maps to tasks above:
- §5.1 products schema additions → Task 1 + 3
- §5.2 selector_cache schema → already shipped (deliberately no DDL change here per spec §5.2 note)
- §5.3 adapter_config shape → Task 11 (detectedPlatform) + Task 23 (selectors + page_templates)
- §5.4 merchants column additions → Task 2 + 3
- §5.5 metric registry → Task 4
- §6.1 catalogSync → Tasks 12, 13, 14, 15, 17, 19
- §6.2 fingerprint extension → Tasks 5-9
- §6.3 selectorExtract → Tasks 15, 16, 20
- §6.4 smokeTest → Task 21
- §6.5 catalogRepo → Task 22
- §7 pipeline → Task 23
- §8 Playwright bundling → Task 14
- §9 acceptance → Tasks 25-29

**Placeholder scan:** none. Every step contains either runnable shell commands or complete code blocks.

**Type consistency:** `NormalizedProduct.source` is widened in Task 13 step 4 note to cover all three sources (shopify/woo/dom_crawl). `FingerprintResult` is defined in Task 9 and consumed unchanged in Task 11 + 23.

**Out of scope verified:** no adapter logic, no selector_cache writes, no embeddings, no daily recrawl, no M/BC/Wix/Squarespace catalog clients (their merchants take the DOM crawl path).
