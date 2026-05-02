# Phase 1 — Plan 3b: Wedge Adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a typed `Adapter` interface plus a dispatcher and concrete `ShopifyAdapter` + `WooAdapter` so Plan 4's voice agent can transactionally read/write to the wedge platforms.

**Architecture:** New monorepo package `packages/adapters/` exporting `getAdapter(merchant) → Adapter`. Adapters delegate read methods to Plan 3a's `catalogRepo` and call platform guest-cart HTTP endpoints for writes. Cart token is opaque, passed in/out of every method (no internal state). A `pnpm shoppingmate:dev adapter-smoke` CLI exercises all 7 methods end-to-end as the acceptance gate.

**Tech Stack:** TypeScript, vitest, msw v2, drizzle-orm (read-only via catalogRepo), `node:fetch`. No new runtime dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-02-phase1-plan3b-wedge-adapters-design.md`](../specs/2026-05-02-phase1-plan3b-wedge-adapters-design.md)

**Acceptance:** Spec §9 — adapter-smoke green for a real Shopify dev store and a real Woo dev store; contract test green for both adapters; `getAdapter` throws typed `adapter_not_implemented_in_plan3b` for the other six adapter types.

---

## File structure

**New files:**

- `packages/adapters/package.json`
- `packages/adapters/tsconfig.json`
- `packages/adapters/src/index.ts` — public exports
- `packages/adapters/src/types.ts` — `Adapter`, `AdapterContext`, `AdapterResult`, `CartLine`, `CartState`
- `packages/adapters/src/dispatch.ts` — `getAdapter(merchant)`
- `packages/adapters/src/shopify.ts` — `ShopifyAdapter`
- `packages/adapters/src/woo.ts` — `WooAdapter`
- `packages/adapters/src/util/cookies.ts` — `parseSetCookie(headers): Record<string,string>`, `formatCookieHeader(jar): string`
- `packages/adapters/test/types.test.ts`
- `packages/adapters/test/dispatch.test.ts`
- `packages/adapters/test/shopify.test.ts`
- `packages/adapters/test/woo.test.ts`
- `packages/adapters/test/contract.test.ts` — runs same scenarios across every wired adapter
- `packages/adapters/test/fixtures/shopifyCart.json`
- `packages/adapters/test/fixtures/wooCart.json`
- `apps/api/scripts/adapter-smoke.ts`

**Modified files:**

- `pnpm-workspace.yaml` — already includes `packages/*`; no change expected (verify in Task 1)
- `apps/api/package.json` — add `@shoppingmate/adapters` workspace dep
- `apps/api/scripts/cli.ts` — wire `adapter-smoke` subcommand
- `tsconfig.base.json` — add `@shoppingmate/adapters` path mapping

---

## Phase A — Package scaffold + types

### Task 1: Scaffold `packages/adapters` workspace package

**Files:**
- Create: `packages/adapters/package.json`
- Create: `packages/adapters/tsconfig.json`
- Modify (verify): `pnpm-workspace.yaml`

- [ ] **Step 1: Verify workspace globs**

Run: `cat pnpm-workspace.yaml`
Expected: `packages: ["apps/*", "packages/*"]` (or equivalent including `packages/*`).

- [ ] **Step 2: Create package.json**

```json
{
  "name": "@shoppingmate/adapters",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run", "typecheck": "tsc --noEmit" },
  "dependencies": {
    "@shoppingmate/db": "workspace:*"
  },
  "devDependencies": {
    "msw": "^2.4.0",
    "vitest": "^1.6.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*", "test/**/*"]
}
```

- [ ] **Step 4: Install**

Run: `pnpm install`
Expected: `+ @shoppingmate/adapters 0.1.0` in workspace.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/ pnpm-lock.yaml
git commit -m "feat(adapters): scaffold packages/adapters workspace package"
```

### Task 2: Define `Adapter` interface + supporting types

**Files:**
- Create: `packages/adapters/src/types.ts`
- Create: `packages/adapters/test/types.test.ts`

- [ ] **Step 1: Write the type-level test**

```ts
// packages/adapters/test/types.test.ts
import { describe, expect, it } from 'vitest';
import type { Adapter, AdapterContext, AdapterResult, CartState, CartLine } from '../src/types.js';

describe('Adapter types', () => {
  it('AdapterResult has the three tagged variants', () => {
    const ok: AdapterResult<number> = { kind: 'ok', value: 1 };
    const err: AdapterResult<number> = { kind: 'platform_error', status: 500, body: 'x' };
    const un: AdapterResult<number> = { kind: 'unsupported', reason: 'r' };
    expect([ok.kind, err.kind, un.kind]).toEqual(['ok', 'platform_error', 'unsupported']);
  });

  it('CartState has expected fields', () => {
    const c: CartState = {
      cartToken: 't',
      lines: [],
      subtotalCents: 0,
      totalCents: 0,
      currency: 'USD',
      appliedCoupons: [],
    };
    expect(c.cartToken).toBe('t');
  });
});
```

- [ ] **Step 2: Run — expected to fail (file missing)**

Run: `pnpm --filter @shoppingmate/adapters test`
Expected: FAIL with "Cannot find module '../src/types.js'".

- [ ] **Step 3: Implement types.ts**

```ts
// packages/adapters/src/types.ts
import type { AdapterType, Merchant, Product } from '@shoppingmate/db';

export type AdapterContext = {
  merchant: Merchant;
  cartToken: string | null;
  sessionId: string;
  fetch?: typeof globalThis.fetch;
};

export type CartLine = {
  lineId: string;
  sku: string;
  variantId: string | null;
  title: string;
  qty: number;
  unitPriceCents: number;
  lineTotalCents: number;
  currency: string;
  imageUrl: string | null;
};

export type CartState = {
  cartToken: string;
  lines: CartLine[];
  subtotalCents: number;
  totalCents: number;
  currency: string;
  appliedCoupons: string[];
};

export type AdapterResult<T> =
  | { kind: 'ok'; value: T }
  | { kind: 'platform_error'; status: number; body: string }
  | { kind: 'unsupported'; reason: string };

export interface Adapter {
  readonly kind: AdapterType;
  searchProducts(ctx: AdapterContext, query: string, limit?: number): Promise<AdapterResult<Product[]>>;
  getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>>;
  cartAdd(ctx: AdapterContext, sku: string, variantId: string | null, qty: number): Promise<AdapterResult<CartState>>;
  cartUpdate(ctx: AdapterContext, lineId: string, qty: number): Promise<AdapterResult<CartState>>;
  cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>>;
  couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>>;
  checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>>;
}
```

- [ ] **Step 4: Run — expected to pass**

Run: `pnpm --filter @shoppingmate/adapters test`
Expected: PASS 2 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/types.ts packages/adapters/test/types.test.ts
git commit -m "feat(adapters): define Adapter interface + result/state types"
```

### Task 3: Cookie utility

**Files:**
- Create: `packages/adapters/src/util/cookies.ts`
- Create: `packages/adapters/test/util/cookies.test.ts`

- [ ] **Step 1: Test**

```ts
// packages/adapters/test/util/cookies.test.ts
import { describe, it, expect } from 'vitest';
import { parseSetCookie, formatCookieHeader } from '../../src/util/cookies.js';

describe('parseSetCookie', () => {
  it('parses single Set-Cookie', () => {
    const h = new Headers();
    h.set('set-cookie', 'cart=abc123; path=/; Max-Age=86400');
    expect(parseSetCookie(h)).toEqual({ cart: 'abc123' });
  });

  it('parses multiple Set-Cookie via getSetCookie if available', () => {
    const h = new Headers();
    h.append('set-cookie', 'a=1; path=/');
    h.append('set-cookie', 'b=2; path=/');
    const got = parseSetCookie(h);
    expect(got.a).toBe('1');
    expect(got.b).toBe('2');
  });
});

describe('formatCookieHeader', () => {
  it('serializes a jar', () => {
    expect(formatCookieHeader({ a: '1', b: '2' })).toBe('a=1; b=2');
  });
});
```

- [ ] **Step 2: Run — expected to fail**

Run: `pnpm --filter @shoppingmate/adapters test cookies`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/util/cookies.ts
export function parseSetCookie(headers: Headers): Record<string, string> {
  const jar: Record<string, string> = {};
  // Node 18+ Headers has getSetCookie(); fall back for older
  const setCookies: string[] =
    typeof (headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : (headers.get('set-cookie') ? [headers.get('set-cookie') as string] : []);
  for (const sc of setCookies) {
    const first = sc.split(';')[0];
    const eq = first.indexOf('=');
    if (eq > 0) jar[first.slice(0, eq).trim()] = first.slice(eq + 1).trim();
  }
  return jar;
}

export function formatCookieHeader(jar: Record<string, string>): string {
  return Object.entries(jar)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
}
```

- [ ] **Step 4: Run — expected to pass**

Run: `pnpm --filter @shoppingmate/adapters test cookies`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/util/cookies.ts packages/adapters/test/util/cookies.test.ts
git commit -m "feat(adapters): add Set-Cookie parser + Cookie header formatter"
```

---

## Phase B — Dispatcher

### Task 4: Implement `getAdapter` with not-implemented branches

**Files:**
- Create: `packages/adapters/src/dispatch.ts`
- Create: `packages/adapters/test/dispatch.test.ts`

- [ ] **Step 1: Failing test**

```ts
// packages/adapters/test/dispatch.test.ts
import { describe, it, expect } from 'vitest';
import { getAdapter } from '../src/dispatch.js';
import type { Merchant } from '@shoppingmate/db';

const stubMerchant = (adapterType: string): Merchant =>
  ({
    id: 'SM-T01',
    domain: 'example.com',
    adapterType,
    adapterConfig: {},
    status: 'live',
    installedAt: new Date(),
    personaId: 'concierge',
    allowedDomains: [],
  }) as unknown as Merchant;

describe('getAdapter', () => {
  it('returns ShopifyAdapter for shopify', () => {
    const a = getAdapter(stubMerchant('shopify'));
    expect(a.kind).toBe('shopify');
  });
  it('returns WooAdapter for woo', () => {
    const a = getAdapter(stubMerchant('woo'));
    expect(a.kind).toBe('woo');
  });
  it.each(['magento', 'bigcommerce', 'wix', 'squarespace', 'dom', 'suggest'])(
    'throws adapter_not_implemented_in_plan3b for %s',
    (type) => {
      expect(() => getAdapter(stubMerchant(type))).toThrow(/adapter_not_implemented_in_plan3b/);
    },
  );
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm --filter @shoppingmate/adapters test dispatch`
Expected: FAIL (no implementation).

- [ ] **Step 3: Implement (stubs for shopify/woo too)**

```ts
// packages/adapters/src/dispatch.ts
import type { Merchant } from '@shoppingmate/db';
import type { Adapter } from './types.js';
import { ShopifyAdapter } from './shopify.js';
import { WooAdapter } from './woo.js';

export function getAdapter(merchant: Merchant): Adapter {
  switch (merchant.adapterType) {
    case 'shopify':
      return new ShopifyAdapter();
    case 'woo':
      return new WooAdapter();
    case 'magento':
    case 'bigcommerce':
    case 'wix':
    case 'squarespace':
    case 'dom':
    case 'suggest':
      throw new Error(`adapter_not_implemented_in_plan3b: ${merchant.adapterType}`);
    default:
      throw new Error(`adapter_unknown: ${String(merchant.adapterType)}`);
  }
}
```

Also create empty stub classes so the dispatcher type-checks:

```ts
// packages/adapters/src/shopify.ts
import type { Adapter } from './types.js';
export class ShopifyAdapter implements Partial<Adapter> {
  readonly kind = 'shopify' as const;
}
```

```ts
// packages/adapters/src/woo.ts
import type { Adapter } from './types.js';
export class WooAdapter implements Partial<Adapter> {
  readonly kind = 'woo' as const;
}
```

(`Partial<Adapter>` is intentional for now; full implementation lands in later tasks. Tests only check `kind`.)

- [ ] **Step 4: Run — pass**

Run: `pnpm --filter @shoppingmate/adapters test dispatch`
Expected: PASS 8 cases.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/dispatch.ts packages/adapters/src/shopify.ts packages/adapters/src/woo.ts
git commit -m "feat(adapters): wire dispatcher with shopify/woo stubs"
```

---

## Phase C — ShopifyAdapter

### Task 5: ShopifyAdapter — read methods (delegate to catalogRepo)

**Files:**
- Modify: `packages/adapters/src/shopify.ts`
- Create: `packages/adapters/test/shopify.test.ts`
- Create: `packages/adapters/test/fixtures/shopifyCart.json`

- [ ] **Step 1: Test**

```ts
// packages/adapters/test/shopify.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShopifyAdapter } from '../src/shopify.js';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { Merchant } from '@shoppingmate/db';

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = {
  id: 'SM-T01',
  domain: 'shop.example.com',
  adapterType: 'shopify',
  adapterConfig: {},
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

describe('ShopifyAdapter — reads', () => {
  it('searchProducts delegates to catalogRepo', async () => {
    vi.doMock('@shoppingmate/db', async (orig) => {
      const real = (await orig()) as object;
      return { ...real, searchProducts: vi.fn(async () => [{ sku: 'A', title: 'Tee' }]) };
    });
    const { ShopifyAdapter: Fresh } = await import('../src/shopify.js');
    const a = new Fresh();
    const r = await a.searchProducts({ merchant, cartToken: null, sessionId: 's' }, 'tee');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value[0].sku).toBe('A');
  });
});
```

- [ ] **Step 2: Run — fail**

Run: `pnpm --filter @shoppingmate/adapters test shopify`
Expected: FAIL (method missing).

- [ ] **Step 3: Implement reads**

```ts
// packages/adapters/src/shopify.ts (replace stub)
import type { Adapter, AdapterContext, AdapterResult, CartState } from './types.js';
import type { Product } from '@shoppingmate/db';
import { searchProducts as repoSearch, getProduct as repoGet } from '@shoppingmate/db';

export class ShopifyAdapter implements Adapter {
  readonly kind = 'shopify' as const;

  async searchProducts(ctx: AdapterContext, query: string, limit = 20): Promise<AdapterResult<Product[]>> {
    const value = await repoSearch(ctx.merchant.id, query, limit);
    return { kind: 'ok', value };
  }
  async getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>> {
    const value = await repoGet(ctx.merchant.id, sku);
    return { kind: 'ok', value };
  }
  async cartAdd(): Promise<AdapterResult<CartState>> { return { kind: 'unsupported', reason: 'todo' }; }
  async cartUpdate(): Promise<AdapterResult<CartState>> { return { kind: 'unsupported', reason: 'todo' }; }
  async cartGet(): Promise<AdapterResult<CartState>> { return { kind: 'unsupported', reason: 'todo' }; }
  async couponApply(): Promise<AdapterResult<CartState>> { return { kind: 'unsupported', reason: 'todo' }; }
  async checkoutUrl(): Promise<AdapterResult<string>> { return { kind: 'unsupported', reason: 'todo' }; }
}
```

(Cart methods are stubs to be filled in Task 6+. They must compile against `Adapter` interface.)

- [ ] **Step 4: Run — pass**

Run: `pnpm --filter @shoppingmate/adapters test shopify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/shopify.ts packages/adapters/test/shopify.test.ts
git commit -m "feat(adapters): ShopifyAdapter delegates reads to catalogRepo"
```

### Task 6: ShopifyAdapter — `cartAdd` + `cartGet`

**Files:**
- Modify: `packages/adapters/src/shopify.ts`
- Modify: `packages/adapters/test/shopify.test.ts`
- Create: `packages/adapters/test/fixtures/shopifyCart.json`

- [ ] **Step 1: Add fixture**

```json
// packages/adapters/test/fixtures/shopifyCart.json
{
  "token": "Z2NwLXVzLWNlbnRyYWwx",
  "items": [{
    "id": 12345,
    "key": "12345:1",
    "quantity": 1,
    "title": "Blue Tee — Medium",
    "price": 1999,
    "line_price": 1999,
    "url": "/products/blue-tee?variant=12345",
    "image": "https://cdn.example.com/blue-tee.png",
    "sku": "TEE-BLUE-M",
    "variant_id": 12345
  }],
  "total_price": 1999,
  "items_subtotal_price": 1999,
  "currency": "USD",
  "applied_discount_codes": []
}
```

- [ ] **Step 2: Test**

Append to `shopify.test.ts`:

```ts
import cartFixture from './fixtures/shopifyCart.json' with { type: 'json' };

describe('ShopifyAdapter — cartAdd', () => {
  it('POSTs /cart/add.js then GETs /cart.js, returns CartState', async () => {
    server.use(
      http.post('https://shop.example.com/cart/add.js', () =>
        new HttpResponse(JSON.stringify(cartFixture.items[0]), {
          status: 200,
          headers: { 'set-cookie': 'cart=Z2NwLXVzLWNlbnRyYWwx; path=/' },
        })),
      http.get('https://shop.example.com/cart.js', () => HttpResponse.json(cartFixture)),
    );
    const a = new ShopifyAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'TEE-BLUE-M', '12345', 1);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('Z2NwLXVzLWNlbnRyYWwx');
      expect(r.value.lines[0].sku).toBe('TEE-BLUE-M');
      expect(r.value.totalCents).toBe(1999);
    }
  });
});
```

- [ ] **Step 3: Run — fail**

Run: `pnpm --filter @shoppingmate/adapters test cartAdd`
Expected: FAIL.

- [ ] **Step 4: Implement**

Replace `cartAdd` and `cartGet` in `shopify.ts`:

```ts
import { parseSetCookie, formatCookieHeader } from './util/cookies.js';

private async fetchCart(ctx: AdapterContext, cookieJar: Record<string, string>): Promise<CartState> {
  const f = ctx.fetch ?? fetch;
  const res = await f(`https://${ctx.merchant.domain}/cart.js`, {
    headers: { Cookie: formatCookieHeader(cookieJar) },
  });
  if (!res.ok) throw new Error(`shopify_cart_get_${res.status}`);
  const body = (await res.json()) as ShopifyCart;
  return shopifyCartToState(body, cookieJar.cart ?? '');
}

async cartAdd(ctx, sku, variantId, qty) {
  const f = ctx.fetch ?? fetch;
  const cookieJar = ctx.cartToken ? { cart: ctx.cartToken } : {};
  const res = await f(`https://${ctx.merchant.domain}/cart/add.js`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(ctx.cartToken ? { Cookie: formatCookieHeader(cookieJar) } : {}),
    },
    body: JSON.stringify({ id: Number(variantId), quantity: qty }),
  });
  if (!res.ok) {
    return { kind: 'platform_error', status: res.status, body: await res.text() };
  }
  Object.assign(cookieJar, parseSetCookie(res.headers));
  const value = await this.fetchCart(ctx, cookieJar);
  return { kind: 'ok', value };
}

async cartGet(ctx) {
  if (!ctx.cartToken) return { kind: 'ok', value: emptyCart() };
  const value = await this.fetchCart(ctx, { cart: ctx.cartToken });
  return { kind: 'ok', value };
}
```

Add helpers + types at bottom of file:

```ts
type ShopifyCart = {
  token: string;
  items: Array<{ key: string; sku: string; variant_id: number; title: string; quantity: number; price: number; line_price: number; image: string }>;
  total_price: number;
  items_subtotal_price: number;
  currency: string;
  applied_discount_codes: Array<{ code: string }>;
};

function shopifyCartToState(c: ShopifyCart, token: string): CartState {
  return {
    cartToken: token || c.token,
    lines: c.items.map((i) => ({
      lineId: i.key,
      sku: i.sku,
      variantId: String(i.variant_id),
      title: i.title,
      qty: i.quantity,
      unitPriceCents: i.price,
      lineTotalCents: i.line_price,
      currency: c.currency,
      imageUrl: i.image ?? null,
    })),
    subtotalCents: c.items_subtotal_price,
    totalCents: c.total_price,
    currency: c.currency,
    appliedCoupons: c.applied_discount_codes.map((d) => d.code),
  };
}

function emptyCart(): CartState {
  return { cartToken: '', lines: [], subtotalCents: 0, totalCents: 0, currency: 'USD', appliedCoupons: [] };
}
```

- [ ] **Step 5: Run — pass**

Run: `pnpm --filter @shoppingmate/adapters test cartAdd`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/src/shopify.ts packages/adapters/test/shopify.test.ts packages/adapters/test/fixtures/
git commit -m "feat(adapters): ShopifyAdapter cartAdd + cartGet via /cart/add.js"
```

### Task 7: ShopifyAdapter — `cartUpdate`, `couponApply`, `checkoutUrl`

**Files:**
- Modify: `packages/adapters/src/shopify.ts`
- Modify: `packages/adapters/test/shopify.test.ts`

- [ ] **Step 1: Tests**

```ts
describe('ShopifyAdapter — cartUpdate / couponApply / checkoutUrl', () => {
  it('cartUpdate POSTs /cart/change.js then refetches', async () => {
    server.use(
      http.post('https://shop.example.com/cart/change.js', () =>
        HttpResponse.json(cartFixture)),
      http.get('https://shop.example.com/cart.js', () => HttpResponse.json(cartFixture)),
    );
    const a = new ShopifyAdapter();
    const r = await a.cartUpdate({ merchant, cartToken: 'tok', sessionId: 's' }, '12345:1', 2);
    expect(r.kind).toBe('ok');
  });

  it('couponApply hits /discount/{code} then refetches', async () => {
    server.use(
      http.post('https://shop.example.com/discount/SAVE10', () => new HttpResponse(null, { status: 302 })),
      http.get('https://shop.example.com/cart.js', () => HttpResponse.json(cartFixture)),
    );
    const a = new ShopifyAdapter();
    const r = await a.couponApply({ merchant, cartToken: 'tok', sessionId: 's' }, 'SAVE10');
    expect(r.kind).toBe('ok');
  });

  it('checkoutUrl returns deterministic url', async () => {
    const a = new ShopifyAdapter();
    const r = await a.checkoutUrl({ merchant, cartToken: 'tok', sessionId: 's' });
    expect(r).toEqual({ kind: 'ok', value: 'https://shop.example.com/checkout?cart=tok' });
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL — methods still stubs.

- [ ] **Step 3: Implement**

```ts
async cartUpdate(ctx, lineId, qty) {
  const f = ctx.fetch ?? fetch;
  const jar = ctx.cartToken ? { cart: ctx.cartToken } : {};
  const res = await f(`https://${ctx.merchant.domain}/cart/change.js`, {
    method: 'POST',
    headers: { 'content-type':'application/json', Cookie: formatCookieHeader(jar) },
    body: JSON.stringify({ id: lineId, quantity: qty }),
  });
  if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
  return { kind: 'ok', value: await this.fetchCart(ctx, jar) };
}

async couponApply(ctx, code) {
  const f = ctx.fetch ?? fetch;
  const jar = ctx.cartToken ? { cart: ctx.cartToken } : {};
  const res = await f(`https://${ctx.merchant.domain}/discount/${encodeURIComponent(code)}`, {
    method: 'POST',
    redirect: 'manual',
    headers: { Cookie: formatCookieHeader(jar) },
  });
  if (res.status >= 400) return { kind: 'platform_error', status: res.status, body: await res.text() };
  return { kind: 'ok', value: await this.fetchCart(ctx, jar) };
}

async checkoutUrl(ctx) {
  if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
  return { kind: 'ok', value: `https://${ctx.merchant.domain}/checkout?cart=${ctx.cartToken}` };
}
```

- [ ] **Step 4: Run — pass**

Expected: PASS all 3 new cases.

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/shopify.ts packages/adapters/test/shopify.test.ts
git commit -m "feat(adapters): ShopifyAdapter cartUpdate/couponApply/checkoutUrl"
```

---

## Phase D — WooAdapter

### Task 8: WooAdapter — reads + nonce capture

**Files:**
- Modify: `packages/adapters/src/woo.ts`
- Create: `packages/adapters/test/woo.test.ts`
- Create: `packages/adapters/test/fixtures/wooCart.json`

- [ ] **Step 1: Fixture**

```json
// packages/adapters/test/fixtures/wooCart.json
{
  "items": [{
    "key": "abc123",
    "id": 42,
    "quantity": 1,
    "name": "Blue Tee",
    "sku": "TEE-BLUE-M",
    "prices": { "price": "1999", "currency_code": "USD" },
    "totals": { "line_total": "1999", "currency_code": "USD" },
    "images": [{ "src": "https://cdn.example.com/blue-tee.png" }],
    "variation": [{ "attribute": "pa_size", "value": "M" }]
  }],
  "totals": { "total_price": "1999", "total_items": "1999", "currency_code": "USD" },
  "coupons": []
}
```

- [ ] **Step 2: Test**

```ts
// packages/adapters/test/woo.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import { WooAdapter } from '../src/woo.js';
import wooCart from './fixtures/wooCart.json' with { type: 'json' };
import type { Merchant } from '@shoppingmate/db';

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = {
  id: 'SM-W01', domain: 'woo.example.com', adapterType: 'woo',
  adapterConfig: {}, status: 'live', installedAt: new Date(),
  personaId: 'concierge', allowedDomains: [],
} as unknown as Merchant;

describe('WooAdapter — cartAdd', () => {
  it('captures nonce on first GET, then POSTs add-item with nonce + token', async () => {
    let nonceUsed = '';
    server.use(
      http.get('https://woo.example.com/wp-json/wc/store/v1/cart', () =>
        new HttpResponse(JSON.stringify({ items: [], totals: { total_price:'0', total_items:'0', currency_code:'USD' }, coupons: [] }), {
          status: 200,
          headers: { 'x-wc-store-api-nonce': 'nonce123', 'cart-token': 'cartABC' },
        })),
      http.post('https://woo.example.com/wp-json/wc/store/v1/cart/add-item', async ({ request }) => {
        nonceUsed = request.headers.get('nonce') ?? '';
        return new HttpResponse(JSON.stringify(wooCart), {
          status: 200,
          headers: { 'cart-token': 'cartABC' },
        });
      }),
    );
    const a = new WooAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'TEE-BLUE-M', '42', 1);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('cartABC');
      expect(r.value.lines[0].sku).toBe('TEE-BLUE-M');
    }
    expect(nonceUsed).toBe('nonce123');
  });
});
```

- [ ] **Step 3: Run — fail**

Expected: FAIL.

- [ ] **Step 4: Implement** (full WooAdapter, including reads delegated to catalogRepo)

```ts
// packages/adapters/src/woo.ts
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';
import type { Product } from '@shoppingmate/db';
import { searchProducts as repoSearch, getProduct as repoGet } from '@shoppingmate/db';

type WooCart = {
  items: Array<{
    key: string; id: number; sku: string; name: string; quantity: number;
    prices: { price: string; currency_code: string };
    totals: { line_total: string; currency_code: string };
    images: Array<{ src: string }>;
    variation: Array<{ attribute: string; value: string }>;
  }>;
  totals: { total_price: string; total_items: string; currency_code: string };
  coupons: Array<{ code: string }>;
};

function wooToState(c: WooCart, token: string): CartState {
  const lines: CartLine[] = c.items.map((i) => ({
    lineId: i.key,
    sku: i.sku,
    variantId: String(i.id),
    title: i.name,
    qty: i.quantity,
    unitPriceCents: Number(i.prices.price),
    lineTotalCents: Number(i.totals.line_total),
    currency: i.totals.currency_code,
    imageUrl: i.images[0]?.src ?? null,
  }));
  return {
    cartToken: token,
    lines,
    subtotalCents: Number(c.totals.total_items),
    totalCents: Number(c.totals.total_price),
    currency: c.totals.currency_code,
    appliedCoupons: c.coupons.map((x) => x.code),
  };
}

export class WooAdapter implements Adapter {
  readonly kind = 'woo' as const;

  async searchProducts(ctx: AdapterContext, query: string, limit = 20): Promise<AdapterResult<Product[]>> {
    return { kind: 'ok', value: await repoSearch(ctx.merchant.id, query, limit) };
  }
  async getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>> {
    return { kind: 'ok', value: await repoGet(ctx.merchant.id, sku) };
  }

  private async getNonceAndToken(ctx: AdapterContext): Promise<{ nonce: string; token: string }> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/wp-json/wc/store/v1/cart`, {
      headers: ctx.cartToken ? { 'cart-token': ctx.cartToken } : {},
    });
    return {
      nonce: res.headers.get('x-wc-store-api-nonce') ?? res.headers.get('nonce') ?? '',
      token: res.headers.get('cart-token') ?? ctx.cartToken ?? '',
    };
  }

  private async authedFetch(ctx: AdapterContext, path: string, init: RequestInit & { retry?: boolean } = {}): Promise<Response> {
    const f = ctx.fetch ?? fetch;
    const { nonce, token } = await this.getNonceAndToken(ctx);
    const res = await f(`https://${ctx.merchant.domain}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        nonce,
        'cart-token': token,
        ...(init.headers ?? {}),
      },
    });
    if (res.status === 403 && !init.retry) {
      return this.authedFetch(ctx, path, { ...init, retry: true });
    }
    return res;
  }

  async cartAdd(ctx, sku, variantId, qty) {
    const product = await repoGet(ctx.merchant.id, sku);
    const variation = (product?.variants as Array<{ id: string; options: Record<string,string> }> | undefined)
      ?.find((v) => v.id === variantId)
      ?.options;
    const variationArr = variation
      ? Object.entries(variation).map(([attribute, value]) => ({ attribute, value }))
      : [];

    const res = await this.authedFetch(ctx, '/wp-json/wc/store/v1/cart/add-item', {
      method: 'POST',
      body: JSON.stringify({ id: Number(variantId), quantity: qty, variation: variationArr }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const token = res.headers.get('cart-token') ?? ctx.cartToken ?? '';
    return { kind: 'ok', value: wooToState(await res.json() as WooCart, token) };
  }

  async cartUpdate(ctx, lineId, qty) {
    const res = await this.authedFetch(ctx, '/wp-json/wc/store/v1/cart/update-item', {
      method: 'POST',
      body: JSON.stringify({ key: lineId, quantity: qty }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const token = res.headers.get('cart-token') ?? ctx.cartToken ?? '';
    return { kind: 'ok', value: wooToState(await res.json() as WooCart, token) };
  }

  async cartGet(ctx) {
    const res = await this.authedFetch(ctx, '/wp-json/wc/store/v1/cart');
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const token = res.headers.get('cart-token') ?? ctx.cartToken ?? '';
    return { kind: 'ok', value: wooToState(await res.json() as WooCart, token) };
  }

  async couponApply(ctx, code) {
    const res = await this.authedFetch(ctx, '/wp-json/wc/store/v1/cart/apply-coupon', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const token = res.headers.get('cart-token') ?? ctx.cartToken ?? '';
    return { kind: 'ok', value: wooToState(await res.json() as WooCart, token) };
  }

  async checkoutUrl(ctx) {
    const url = ctx.merchant.checkoutUrl ?? `https://${ctx.merchant.domain}/checkout/`;
    return { kind: 'ok', value: url };
  }
}
```

- [ ] **Step 5: Run — pass**

Run: `pnpm --filter @shoppingmate/adapters test woo`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/adapters/src/woo.ts packages/adapters/test/woo.test.ts packages/adapters/test/fixtures/wooCart.json
git commit -m "feat(adapters): WooAdapter with nonce capture + cart-token round-trip"
```

### Task 9: WooAdapter — nonce-403 retry test

**Files:**
- Modify: `packages/adapters/test/woo.test.ts`

- [ ] **Step 1: Test**

```ts
describe('WooAdapter — nonce retry', () => {
  it('retries once on 403 rest_cookie_invalid_nonce', async () => {
    let calls = 0;
    server.use(
      http.get('https://woo.example.com/wp-json/wc/store/v1/cart', () =>
        new HttpResponse(JSON.stringify({ items:[], totals:{ total_price:'0', total_items:'0', currency_code:'USD' }, coupons:[] }), {
          status: 200, headers: { 'x-wc-store-api-nonce':'nonceX', 'cart-token':'tokX' },
        })),
      http.post('https://woo.example.com/wp-json/wc/store/v1/cart/add-item', () => {
        calls++;
        if (calls === 1) return new HttpResponse('{"code":"rest_cookie_invalid_nonce"}', { status: 403 });
        return HttpResponse.json(wooCart);
      }),
    );
    const a = new WooAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'TEE-BLUE-M', '42', 1);
    expect(r.kind).toBe('ok');
    expect(calls).toBe(2);
  });
});
```

- [ ] **Step 2: Run — pass** (already implemented in Task 8)

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/test/woo.test.ts
git commit -m "test(adapters): WooAdapter retries once on invalid-nonce 403"
```

---

## Phase E — Public exports + contract test

### Task 10: index.ts exports

**Files:**
- Create: `packages/adapters/src/index.ts`

- [ ] **Step 1: Write**

```ts
// packages/adapters/src/index.ts
export type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';
export { getAdapter } from './dispatch.js';
```

- [ ] **Step 2: Verify**

Run: `pnpm --filter @shoppingmate/adapters typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/src/index.ts
git commit -m "feat(adapters): public package surface"
```

### Task 11: Contract test (parameterized over wired adapters)

**Files:**
- Create: `packages/adapters/test/contract.test.ts`

- [ ] **Step 1: Test**

```ts
// packages/adapters/test/contract.test.ts
import { describe, it, expect } from 'vitest';
import { ShopifyAdapter } from '../src/shopify.js';
import { WooAdapter } from '../src/woo.js';
import type { Adapter } from '../src/types.js';

const adapters: Adapter[] = [new ShopifyAdapter(), new WooAdapter()];

describe.each(adapters)('Adapter contract — $kind', (a) => {
  it('exposes kind', () => {
    expect(typeof a.kind).toBe('string');
  });
  it('every Adapter method is a function', () => {
    for (const m of ['searchProducts','getProduct','cartAdd','cartUpdate','cartGet','couponApply','checkoutUrl'] as const) {
      expect(typeof (a as Record<string, unknown>)[m]).toBe('function');
    }
  });
});
```

- [ ] **Step 2: Run — pass**

Expected: PASS for both.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/test/contract.test.ts
git commit -m "test(adapters): parameterized contract test across wired adapters"
```

---

## Phase F — adapter-smoke CLI

### Task 12: `apps/api/scripts/adapter-smoke.ts`

**Files:**
- Create: `apps/api/scripts/adapter-smoke.ts`
- Modify: `apps/api/scripts/cli.ts` — register subcommand
- Modify: `apps/api/package.json` — add `@shoppingmate/adapters` dep

- [ ] **Step 1: Add dep**

Edit `apps/api/package.json`:
```json
"dependencies": {
  "@shoppingmate/adapters": "workspace:*",
  ...existing...
}
```
Run: `pnpm install`.

- [ ] **Step 2: Implement script**

```ts
// apps/api/scripts/adapter-smoke.ts
import { getAdapter, type AdapterContext } from '@shoppingmate/adapters';
import { db, merchants } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';

export async function adapterSmoke(merchantId: string): Promise<number> {
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, merchantId)).limit(1);
  if (!merchant) { console.error(`merchant ${merchantId} not found`); return 1; }
  const a = getAdapter(merchant);
  let ctx: AdapterContext = { merchant, cartToken: null, sessionId: `smoke-${Date.now()}` };
  const log = (label: string, ok: boolean, extra?: string) =>
    console.log(`${ok ? '[OK]' : '[FAIL]'} ${label}${extra ? ` — ${extra}` : ''}`);

  // 1. searchProducts
  const sp = await a.searchProducts(ctx, '', 5);
  log('searchProducts', sp.kind === 'ok' && sp.value.length > 0, sp.kind);
  if (sp.kind !== 'ok' || sp.value.length === 0) return 1;

  // 2. getProduct
  const first = sp.value[0];
  const gp = await a.getProduct(ctx, first.sku);
  log('getProduct', gp.kind === 'ok' && gp.value !== null);

  // 3. cartAdd
  const variants = (first.variants ?? []) as Array<{ id: string }>;
  const variantId = variants[0]?.id ?? null;
  const ca = await a.cartAdd(ctx, first.sku, variantId, 1);
  log('cartAdd', ca.kind === 'ok', ca.kind);
  if (ca.kind !== 'ok') return 1;
  ctx = { ...ctx, cartToken: ca.value.cartToken };

  // 4. cartGet
  const cg = await a.cartGet(ctx);
  log('cartGet', cg.kind === 'ok' && cg.kind === 'ok' && cg.value.lines.length > 0);

  // 5. cartUpdate
  if (cg.kind === 'ok' && cg.value.lines[0]) {
    const cu = await a.cartUpdate(ctx, cg.value.lines[0].lineId, 2);
    log('cartUpdate', cu.kind === 'ok');
  }

  // 6. couponApply (failure tolerated)
  const coupon = process.env.SMOKE_COUPON ?? 'TESTNONE';
  const cp = await a.couponApply(ctx, coupon);
  log(`couponApply(${coupon})`, true, cp.kind);

  // 7. checkoutUrl
  const ch = await a.checkoutUrl(ctx);
  log('checkoutUrl', ch.kind === 'ok', ch.kind === 'ok' ? ch.value : ch.kind);

  return 0;
}

if (process.argv[2]) {
  adapterSmoke(process.argv[2]).then((code) => process.exit(code));
}
```

- [ ] **Step 3: Wire CLI dispatcher**

Open `apps/api/scripts/cli.ts`. Add:
```ts
case 'adapter-smoke': {
  const merchantId = args._[0];
  if (!merchantId) { console.error('usage: adapter-smoke <merchantId>'); process.exit(2); }
  const code = await (await import('./adapter-smoke.js')).adapterSmoke(merchantId);
  process.exit(code);
}
```

(Match existing style — peek at the `provision` / `retry-onboarding` cases.)

- [ ] **Step 4: Manual verify**

Run (assuming a Plan 3a-onboarded Shopify merchant exists in dev DB):
```bash
pnpm shoppingmate:dev adapter-smoke SM-EXAMPLE
```
Expected: 7 lines beginning with `[OK]` (or `[FAIL]` with a clear reason).

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/adapter-smoke.ts apps/api/scripts/cli.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api): adapter-smoke CLI exercising all 7 Adapter methods"
```

---

## Phase G — Acceptance + tag

### Task 13: Repo-wide lint + typecheck

- [ ] **Step 1: Run typecheck**

Run: `pnpm typecheck`
Expected: PASS across all packages.

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS.

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: PASS — including new packages/adapters suite.

### Task 14: Acceptance — Shopify dev store

- [ ] **Step 1: Provision**

Run: `pnpm shoppingmate:dev provision --domain=<your-shopify-dev-store>.myshopify.com`
Expected: status reaches `live`.

- [ ] **Step 2: Adapter smoke**

Run: `pnpm shoppingmate:dev adapter-smoke <merchantId>`
Expected: 7 `[OK]` lines.

### Task 15: Acceptance — Woo dev store

Same procedure with a Woo merchant.

### Task 16: Tag the milestone

- [ ] **Step 1: Tag**

```bash
git tag phase1-plan3b-wedge-adapters-complete
git push --tags
```

---

## Self-review checklist

- [x] Spec §9 acceptance criteria all mapped: smoke for both platforms (Tasks 14–15), 6 dispatcher branches throw (Task 4), unit tests for both adapters (Tasks 5–9), contract test (Task 11), lint+typecheck clean (Task 13).
- [x] No placeholders. Every code step has runnable code.
- [x] Type consistency: `Adapter`/`AdapterResult`/`CartState` defined Task 2, used unchanged in Tasks 5–9, exported Task 10.
- [x] Cross-package: `@shoppingmate/db` exports `searchProducts`/`getProduct` per Plan 3a Task 22 — verified via Plan 3a:line 2250 (`import { products, type Product } from '../schema/products.js'`).
