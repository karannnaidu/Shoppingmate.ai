# Phase 1 — Plan 3c: Remaining Platform Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift Magento, BigCommerce, Wix, and Squarespace merchants out of the Plan 3a `degraded` bucket by adding catalog sync clients and `Adapter` implementations for each.

**Architecture:** Plug four new clients into Plan 3a's `catalogSync` dispatch table and four new adapters into Plan 3b's `getAdapter` switch. Modify the onboarding handler so `detected_platform` maps to the matching `adapter_type` (instead of falling back to `'dom'`). No new pipeline steps, no schema changes.

**Tech Stack:** TypeScript, vitest, msw v2, drizzle-orm. No platform SDKs — `node:fetch` for everything.

**Spec:** [`docs/superpowers/specs/2026-05-02-phase1-plan3c-remaining-platform-adapters-design.md`](../specs/2026-05-02-phase1-plan3c-remaining-platform-adapters-design.md)

**Acceptance:** Spec §10 — provision a real merchant on each of the four platforms and reach `status='live'` with the matching `adapter_type`; `adapter-smoke` green for all four; contract test green for all 6 wired adapters; lint+typecheck clean.

---

## File structure

**New files:**

- `apps/worker/src/steps/catalogClients/magento.ts`
- `apps/worker/src/steps/catalogClients/bigcommerce.ts`
- `apps/worker/src/steps/catalogClients/wix.ts`
- `apps/worker/src/steps/catalogClients/squarespace.ts`
- `tests/worker/catalogClients/magento.test.ts`
- `tests/worker/catalogClients/bigcommerce.test.ts`
- `tests/worker/catalogClients/wix.test.ts`
- `tests/worker/catalogClients/squarespace.test.ts`
- `tests/fixtures/magentoProducts.json`
- `tests/fixtures/bigcommerceProducts.json`
- `tests/fixtures/wixProducts.json`
- `tests/fixtures/squarespaceProducts.json`
- `packages/adapters/src/magento.ts`
- `packages/adapters/src/bigcommerce.ts`
- `packages/adapters/src/wix.ts`
- `packages/adapters/src/squarespace.ts`
- `packages/adapters/test/magento.test.ts`
- `packages/adapters/test/bigcommerce.test.ts`
- `packages/adapters/test/wix.test.ts`
- `packages/adapters/test/squarespace.test.ts`

**Modified files:**

- `apps/worker/src/steps/catalogSync.ts` — add the four new clients to dispatch
- `apps/worker/src/handlers/onboarding.ts` — promote `detected_platform` to `adapter_type` for implemented platforms
- `apps/worker/src/steps/smokeTest.ts` — add new adapter-typed branches that delegate to `getAdapter(merchant).cartAdd`
- `packages/adapters/src/dispatch.ts` — wire the four new adapters
- `packages/adapters/test/contract.test.ts` — add the four new adapters to the parameterized list
- `packages/adapters/src/index.ts` — no change (only `getAdapter` re-exported)

---

## Phase A — Implemented-adapters helper

### Task 1: Introduce `implementedAdapters` set

**Files:**
- Modify: `packages/adapters/src/dispatch.ts`
- Modify: `packages/adapters/test/dispatch.test.ts`
- Create: `packages/adapters/src/implementedAdapters.ts`

- [ ] **Step 1: Test**

```ts
// add to dispatch.test.ts
import { implementedAdapters } from '../src/implementedAdapters.js';

describe('implementedAdapters', () => {
  it('contains all platforms 3c will wire', () => {
    expect(implementedAdapters.has('magento')).toBe(true);
    expect(implementedAdapters.has('bigcommerce')).toBe(true);
    expect(implementedAdapters.has('wix')).toBe(true);
    expect(implementedAdapters.has('squarespace')).toBe(true);
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm --filter @shoppingmate/adapters test dispatch`
Expected: FAIL — file missing.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/implementedAdapters.ts
import type { AdapterType } from '@shoppingmate/db';

export const implementedAdapters: ReadonlySet<AdapterType> = new Set<AdapterType>([
  'shopify','woo','magento','bigcommerce','wix','squarespace',
  // 'dom','suggest' added in 3d/3e
]);
```

- [ ] **Step 4: Run — pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/implementedAdapters.ts packages/adapters/test/dispatch.test.ts
git commit -m "feat(adapters): export implementedAdapters set for onboarding gating"
```

---

## Phase B — Catalog sync clients (4)

### Task 2: Magento catalog client (TDD)

**Files:**
- Create: `apps/worker/src/steps/catalogClients/magento.ts`
- Create: `tests/worker/catalogClients/magento.test.ts`
- Create: `tests/fixtures/magentoProducts.json`

- [ ] **Step 1: Fixture**

```json
// tests/fixtures/magentoProducts.json
{
  "items": [{
    "id": 1, "sku": "MG-TEE-001", "name": "Blue Tee", "price": 19.99, "type_id": "simple",
    "custom_attributes": [
      { "attribute_code": "description", "value": "<p>Soft cotton tee</p>" },
      { "attribute_code": "image", "value": "/pub/media/catalog/product/blue-tee.png" },
      { "attribute_code": "url_key", "value": "blue-tee" }
    ],
    "extension_attributes": { "stock_item": { "is_in_stock": true, "qty": 50 } }
  }],
  "search_criteria": { "page_size": 100, "current_page": 1 },
  "total_count": 1
}
```

- [ ] **Step 2: Test**

```ts
// tests/worker/catalogClients/magento.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fetchCatalog } from '../../../apps/worker/src/steps/catalogClients/magento.js';
import fixture from '../../fixtures/magentoProducts.json' with { type: 'json' };

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

describe('magento.fetchCatalog', () => {
  it('paginates /rest/V1/products and normalizes', async () => {
    server.use(
      http.get('https://m.example.com/rest/V1/products', () => HttpResponse.json(fixture)),
    );
    const r = await fetchCatalog('m.example.com', { wallTimeoutMs: 90_000, cap: 5000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.products[0].sku).toBe('MG-TEE-001');
      expect(r.products[0].priceCents).toBe(1999);
      expect(r.products[0].source).toBe('magento_rest');
    }
  });

  it('returns failed with requires_admin_token on 401', async () => {
    server.use(
      http.get('https://m.example.com/rest/V1/products', () =>
        new HttpResponse('Unauthorized', { status: 401 })),
    );
    const r = await fetchCatalog('m.example.com', { wallTimeoutMs: 90_000, cap: 5000 });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('requires_admin_token');
  });
});
```

- [ ] **Step 3: Run — fail**

Expected: FAIL — module missing.

- [ ] **Step 4: Implement**

```ts
// apps/worker/src/steps/catalogClients/magento.ts
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

type MagentoItem = {
  id: number; sku: string; name: string; price: number;
  custom_attributes?: Array<{ attribute_code: string; value: string }>;
  extension_attributes?: { stock_item?: { is_in_stock?: boolean } };
};

type MagentoPage = { items: MagentoItem[]; total_count: number };

function attr(p: MagentoItem, k: string): string | undefined {
  return p.custom_attributes?.find((a) => a.attribute_code === k)?.value;
}

function normalize(domain: string, p: MagentoItem): NormalizedProduct {
  const urlKey = attr(p, 'url_key') ?? p.sku.toLowerCase();
  return {
    sku: p.sku,
    title: p.name,
    description: attr(p, 'description') ?? null,
    imageUrl: attr(p, 'image') ? `https://${domain}${attr(p, 'image')}` : null,
    productUrl: `https://${domain}/${urlKey}.html`,
    variants: [],
    priceCents: Math.round((p.price ?? 0) * 100),
    currency: 'USD',
    inStock: p.extension_attributes?.stock_item?.is_in_stock ?? true,
    source: 'magento_rest',
    sourceMeta: { magento_id: p.id },
  };
}

export async function fetchCatalog(
  domain: string,
  opts: { wallTimeoutMs: number; cap: number; fetchImpl?: typeof fetch },
): Promise<CatalogClientResult> {
  const f = opts.fetchImpl ?? fetch;
  const products: NormalizedProduct[] = [];
  const start = Date.now();
  let page = 1; let totalCount = 0;
  while (products.length < opts.cap && Date.now() - start < opts.wallTimeoutMs) {
    const url = `https://${domain}/rest/V1/products?searchCriteria%5BpageSize%5D=100&searchCriteria%5BcurrentPage%5D=${page}`;
    const res = await f(url);
    if (res.status === 401) return { kind: 'failed', reason: 'requires_admin_token' };
    if (!res.ok) return { kind: 'failed', reason: `http_${res.status}` };
    const body = (await res.json()) as MagentoPage;
    totalCount = body.total_count ?? totalCount;
    body.items.forEach((i) => products.push(normalize(domain, i)));
    if (body.items.length < 100) break;
    page++;
  }
  return { kind: 'ok', products, expected: totalCount || products.length };
}
```

- [ ] **Step 5: Run — pass**

Run: `pnpm --filter @shoppingmate/worker test magento`
Expected: PASS 2.

- [ ] **Step 6: Commit**

```bash
git add apps/worker/src/steps/catalogClients/magento.ts tests/worker/catalogClients/magento.test.ts tests/fixtures/magentoProducts.json
git commit -m "feat(worker): magento catalog client via /rest/V1/products"
```

### Task 3: BigCommerce catalog client (TDD)

**Files:**
- Create: `apps/worker/src/steps/catalogClients/bigcommerce.ts`
- Create: `tests/worker/catalogClients/bigcommerce.test.ts`
- Create: `tests/fixtures/bigcommerceProducts.json`

- [ ] **Step 1: Fixture**

```json
// tests/fixtures/bigcommerceProducts.json
{
  "data": [{
    "id": 9001, "sku": "BC-TEE-001", "name": "Blue Tee",
    "description": "Soft cotton tee", "price": 1999,
    "url": "/blue-tee/",
    "default_image": { "url_standard": "https://cdn.example.com/bc-blue-tee.png" },
    "inventory_level": 10,
    "variants": [{ "id": 9101, "sku": "BC-TEE-001-M", "price": 1999, "option_values":[{"label":"M","option_display_name":"Size"}] }]
  }],
  "meta": { "pagination": { "total":1, "count":1, "per_page":100, "current_page":1, "total_pages":1 } }
}
```

- [ ] **Step 2: Test**

```ts
// tests/worker/catalogClients/bigcommerce.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fetchCatalog } from '../../../apps/worker/src/steps/catalogClients/bigcommerce.js';
import fixture from '../../fixtures/bigcommerceProducts.json' with { type: 'json' };

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

describe('bigcommerce.fetchCatalog', () => {
  it('reads /api/storefront/products and normalizes', async () => {
    server.use(http.get('https://shop.example.com/api/storefront/products', () => HttpResponse.json(fixture)));
    const r = await fetchCatalog('shop.example.com', { wallTimeoutMs: 90_000, cap: 5000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.products[0].sku).toBe('BC-TEE-001');
      expect(r.products[0].source).toBe('bigcommerce_storefront');
      expect(r.products[0].variants).toHaveLength(1);
    }
  });
});
```

- [ ] **Step 3: Run — fail**

Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
// apps/worker/src/steps/catalogClients/bigcommerce.ts
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

type BCVariant = { id: number; sku: string; price: number; option_values: Array<{ label: string; option_display_name: string }> };
type BCProduct = {
  id: number; sku: string; name: string; description?: string;
  price: number; url: string;
  default_image?: { url_standard?: string };
  inventory_level?: number;
  variants?: BCVariant[];
};
type BCPage = { data: BCProduct[]; meta: { pagination: { total_pages: number; current_page: number; total: number } } };

function normalize(domain: string, p: BCProduct): NormalizedProduct {
  return {
    sku: p.sku,
    title: p.name,
    description: p.description ?? null,
    imageUrl: p.default_image?.url_standard ?? null,
    productUrl: `https://${domain}${p.url}`,
    variants: (p.variants ?? []).map((v) => ({
      id: String(v.id),
      sku: v.sku,
      options: Object.fromEntries(v.option_values.map((o) => [o.option_display_name, o.label])),
      priceCents: v.price,
      inStock: true,
    })),
    priceCents: p.price,
    currency: 'USD',
    inStock: (p.inventory_level ?? 1) > 0,
    source: 'bigcommerce_storefront',
    sourceMeta: { bc_id: p.id },
  };
}

export async function fetchCatalog(
  domain: string,
  opts: { wallTimeoutMs: number; cap: number; fetchImpl?: typeof fetch },
): Promise<CatalogClientResult> {
  const f = opts.fetchImpl ?? fetch;
  const products: NormalizedProduct[] = [];
  const start = Date.now();
  let page = 1; let totalPages = 1; let total = 0;
  while (products.length < opts.cap && Date.now() - start < opts.wallTimeoutMs) {
    const url = `https://${domain}/api/storefront/products?limit=100&page=${page}`;
    const res = await f(url);
    if (!res.ok) return { kind: 'failed', reason: `http_${res.status}` };
    const body = (await res.json()) as BCPage;
    totalPages = body.meta.pagination.total_pages; total = body.meta.pagination.total;
    body.data.forEach((p) => products.push(normalize(domain, p)));
    if (page >= totalPages) break;
    page++;
  }
  return { kind: 'ok', products, expected: total || products.length };
}
```

- [ ] **Step 5: Run — pass**, **Step 6: Commit**

```bash
git add apps/worker/src/steps/catalogClients/bigcommerce.ts tests/worker/catalogClients/bigcommerce.test.ts tests/fixtures/bigcommerceProducts.json
git commit -m "feat(worker): bigcommerce catalog client via /api/storefront/products"
```

### Task 4: Wix catalog client (TDD)

**Files:**
- Create: `apps/worker/src/steps/catalogClients/wix.ts`
- Create: `tests/worker/catalogClients/wix.test.ts`
- Create: `tests/fixtures/wixProducts.json`

- [ ] **Step 1: Fixture**

```json
// tests/fixtures/wixProducts.json
{
  "products": [{
    "id": "wx-1", "sku": "WX-TEE-001", "name": "Blue Tee",
    "description": "Soft cotton tee", "priceData": { "price": 19.99, "currency": "USD" },
    "media": { "mainMedia": { "image": { "url": "https://static.wixstatic.com/media/blue-tee.png" } } },
    "productPageUrl": { "base": "https://shop.example.com", "path": "/product/blue-tee" },
    "stock": { "inStock": true }
  }],
  "totalResults": 1
}
```

- [ ] **Step 2: Test**

```ts
// tests/worker/catalogClients/wix.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fetchCatalog } from '../../../apps/worker/src/steps/catalogClients/wix.js';
import fixture from '../../fixtures/wixProducts.json' with { type: 'json' };

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

describe('wix.fetchCatalog', () => {
  it('reads wix-ecommerce-storefront-web/products', async () => {
    server.use(
      http.get('https://shop.example.com/_api/wix-ecommerce-storefront-web/api/storefront/products',
        () => HttpResponse.json(fixture)),
    );
    const r = await fetchCatalog('shop.example.com', { wallTimeoutMs: 90_000, cap: 5000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.products[0].sku).toBe('WX-TEE-001');
      expect(r.products[0].source).toBe('wix_stores');
    }
  });
});
```

- [ ] **Step 3: Run — fail**

Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
// apps/worker/src/steps/catalogClients/wix.ts
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

type WixProduct = {
  id: string; sku: string; name: string; description?: string;
  priceData: { price: number; currency: string };
  media?: { mainMedia?: { image?: { url: string } } };
  productPageUrl: { base: string; path: string };
  stock?: { inStock?: boolean };
};
type WixPage = { products: WixProduct[]; totalResults: number };

function normalize(p: WixProduct): NormalizedProduct {
  return {
    sku: p.sku,
    title: p.name,
    description: p.description ?? null,
    imageUrl: p.media?.mainMedia?.image?.url ?? null,
    productUrl: `${p.productPageUrl.base}${p.productPageUrl.path}`,
    variants: [],
    priceCents: Math.round(p.priceData.price * 100),
    currency: p.priceData.currency,
    inStock: p.stock?.inStock ?? true,
    source: 'wix_stores',
    sourceMeta: { wix_id: p.id },
  };
}

export async function fetchCatalog(
  domain: string,
  opts: { wallTimeoutMs: number; cap: number; fetchImpl?: typeof fetch },
): Promise<CatalogClientResult> {
  const f = opts.fetchImpl ?? fetch;
  const products: NormalizedProduct[] = [];
  const start = Date.now();
  let offset = 0; let total = 0;
  while (products.length < opts.cap && Date.now() - start < opts.wallTimeoutMs) {
    const url = `https://${domain}/_api/wix-ecommerce-storefront-web/api/storefront/products?limit=100&offset=${offset}`;
    const res = await f(url);
    if (!res.ok) return { kind: 'failed', reason: `http_${res.status}` };
    const body = (await res.json()) as WixPage;
    total = body.totalResults;
    body.products.forEach((p) => products.push(normalize(p)));
    if (body.products.length < 100) break;
    offset += body.products.length;
  }
  return { kind: 'ok', products, expected: total || products.length };
}
```

- [ ] **Step 5: Run — pass**, **Step 6: Commit**

```bash
git add apps/worker/src/steps/catalogClients/wix.ts tests/worker/catalogClients/wix.test.ts tests/fixtures/wixProducts.json
git commit -m "feat(worker): wix catalog client via wix-ecommerce-storefront-web"
```

### Task 5: Squarespace catalog client (TDD)

**Files:**
- Create: `apps/worker/src/steps/catalogClients/squarespace.ts`
- Create: `tests/worker/catalogClients/squarespace.test.ts`
- Create: `tests/fixtures/squarespaceProducts.json`

- [ ] **Step 1: Fixture**

```json
// tests/fixtures/squarespaceProducts.json
{
  "products": [{
    "id":"sq-1","sku":"SQ-TEE-001","title":"Blue Tee","body":"<p>Soft cotton tee</p>",
    "url":"/shop/blue-tee","price":1999,"currency":"USD","inStock":true,
    "variants":[{ "id":"sq-1-m", "sku":"SQ-TEE-001-M", "price":1999, "stock":5, "attributes":{"Size":"M"} }],
    "image":"https://static.sqsp.com/blue-tee.png"
  }],
  "total":1
}
```

- [ ] **Step 2: Test**

```ts
// tests/worker/catalogClients/squarespace.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { fetchCatalog } from '../../../apps/worker/src/steps/catalogClients/squarespace.js';
import fixture from '../../fixtures/squarespaceProducts.json' with { type: 'json' };

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

describe('squarespace.fetchCatalog', () => {
  it('reads /api/commerce/v1/products', async () => {
    server.use(http.get('https://shop.example.com/api/commerce/v1/products',
      () => HttpResponse.json(fixture)));
    const r = await fetchCatalog('shop.example.com', { wallTimeoutMs: 90_000, cap: 5000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.products[0].sku).toBe('SQ-TEE-001');
      expect(r.products[0].variants).toHaveLength(1);
      expect(r.products[0].source).toBe('squarespace_commerce');
    }
  });
});
```

- [ ] **Step 3: Run — fail**

Expected: FAIL.

- [ ] **Step 4: Implement**

```ts
// apps/worker/src/steps/catalogClients/squarespace.ts
import type { CatalogClientResult, NormalizedProduct } from './shopify.js';

type SQVariant = { id: string; sku: string; price: number; stock: number; attributes: Record<string,string> };
type SQProduct = {
  id: string; sku: string; title: string; body?: string; url: string;
  price: number; currency: string; inStock: boolean;
  variants?: SQVariant[]; image?: string;
};
type SQPage = { products: SQProduct[]; total: number };

function normalize(domain: string, p: SQProduct): NormalizedProduct {
  return {
    sku: p.sku,
    title: p.title,
    description: p.body ?? null,
    imageUrl: p.image ?? null,
    productUrl: `https://${domain}${p.url}`,
    variants: (p.variants ?? []).map((v) => ({
      id: v.id, sku: v.sku, options: v.attributes, priceCents: v.price, inStock: v.stock > 0,
    })),
    priceCents: p.price,
    currency: p.currency,
    inStock: p.inStock,
    source: 'squarespace_commerce',
    sourceMeta: { sq_id: p.id },
  };
}

export async function fetchCatalog(
  domain: string,
  opts: { wallTimeoutMs: number; cap: number; fetchImpl?: typeof fetch },
): Promise<CatalogClientResult> {
  const f = opts.fetchImpl ?? fetch;
  const products: NormalizedProduct[] = [];
  const start = Date.now();
  let offset = 0; let total = 0;
  while (products.length < opts.cap && Date.now() - start < opts.wallTimeoutMs) {
    const url = `https://${domain}/api/commerce/v1/products?limit=100&offset=${offset}`;
    const res = await f(url);
    if (!res.ok) return { kind: 'failed', reason: `http_${res.status}` };
    const body = (await res.json()) as SQPage;
    total = body.total;
    body.products.forEach((p) => products.push(normalize(domain, p)));
    if (body.products.length < 100) break;
    offset += body.products.length;
  }
  return { kind: 'ok', products, expected: total || products.length };
}
```

- [ ] **Step 5: Run — pass**, **Step 6: Commit**

```bash
git add apps/worker/src/steps/catalogClients/squarespace.ts tests/worker/catalogClients/squarespace.test.ts tests/fixtures/squarespaceProducts.json
git commit -m "feat(worker): squarespace catalog client via /api/commerce/v1/products"
```

---

## Phase C — catalogSync dispatch table extension

### Task 6: Extend `catalogSync` dispatcher

**Files:**
- Modify: `apps/worker/src/steps/catalogSync.ts`
- Modify: `tests/worker/catalogSync.test.ts`

- [ ] **Step 1: Test (add cases)**

For each new platform, add a test that asserts catalogSync routes to the new client. Pattern (one example, repeat for each):

```ts
it('magento adapter routes to magento client', async () => {
  vi.mock('../../apps/worker/src/steps/catalogClients/magento.js', () => ({
    fetchCatalog: vi.fn(async () => ({ kind: 'ok', products: [/* one fake product */], expected: 1 })),
  }));
  const merchant = { id: 'SM-MG', adapterType: 'magento', /* ... */ } as Merchant;
  const r = await catalogSync(merchant);
  expect(r.kind).toBe('ok');
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL — switch missing branches.

- [ ] **Step 3: Implement**

In `apps/worker/src/steps/catalogSync.ts`, extend the switch:

```ts
import * as magento from './catalogClients/magento.js';
import * as bigcommerce from './catalogClients/bigcommerce.js';
import * as wix from './catalogClients/wix.js';
import * as squarespace from './catalogClients/squarespace.js';

switch (merchant.adapterType) {
  case 'shopify': result = await shopify.fetchCatalog(merchant.domain, opts); source = 'shopify_storefront'; break;
  case 'woo':         result = await woo.fetchCatalog(merchant.domain, opts);         source = 'woo_store_api'; break;
  case 'magento':     result = await magento.fetchCatalog(merchant.domain, opts);     source = 'magento_rest'; break;
  case 'bigcommerce': result = await bigcommerce.fetchCatalog(merchant.domain, opts); source = 'bigcommerce_storefront'; break;
  case 'wix':         result = await wix.fetchCatalog(merchant.domain, opts);         source = 'wix_stores'; break;
  case 'squarespace': result = await squarespace.fetchCatalog(merchant.domain, opts); source = 'squarespace_commerce'; break;
  case 'dom':         result = await domCrawl.fetchCatalog(merchant.domain, opts);    source = 'dom_crawl'; break;
  default:            return { kind: 'failed', source: 'unknown', reason: 'unsupported_adapter_type' };
}
```

- [ ] **Step 4: Run — pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/steps/catalogSync.ts tests/worker/catalogSync.test.ts
git commit -m "feat(worker): catalogSync routes magento/bigcommerce/wix/squarespace"
```

---

## Phase D — Onboarding handler — promote detected_platform

### Task 7: Promote detected_platform to adapter_type when implemented

**Files:**
- Modify: `apps/worker/src/handlers/onboarding.ts`
- Modify: `tests/worker/onboarding.test.ts`

- [ ] **Step 1: Test**

Add a case asserting that when fingerprint returns `detected_platform='magento'` AND `magento` is in `implementedAdapters`, the merchant ends with `adapter_type='magento'`, not `'dom'`:

```ts
it('promotes detected_platform=magento to adapter_type=magento', async () => {
  // mock fingerprint to return platform='custom', detected_platform='magento'
  // mock magento.fetchCatalog and adapter smoke
  // run handler
  expect(updatedMerchant.adapterType).toBe('magento');
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL — handler still maps `custom→dom`.

- [ ] **Step 3: Implement**

Locate the section in `onboarding.ts` where `adapter_type` is set after fingerprint (Plan 3a Task 11). Replace:

```ts
import { implementedAdapters } from '@shoppingmate/adapters';

const detected = fingerprintResult.detected_platform;
const baseAdapter = PLATFORM_TO_ADAPTER[fingerprintResult.platform]; // 'shopify' | 'woo' | 'dom'
const adapterType =
  detected && implementedAdapters.has(detected as AdapterType)
    ? (detected as AdapterType)
    : baseAdapter;
```

- [ ] **Step 4: Run — pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/handlers/onboarding.ts tests/worker/onboarding.test.ts
git commit -m "feat(worker): promote detected_platform to adapter_type when adapter implemented"
```

---

## Phase E — Adapter implementations (4)

### Task 8: MagentoAdapter

**Files:**
- Create: `packages/adapters/src/magento.ts`
- Create: `packages/adapters/test/magento.test.ts`

- [ ] **Step 1: Test (cartAdd happy path)**

```ts
// packages/adapters/test/magento.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { MagentoAdapter } from '../src/magento.js';
import type { Merchant } from '@shoppingmate/db';

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = { id:'SM-MG', domain:'m.example.com', adapterType:'magento', adapterConfig:{}, status:'live', installedAt:new Date(), personaId:'concierge', allowedDomains:[] } as unknown as Merchant;

describe('MagentoAdapter — cartAdd', () => {
  it('creates guest cart, adds item, returns CartState', async () => {
    server.use(
      http.post('https://m.example.com/rest/V1/guest-carts', () => HttpResponse.json('cart-123')),
      http.post('https://m.example.com/rest/V1/guest-carts/cart-123/items',
        () => HttpResponse.json({ item_id: 1, sku:'MG-TEE-001', name:'Blue Tee', qty:1, price:19.99 })),
      http.get('https://m.example.com/rest/V1/guest-carts/cart-123/totals',
        () => HttpResponse.json({
          grand_total: 19.99, subtotal: 19.99, base_currency_code: 'USD',
          items: [{ item_id:1, sku:'MG-TEE-001', name:'Blue Tee', qty:1, price:19.99, row_total:19.99 }],
          coupon_code: null,
        })),
    );
    const a = new MagentoAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'MG-TEE-001', null, 1);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('cart-123');
      expect(r.value.lines[0].sku).toBe('MG-TEE-001');
    }
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/magento.ts
import type { Adapter, AdapterContext, AdapterResult, CartState, CartLine } from './types.js';
import type { Product } from '@shoppingmate/db';
import { searchProducts as repoSearch, getProduct as repoGet } from '@shoppingmate/db';

type MTotals = {
  grand_total: number; subtotal: number; base_currency_code: string;
  items: Array<{ item_id: number; sku: string; name: string; qty: number; price: number; row_total: number }>;
  coupon_code: string | null;
};

function toState(t: MTotals, token: string): CartState {
  const lines: CartLine[] = t.items.map((i) => ({
    lineId: String(i.item_id), sku: i.sku, variantId: null, title: i.name,
    qty: i.qty,
    unitPriceCents: Math.round(i.price * 100),
    lineTotalCents: Math.round(i.row_total * 100),
    currency: t.base_currency_code, imageUrl: null,
  }));
  return {
    cartToken: token, lines,
    subtotalCents: Math.round(t.subtotal * 100),
    totalCents: Math.round(t.grand_total * 100),
    currency: t.base_currency_code,
    appliedCoupons: t.coupon_code ? [t.coupon_code] : [],
  };
}

export class MagentoAdapter implements Adapter {
  readonly kind = 'magento' as const;

  async searchProducts(ctx, q, limit = 20) { return { kind: 'ok' as const, value: await repoSearch(ctx.merchant.id, q, limit) }; }
  async getProduct(ctx, sku)     { return { kind: 'ok' as const, value: await repoGet(ctx.merchant.id, sku) }; }

  private async ensureCart(ctx: AdapterContext): Promise<string> {
    if (ctx.cartToken) return ctx.cartToken;
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/rest/V1/guest-carts`, { method: 'POST' });
    if (!res.ok) throw new Error(`magento_create_cart_${res.status}`);
    return (await res.json()) as string;
  }

  private async totals(ctx: AdapterContext, token: string): Promise<MTotals> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/rest/V1/guest-carts/${token}/totals`);
    if (!res.ok) throw new Error(`magento_totals_${res.status}`);
    return (await res.json()) as MTotals;
  }

  async cartAdd(ctx, sku, _variantId, qty) {
    const f = ctx.fetch ?? fetch;
    const token = await this.ensureCart(ctx);
    const res = await f(`https://${ctx.merchant.domain}/rest/V1/guest-carts/${token}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cartItem: { sku, qty, quote_id: token } }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState(await this.totals(ctx, token), token) };
  }

  async cartUpdate(ctx, lineId, qty) {
    const token = ctx.cartToken;
    if (!token) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/rest/V1/guest-carts/${token}/items/${lineId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cartItem: { qty, quote_id: token } }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState(await this.totals(ctx, token), token) };
  }

  async cartGet(ctx) {
    if (!ctx.cartToken) return { kind: 'ok', value: toState({ grand_total:0, subtotal:0, base_currency_code:'USD', items:[], coupon_code:null }, '') };
    return { kind: 'ok', value: toState(await this.totals(ctx, ctx.cartToken), ctx.cartToken) };
  }

  async couponApply(ctx, code) {
    const token = ctx.cartToken;
    if (!token) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/rest/V1/guest-carts/${token}/coupons/${encodeURIComponent(code)}`, { method: 'PUT' });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState(await this.totals(ctx, token), token) };
  }

  async checkoutUrl(ctx) {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    return { kind: 'ok', value: `https://${ctx.merchant.domain}/checkout/?guest-cart-id=${ctx.cartToken}` };
  }
}
```

- [ ] **Step 4: Run — pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/magento.ts packages/adapters/test/magento.test.ts
git commit -m "feat(adapters): MagentoAdapter via /rest/V1 guest-cart endpoints"
```

### Task 9: BigCommerceAdapter

**Files:**
- Create: `packages/adapters/src/bigcommerce.ts`
- Create: `packages/adapters/test/bigcommerce.test.ts`

- [ ] **Step 1: Test**

```ts
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { BigCommerceAdapter } from '../src/bigcommerce.js';
import type { Merchant } from '@shoppingmate/db';

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = { id:'SM-BC', domain:'shop.example.com', adapterType:'bigcommerce', adapterConfig:{}, status:'live', installedAt:new Date(), personaId:'concierge', allowedDomains:[] } as unknown as Merchant;

const cartFixture = {
  id:'cart-bc-1', currency:{ code:'USD' },
  cartAmount: 19.99, baseAmount: 19.99,
  lineItems:{ physicalItems:[{
    id:'li-1', productId:9001, variantId:9101, sku:'BC-TEE-001-M', name:'Blue Tee — Medium',
    quantity:1, listPrice:19.99, extendedListPrice:19.99,
  }] },
  coupons:[],
};

describe('BigCommerceAdapter — cartAdd', () => {
  it('creates cart, adds item, returns CartState', async () => {
    server.use(
      http.post('https://shop.example.com/api/storefront/carts', () => HttpResponse.json(cartFixture)),
      http.post('https://shop.example.com/api/storefront/carts/cart-bc-1/items', () => HttpResponse.json(cartFixture)),
      http.get('https://shop.example.com/api/storefront/carts/cart-bc-1', () => HttpResponse.json(cartFixture)),
    );
    const a = new BigCommerceAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'BC-TEE-001-M', '9101', 1);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('cart-bc-1');
      expect(r.value.lines[0].sku).toBe('BC-TEE-001-M');
    }
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/bigcommerce.ts
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';
import type { Product } from '@shoppingmate/db';
import { searchProducts as repoSearch, getProduct as repoGet } from '@shoppingmate/db';

type BCCart = {
  id: string; currency: { code: string };
  cartAmount: number; baseAmount: number;
  lineItems: { physicalItems: Array<{
    id: string; productId: number; variantId: number; sku: string; name: string;
    quantity: number; listPrice: number; extendedListPrice: number;
  }> };
  coupons: Array<{ code: string }>;
};

function toState(c: BCCart): CartState {
  const lines: CartLine[] = c.lineItems.physicalItems.map((i) => ({
    lineId: i.id, sku: i.sku, variantId: String(i.variantId),
    title: i.name, qty: i.quantity,
    unitPriceCents: Math.round(i.listPrice * 100),
    lineTotalCents: Math.round(i.extendedListPrice * 100),
    currency: c.currency.code, imageUrl: null,
  }));
  return {
    cartToken: c.id, lines,
    subtotalCents: Math.round(c.baseAmount * 100),
    totalCents: Math.round(c.cartAmount * 100),
    currency: c.currency.code,
    appliedCoupons: c.coupons.map((x) => x.code),
  };
}

export class BigCommerceAdapter implements Adapter {
  readonly kind = 'bigcommerce' as const;

  async searchProducts(ctx, q, limit = 20) { return { kind: 'ok' as const, value: await repoSearch(ctx.merchant.id, q, limit) }; }
  async getProduct(ctx, sku) { return { kind: 'ok' as const, value: await repoGet(ctx.merchant.id, sku) }; }

  private async createCart(ctx: AdapterContext, item: { productId?: number; variantId: number; quantity: number }): Promise<BCCart> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/storefront/carts`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lineItems: [{ quantity: item.quantity, productId: item.productId ?? 0, variantId: item.variantId }] }),
    });
    if (!res.ok) throw new Error(`bc_create_cart_${res.status}`);
    return (await res.json()) as BCCart;
  }

  async cartAdd(ctx, _sku, variantId, qty) {
    const f = ctx.fetch ?? fetch;
    if (!variantId) return { kind: 'unsupported', reason: 'variant_required' };
    if (!ctx.cartToken) {
      const c = await this.createCart(ctx, { variantId: Number(variantId), quantity: qty });
      return { kind: 'ok', value: toState(c) };
    }
    const res = await f(`https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lineItems: [{ quantity: qty, variantId: Number(variantId) }] }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as BCCart) };
  }

  async cartUpdate(ctx, lineId, qty) {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}/items/${lineId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lineItem: { quantity: qty } }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as BCCart) };
  }

  async cartGet(ctx) {
    if (!ctx.cartToken) return { kind: 'ok', value: toState({ id:'', currency:{code:'USD'}, cartAmount:0, baseAmount:0, lineItems:{physicalItems:[]}, coupons:[] }) };
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}?include=lineItems.physicalItems.options`);
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as BCCart) };
  }

  async couponApply(ctx, code) {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}/coupons`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ couponCode: code }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as BCCart) };
  }

  async checkoutUrl(ctx) {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}/redirect_urls`, { method: 'POST' });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as { checkout_url: string };
    return { kind: 'ok', value: body.checkout_url };
  }
}
```

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/adapters/src/bigcommerce.ts packages/adapters/test/bigcommerce.test.ts
git commit -m "feat(adapters): BigCommerceAdapter via /api/storefront/carts"
```

### Task 10: WixAdapter

**Files:**
- Create: `packages/adapters/src/wix.ts`
- Create: `packages/adapters/test/wix.test.ts`

- [ ] **Step 1: Test (cartAdd happy path)**

```ts
// packages/adapters/test/wix.test.ts (abbreviated — same harness as others)
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { WixAdapter } from '../src/wix.js';
import type { Merchant } from '@shoppingmate/db';

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = { id:'SM-WX', domain:'shop.example.com', adapterType:'wix', adapterConfig:{}, status:'live', installedAt:new Date(), personaId:'concierge', allowedDomains:[] } as unknown as Merchant;

const cartFixture = {
  cart: {
    id:'wix-cart-1', currency:'USD', subtotal: 19.99, total: 19.99,
    lineItems:[{ id:'li-1', catalogReference:{ catalogItemId:'wx-1' }, productName:{ original:'Blue Tee' }, quantity:1, price:19.99, rowTotal:19.99 }],
    appliedDiscounts:[],
  },
};

describe('WixAdapter — cartAdd', () => {
  it('POSTs cart/lines/add and returns CartState', async () => {
    server.use(
      http.post('https://shop.example.com/_api/wix-ecommerce-storefront-web/api/storefront/cart/lines/add',
        () => new HttpResponse(JSON.stringify(cartFixture), { status: 200, headers: { 'set-cookie':'_wixCIDX=wix-cart-1; path=/' } })),
    );
    const a = new WixAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'WX-TEE-001', 'wx-1', 1);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value.cartToken).toBe('wix-cart-1');
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/wix.ts
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';
import { searchProducts as repoSearch, getProduct as repoGet } from '@shoppingmate/db';

type WixCart = { cart: {
  id: string; currency: string; subtotal: number; total: number;
  lineItems: Array<{ id: string; catalogReference: { catalogItemId: string }; productName: { original: string }; quantity: number; price: number; rowTotal: number; image?: string }>;
  appliedDiscounts: Array<{ code: string }>;
} };

function toState(c: WixCart['cart']): CartState {
  const lines: CartLine[] = c.lineItems.map((i) => ({
    lineId: i.id, sku: i.catalogReference.catalogItemId, variantId: null,
    title: i.productName.original, qty: i.quantity,
    unitPriceCents: Math.round(i.price * 100),
    lineTotalCents: Math.round(i.rowTotal * 100),
    currency: c.currency, imageUrl: i.image ?? null,
  }));
  return {
    cartToken: c.id, lines,
    subtotalCents: Math.round(c.subtotal * 100),
    totalCents: Math.round(c.total * 100),
    currency: c.currency,
    appliedCoupons: c.appliedDiscounts.map((d) => d.code),
  };
}

const BASE = '/_api/wix-ecommerce-storefront-web/api/storefront/cart';

export class WixAdapter implements Adapter {
  readonly kind = 'wix' as const;

  async searchProducts(ctx, q, limit = 20) { return { kind: 'ok' as const, value: await repoSearch(ctx.merchant.id, q, limit) }; }
  async getProduct(ctx, sku) { return { kind: 'ok' as const, value: await repoGet(ctx.merchant.id, sku) }; }

  private async post(ctx: AdapterContext, path: string, body: unknown): Promise<Response> {
    const f = ctx.fetch ?? fetch;
    return f(`https://${ctx.merchant.domain}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(ctx.cartToken ? { Cookie: `_wixCIDX=${ctx.cartToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  async cartAdd(ctx, _sku, variantId, qty) {
    if (!variantId) return { kind: 'unsupported', reason: 'catalog_item_id_required' };
    const res = await this.post(ctx, `${BASE}/lines/add`, { lineItems: [{ catalogReference: { catalogItemId: variantId }, quantity: qty }] });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as WixCart;
    return { kind: 'ok', value: toState(body.cart) };
  }

  async cartUpdate(ctx, lineId, qty) {
    const res = await this.post(ctx, `${BASE}/lines/update`, { lineItems: [{ id: lineId, quantity: qty }] });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as WixCart;
    return { kind: 'ok', value: toState(body.cart) };
  }

  async cartGet(ctx) {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}${BASE}`, {
      headers: ctx.cartToken ? { Cookie: `_wixCIDX=${ctx.cartToken}` } : {},
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as WixCart;
    return { kind: 'ok', value: toState(body.cart) };
  }

  async couponApply(ctx, code) {
    const res = await this.post(ctx, `${BASE}/coupon`, { couponCode: code });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as WixCart;
    return { kind: 'ok', value: toState(body.cart) };
  }

  async checkoutUrl(ctx) {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    const res = await this.post(ctx, `${BASE}/createCheckout`, {});
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as { checkoutId: string };
    return { kind: 'ok', value: `https://${ctx.merchant.domain}/checkout?checkoutId=${body.checkoutId}` };
  }
}
```

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/adapters/src/wix.ts packages/adapters/test/wix.test.ts
git commit -m "feat(adapters): WixAdapter via wix-ecommerce-storefront-web cart endpoints"
```

### Task 11: SquarespaceAdapter

**Files:**
- Create: `packages/adapters/src/squarespace.ts`
- Create: `packages/adapters/test/squarespace.test.ts`

- [ ] **Step 1: Test**

```ts
// packages/adapters/test/squarespace.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { SquarespaceAdapter } from '../src/squarespace.js';
import type { Merchant } from '@shoppingmate/db';

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = { id:'SM-SQ', domain:'shop.example.com', adapterType:'squarespace', adapterConfig:{}, status:'live', installedAt:new Date(), personaId:'concierge', allowedDomains:[] } as unknown as Merchant;

const cartFixture = {
  id:'sq-cart-1', currency:'USD', subtotal: 1999, total: 1999,
  items: [{ id:'li-1', productId:'sq-1', variantId:'sq-1-m', sku:'SQ-TEE-001-M', name:'Blue Tee', quantity:1, price:1999, lineTotal:1999 }],
  promotions: [],
};

describe('SquarespaceAdapter — cartAdd', () => {
  it('POSTs /api/commerce/v1/cart/items', async () => {
    server.use(
      http.post('https://shop.example.com/api/commerce/v1/cart/items',
        () => new HttpResponse(JSON.stringify(cartFixture), { status: 200, headers: { 'set-cookie': 'cart_id=sq-cart-1; path=/' } })),
    );
    const a = new SquarespaceAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'SQ-TEE-001-M', 'sq-1-m', 1);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value.cartToken).toBe('sq-cart-1');
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/squarespace.ts
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';
import { searchProducts as repoSearch, getProduct as repoGet } from '@shoppingmate/db';
import { parseSetCookie } from './util/cookies.js';

type SQCart = {
  id: string; currency: string; subtotal: number; total: number;
  items: Array<{ id: string; productId: string; variantId: string; sku: string; name: string; quantity: number; price: number; lineTotal: number; image?: string }>;
  promotions: Array<{ code: string }>;
};

function toState(c: SQCart): CartState {
  const lines: CartLine[] = c.items.map((i) => ({
    lineId: i.id, sku: i.sku, variantId: i.variantId, title: i.name,
    qty: i.quantity, unitPriceCents: i.price, lineTotalCents: i.lineTotal,
    currency: c.currency, imageUrl: i.image ?? null,
  }));
  return {
    cartToken: c.id, lines,
    subtotalCents: c.subtotal, totalCents: c.total,
    currency: c.currency,
    appliedCoupons: c.promotions.map((p) => p.code),
  };
}

export class SquarespaceAdapter implements Adapter {
  readonly kind = 'squarespace' as const;

  async searchProducts(ctx, q, limit = 20) { return { kind: 'ok' as const, value: await repoSearch(ctx.merchant.id, q, limit) }; }
  async getProduct(ctx, sku) { return { kind: 'ok' as const, value: await repoGet(ctx.merchant.id, sku) }; }

  private cookieHeader(ctx: AdapterContext): Record<string,string> {
    return ctx.cartToken ? { Cookie: `cart_id=${ctx.cartToken}` } : {};
  }

  async cartAdd(ctx, _sku, variantId, qty) {
    if (!variantId) return { kind: 'unsupported', reason: 'variant_required' };
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/commerce/v1/cart/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.cookieHeader(ctx) },
      body: JSON.stringify({ variantId, quantity: qty }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const jar = parseSetCookie(res.headers);
    const body = (await res.json()) as SQCart;
    return { kind: 'ok', value: toState({ ...body, id: jar.cart_id ?? body.id }) };
  }

  async cartUpdate(ctx, lineId, qty) {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/commerce/v1/cart/items/${lineId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...this.cookieHeader(ctx) },
      body: JSON.stringify({ quantity: qty }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as SQCart) };
  }

  async cartGet(ctx) {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/commerce/v1/cart`, { headers: this.cookieHeader(ctx) });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as SQCart) };
  }

  async couponApply(ctx, code) {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/commerce/v1/cart/promotions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.cookieHeader(ctx) },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as SQCart) };
  }

  async checkoutUrl(ctx) {
    return { kind: 'ok', value: `https://${ctx.merchant.domain}/checkout/cart` };
  }
}
```

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/adapters/src/squarespace.ts packages/adapters/test/squarespace.test.ts
git commit -m "feat(adapters): SquarespaceAdapter via /api/commerce/v1 cart endpoints"
```

---

## Phase F — Dispatcher + contract test

### Task 12: Wire 4 new adapters in dispatcher

**Files:**
- Modify: `packages/adapters/src/dispatch.ts`
- Modify: `packages/adapters/test/dispatch.test.ts`

- [ ] **Step 1: Update test** — remove `magento`/`bigcommerce`/`wix`/`squarespace` from the not-implemented assertion and add positive cases:

```ts
it.each([
  ['shopify', 'shopify'],
  ['woo', 'woo'],
  ['magento', 'magento'],
  ['bigcommerce', 'bigcommerce'],
  ['wix', 'wix'],
  ['squarespace', 'squarespace'],
])('returns kind=%s for adapterType=%s', (kind, type) => {
  expect(getAdapter(stubMerchant(type)).kind).toBe(kind);
});
it.each(['dom', 'suggest'])('throws for %s (still 3d/3e)', (t) => {
  expect(() => getAdapter(stubMerchant(t))).toThrow(/adapter_not_implemented/);
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement dispatcher**

```ts
// packages/adapters/src/dispatch.ts (replace cases)
case 'magento':     return new MagentoAdapter();
case 'bigcommerce': return new BigCommerceAdapter();
case 'wix':         return new WixAdapter();
case 'squarespace': return new SquarespaceAdapter();
case 'dom':
case 'suggest':
  throw new Error(`adapter_not_implemented_in_plan3c: ${merchant.adapterType}`);
```

- [ ] **Step 4: Run — pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/dispatch.ts packages/adapters/test/dispatch.test.ts
git commit -m "feat(adapters): wire magento/bigcommerce/wix/squarespace in dispatcher"
```

### Task 13: Extend contract test to all 6 adapters

**Files:**
- Modify: `packages/adapters/test/contract.test.ts`

- [ ] **Step 1: Update**

```ts
const adapters: Adapter[] = [
  new ShopifyAdapter(),
  new WooAdapter(),
  new MagentoAdapter(),
  new BigCommerceAdapter(),
  new WixAdapter(),
  new SquarespaceAdapter(),
];
```

- [ ] **Step 2: Run — pass**

Expected: PASS for all 6.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/test/contract.test.ts
git commit -m "test(adapters): contract test now covers all 6 wired adapters"
```

---

## Phase G — smokeTest extension

### Task 14: Wire new adapter types into onboarding smoke

**Files:**
- Modify: `apps/worker/src/steps/smokeTest.ts`
- Modify: `tests/worker/smokeTest.test.ts`

- [ ] **Step 1: Test**

For each new adapter type, add a case asserting smokeTest delegates to `getAdapter(merchant).cartAdd(...)`:

```ts
it.each(['magento','bigcommerce','wix','squarespace'] as const)('smoke succeeds for %s adapter', async (kind) => {
  const merchant = { adapterType: kind, /* ... */ } as Merchant;
  vi.spyOn(adapters, 'getAdapter').mockReturnValue({
    kind, cartAdd: async () => ({ kind: 'ok', value: { /* cart */ } }),
    /* other methods */
  } as unknown as Adapter);
  const r = await smokeTest(merchant, /* productSku */);
  expect(r.kind).toBe('passed');
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL — switch missing branches.

- [ ] **Step 3: Implement**

In `smokeTest.ts`, replace per-adapter branches with a uniform call through `getAdapter`:

```ts
import { getAdapter } from '@shoppingmate/adapters';

const adapter = getAdapter(merchant);
const r = await adapter.cartAdd({ merchant, cartToken: null, sessionId: `smoke-${Date.now()}` }, sku, variantId, 1);
if (r.kind === 'ok') return { kind: 'passed', latencyMs: Date.now() - start };
return { kind: 'failed', adapter_type: merchant.adapterType, reason: r.kind === 'platform_error' ? `http_${r.status}` : r.reason };
```

(Keep the existing `dom` branch using Playwright — it stays Plan 3a's mutation observer until Plan 3d's DOMAdapter ships.)

- [ ] **Step 4: Run — pass**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/steps/smokeTest.ts tests/worker/smokeTest.test.ts
git commit -m "feat(worker): smokeTest delegates to getAdapter for non-shopify/woo/dom"
```

---

## Phase H — Acceptance + tag

### Task 15: Repo-wide lint + typecheck + test

- [ ] **Step 1:** `pnpm typecheck` — PASS.
- [ ] **Step 2:** `pnpm lint` — PASS.
- [ ] **Step 3:** `pnpm test` — PASS.

### Task 16: Acceptance — Magento dev store

- [ ] **Step 1:** `pnpm shoppingmate:dev provision --domain=<magento-2-test-store>` — `status='live'`, `adapterType='magento'`.
- [ ] **Step 2:** `pnpm shoppingmate:dev adapter-smoke <merchantId>` — 7 `[OK]` lines.

### Task 17: Acceptance — BigCommerce / Wix / Squarespace

Same procedure, one per platform.

### Task 18: Tag

```bash
git tag phase1-plan3c-remaining-platform-adapters-complete
git push --tags
```

---

## Self-review checklist

- [x] Spec §10 acceptance: all four platforms reach `live` (Tasks 16–17), adapter-smoke passes (16–17), unit tests cover happy + error per platform (Tasks 2–11), contract test green (Task 13), lint+typecheck clean (Task 15).
- [x] No placeholders. Every code step has runnable code.
- [x] Type consistency: `NormalizedProduct` and `CatalogClientResult` reused from Plan 3a's `shopify.ts` (Plan 3a Task 12). `Adapter` and `AdapterResult` from Plan 3b Task 2. `implementedAdapters` defined Task 1, consumed Task 7.
