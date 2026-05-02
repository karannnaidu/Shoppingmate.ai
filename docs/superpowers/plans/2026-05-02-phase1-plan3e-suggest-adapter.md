# Phase 1 — Plan 3e: SuggestAdapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the adapter trilogy. Ship `SuggestAdapter` (Tier-3 fallback that narrates instead of transacting), the auto-promotion path from DOM to Suggest when DOMAdapter exhausts caps or returns `unsupported` repeatedly, the `set-adapter` CLI escape hatch, and an exhaustive dispatcher (`assertNever`) covering all 8 adapter types.

**Architecture:** New `packages/adapters/src/suggest.ts` implements `Adapter` over the same `WSTransport` interface from Plan 3d, but emits `ui.show_message` / `ui.show_product_card` actions instead of `dom.*`. A frozen `SUGGEST_CART_STATE_PLACEHOLDER` lets the LLM (Plan 4) reason about an unobservable cart. `apps/worker/src/steps/promoteToSuggest.ts` is called by `smokeTest` on DOM-cap failure or 3 consecutive `unsupported` results, and by the new `pnpm shoppingmate:dev set-adapter` CLI.

**Tech Stack:** TypeScript, vitest, drizzle-orm + postgres, the `WSTransport` from Plan 3d (reused as-is). No new infra, no schema changes.

**Spec:** [`docs/superpowers/specs/2026-05-02-phase1-plan3e-suggest-adapter-design.md`](../specs/2026-05-02-phase1-plan3e-suggest-adapter-design.md)

**Acceptance:** Spec §9 — Suggest merchant reaches `status='live'`, forced DOM smoke failure auto-promotes to Suggest with `metric_events.adapterPromotedToSuggest` recorded, dispatcher exhaustiveness compiles, adapter-smoke green for all 7 steps on a Suggest merchant, contract test green for all 8 adapters, lint+typecheck clean. Tag `phase1-plan3e-suggest-adapter-complete` closes Plan 3.

---

## File structure

**New files:**

- `packages/adapters/src/suggest.ts` — `SuggestAdapter`, `SUGGEST_CART_STATE_EMPTY`, `SUGGEST_CART_STATE_PLACEHOLDER`, `SUGGEST_PROMPT_HINT`
- `packages/adapters/test/suggest.test.ts`
- `apps/worker/src/steps/promoteToSuggest.ts`
- `tests/worker/promoteToSuggest.test.ts`
- `apps/api/scripts/set-adapter.ts` — CLI escape hatch
- `tests/api/scripts/set-adapter.test.ts`

**Modified files:**

- `packages/adapters/src/dom/transport.ts` — extend `DomAction` union with `ui.show_message` and `ui.show_product_card`
- `packages/adapters/src/dispatch.ts` — wire `'suggest'` branch and replace default with `assertNever(merchant.adapterType)`
- `packages/adapters/src/index.ts` — export `SUGGEST_PROMPT_HINT`, `SuggestAdapter`
- `packages/adapters/test/contract.test.ts` — add `'suggest'` to parameterized adapter list (now 8 entries; SuggestAdapter passes the relaxed assertions described in Phase E below)
- `packages/db/src/schema/metricEvents.ts` — add `suggestMessageSent`, `suggestProductCardSent`, `suggestCartGetEmpty`, `adapterPromotedToSuggest`
- `apps/worker/src/steps/smokeTest.ts` — branch on `adapter_type`: when DOM smoke fails with `'action_cap'` or returns `'unsupported'` for `cartAdd` 3 times, call `promoteToSuggest()` and re-run smoke; when `adapter_type='suggest'`, smoke just verifies `searchProducts` non-empty
- `apps/api/package.json` — register `set-adapter` script under `scripts`
- `package.json` (root) — register `shoppingmate:dev set-adapter` invocation in the `shoppingmate:dev` dispatch script (mirrors `provision`/`adapter-smoke` patterns from Plans 2 and 3b)

---

## Phase A — Transport extension

### Task 1: Add `ui.show_message` and `ui.show_product_card` to `DomAction`

**Files:**
- Modify: `packages/adapters/src/dom/transport.ts`
- Test: `packages/adapters/test/dom/transport.test.ts`

- [ ] **Step 1: Extend `DomAction` union**

```ts
// packages/adapters/src/dom/transport.ts — add to the discriminated union
export type DomAction =
  // ...existing dom.* variants from Plan 3d unchanged...
  | { type: 'ui.show_message'; text: string }
  | {
      type: 'ui.show_product_card';
      product: {
        title: string;
        imageUrl: string | null;
        priceCents: number;
        currency: string;
        productUrl: string;
      };
    };
```

- [ ] **Step 2: Add transport-shape unit test**

Add to `packages/adapters/test/dom/transport.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FakeWSTransport } from '../../src/dom/fakeTransport';

describe('WSTransport ui.* actions', () => {
  it('records show_message and show_product_card', async () => {
    const t = new FakeWSTransport();
    t.ackNext({ ok: true });
    await t.send('sess-1', { type: 'ui.show_message', text: 'hello' });
    t.ackNext({ ok: true });
    await t.send('sess-1', {
      type: 'ui.show_product_card',
      product: {
        title: 'Mug',
        imageUrl: 'https://example.com/m.jpg',
        priceCents: 1500,
        currency: 'USD',
        productUrl: 'https://example.com/p/mug',
      },
    });
    expect(t.sent('sess-1')).toMatchObject([
      { type: 'ui.show_message', text: 'hello' },
      { type: 'ui.show_product_card', product: { title: 'Mug' } },
    ]);
  });
});
```

- [ ] **Step 3: Run the test to verify**

Run: `pnpm --filter @shoppingmate/adapters test transport`
Expected: PASS (existing dom.* tests + new ui.* test).

- [ ] **Step 4: Commit**

```bash
git add packages/adapters/src/dom/transport.ts packages/adapters/test/dom/transport.test.ts
git commit -m "feat(adapters): extend DomAction with ui.show_message and ui.show_product_card"
```

---

## Phase B — `SuggestAdapter`

### Task 2: Add metric keys

**Files:**
- Modify: `packages/db/src/schema/metricEvents.ts`

- [ ] **Step 1: Add keys**

```ts
// packages/db/src/schema/metricEvents.ts — append to the existing metric-name registry
export const metricNames = [
  // ...existing entries unchanged...
  'suggestMessageSent',
  'suggestProductCardSent',
  'suggestCartGetEmpty',
  'adapterPromotedToSuggest',
] as const;
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/db typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/schema/metricEvents.ts
git commit -m "feat(db): metric keys for SuggestAdapter and DOM→Suggest promotion"
```

### Task 3: Write failing `SuggestAdapter` tests

**Files:**
- Test: `packages/adapters/test/suggest.test.ts`

- [ ] **Step 1: Write the unit tests (will fail — adapter not yet written)**

```ts
// packages/adapters/test/suggest.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { SuggestAdapter, SUGGEST_CART_STATE_EMPTY, SUGGEST_CART_STATE_PLACEHOLDER } from '../src/suggest';
import { FakeWSTransport } from '../src/dom/fakeTransport';
import type { AdapterContext } from '../src/types';
import { catalogRepo } from '@shoppingmate/db';

const fixedProduct = {
  sku: 'MUG-RED',
  title: 'Red Mug',
  imageUrl: 'https://example.com/red.jpg',
  priceCents: 1500,
  currency: 'USD',
  productUrl: 'https://example.com/p/red-mug',
};

describe('SuggestAdapter', () => {
  let transport: FakeWSTransport;
  let ctx: AdapterContext;

  beforeEach(() => {
    transport = new FakeWSTransport();
    ctx = {
      merchant: { id: 'm-1', domain: 'example.com', adapterType: 'suggest', checkoutUrl: 'https://example.com/checkout' } as never,
      sessionId: 'sess-1',
      cartToken: null,
    };
    // Stub catalogRepo for these tests.
    (catalogRepo as never as { getProduct: typeof catalogRepo.getProduct }).getProduct =
      async (_mid: string, sku: string) => (sku === fixedProduct.sku ? fixedProduct : null);
    (catalogRepo as never as { searchProducts: typeof catalogRepo.searchProducts }).searchProducts =
      async () => [fixedProduct];
  });

  it('searchProducts returns catalog rows', async () => {
    const a = new SuggestAdapter(transport);
    const r = await a.searchProducts(ctx, 'mug', 5);
    expect(r).toEqual({ kind: 'ok', value: [fixedProduct] });
  });

  it('cartAdd emits ui.show_message + ui.show_product_card and returns placeholder', async () => {
    const a = new SuggestAdapter(transport);
    transport.ackNext({ ok: true });
    transport.ackNext({ ok: true });
    const r = await a.cartAdd(ctx, 'MUG-RED', null, 1);
    expect(r).toEqual({ kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER });
    const sent = transport.sent('sess-1');
    expect(sent[0]).toMatchObject({ type: 'ui.show_message' });
    expect(sent[0].text).toContain('Red Mug');
    expect(sent[1]).toMatchObject({
      type: 'ui.show_product_card',
      product: { title: 'Red Mug', priceCents: 1500, productUrl: 'https://example.com/p/red-mug' },
    });
  });

  it('cartAdd returns unsupported when sku missing from catalog', async () => {
    const a = new SuggestAdapter(transport);
    const r = await a.cartAdd(ctx, 'NOT-A-SKU', null, 1);
    expect(r).toEqual({ kind: 'unsupported', reason: 'product_not_in_catalog' });
    expect(transport.sent('sess-1')).toEqual([]);
  });

  it('cartUpdate emits a message and returns placeholder', async () => {
    const a = new SuggestAdapter(transport);
    transport.ackNext({ ok: true });
    const r = await a.cartUpdate(ctx, 'line-1', 2);
    expect(r).toEqual({ kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER });
    expect(transport.sent('sess-1')[0]).toMatchObject({ type: 'ui.show_message' });
  });

  it('cartGet returns empty placeholder without sending anything', async () => {
    const a = new SuggestAdapter(transport);
    const r = await a.cartGet(ctx);
    expect(r).toEqual({ kind: 'ok', value: SUGGEST_CART_STATE_EMPTY });
    expect(transport.sent('sess-1')).toEqual([]);
  });

  it('couponApply narrates the code', async () => {
    const a = new SuggestAdapter(transport);
    transport.ackNext({ ok: true });
    const r = await a.couponApply(ctx, 'SAVE10');
    expect(r).toEqual({ kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER });
    const sent = transport.sent('sess-1');
    expect(sent[0]).toMatchObject({ type: 'ui.show_message' });
    expect(sent[0].text).toContain('SAVE10');
  });

  it('checkoutUrl returns merchant.checkoutUrl when set', async () => {
    const a = new SuggestAdapter(transport);
    const r = await a.checkoutUrl(ctx);
    expect(r).toEqual({ kind: 'ok', value: 'https://example.com/checkout' });
  });

  it('checkoutUrl returns unsupported when merchant has no checkoutUrl', async () => {
    const a = new SuggestAdapter(transport);
    const r = await a.checkoutUrl({ ...ctx, merchant: { ...ctx.merchant, checkoutUrl: null } as never });
    expect(r).toEqual({ kind: 'unsupported', reason: 'no_checkout_url' });
  });

  it('SUGGEST_CART_STATE_PLACEHOLDER is frozen and uses sentinel cartToken', () => {
    expect(Object.isFrozen(SUGGEST_CART_STATE_PLACEHOLDER)).toBe(true);
    expect(SUGGEST_CART_STATE_PLACEHOLDER.cartToken).toBe('suggest');
    expect(SUGGEST_CART_STATE_PLACEHOLDER.lines).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify they fail with "module not found"**

Run: `pnpm --filter @shoppingmate/adapters test suggest`
Expected: FAIL with "Cannot find module '../src/suggest'".

### Task 4: Implement `SuggestAdapter`

**Files:**
- Create: `packages/adapters/src/suggest.ts`

- [ ] **Step 1: Write the implementation**

```ts
// packages/adapters/src/suggest.ts
import { catalogRepo } from '@shoppingmate/db';
import { metricEvents } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult } from './types';
import type { CartLine, CartState } from './types';
import type { WSTransport } from './dom/transport';

export const SUGGEST_CART_STATE_EMPTY: CartState = Object.freeze({
  cartToken: 'suggest',
  lines: [] as CartLine[],
  subtotalCents: 0,
  totalCents: 0,
  currency: 'USD',
});

export const SUGGEST_CART_STATE_PLACEHOLDER: CartState = Object.freeze({
  cartToken: 'suggest',
  lines: [] as CartLine[],
  subtotalCents: 0,
  totalCents: 0,
  currency: 'USD',
});

export const SUGGEST_PROMPT_HINT = `
You are running on a site where you cannot drive the cart programmatically.
You can recommend products and show product cards, but the visitor must
click "Add to Cart" themselves on the page. The "cart" tool returns an
empty placeholder — do not loop trying to read it.
`.trim();

export class SuggestAdapter implements Adapter {
  readonly kind = 'suggest' as const;
  constructor(private transport: WSTransport) {}

  async searchProducts(ctx: AdapterContext, query: string, limit = 20): Promise<AdapterResult<unknown[]>> {
    const value = await catalogRepo.searchProducts(ctx.merchant.id, query, limit);
    return { kind: 'ok', value };
  }

  async getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<unknown>> {
    const p = await catalogRepo.getProduct(ctx.merchant.id, sku);
    return p ? { kind: 'ok', value: p } : { kind: 'unsupported', reason: 'product_not_in_catalog' };
  }

  async cartAdd(
    ctx: AdapterContext,
    sku: string,
    _variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const p = await catalogRepo.getProduct(ctx.merchant.id, sku);
    if (!p) return { kind: 'unsupported', reason: 'product_not_in_catalog' };

    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_message',
      text: this.composeAddText(p, qty),
    });
    await metricEvents.emit('suggestMessageSent', { merchantId: ctx.merchant.id, sessionId: ctx.sessionId, action_type: 'cartAdd' });

    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_product_card',
      product: {
        title: p.title,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents,
        currency: p.currency,
        productUrl: p.productUrl,
      },
    });
    await metricEvents.emit('suggestProductCardSent', { merchantId: ctx.merchant.id, sessionId: ctx.sessionId });

    return { kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER };
  }

  async cartUpdate(ctx: AdapterContext, _lineId: string, qty: number): Promise<AdapterResult<CartState>> {
    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_message',
      text: `To set the quantity to ${qty}, please update it on the page — I can't change carts directly here.`,
    });
    await metricEvents.emit('suggestMessageSent', { merchantId: ctx.merchant.id, sessionId: ctx.sessionId, action_type: 'cartUpdate' });
    return { kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER };
  }

  async cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    await metricEvents.emit('suggestCartGetEmpty', { merchantId: ctx.merchant.id, sessionId: ctx.sessionId });
    return { kind: 'ok', value: SUGGEST_CART_STATE_EMPTY };
  }

  async couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>> {
    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_message',
      text: `Try entering coupon code ${code} at checkout.`,
    });
    await metricEvents.emit('suggestMessageSent', { merchantId: ctx.merchant.id, sessionId: ctx.sessionId, action_type: 'couponApply' });
    return { kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER };
  }

  async checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>> {
    return ctx.merchant.checkoutUrl
      ? { kind: 'ok', value: ctx.merchant.checkoutUrl }
      : { kind: 'unsupported', reason: 'no_checkout_url' };
  }

  private composeAddText(p: { title: string; priceCents: number; currency: string }, qty: number): string {
    const price = (p.priceCents / 100).toFixed(2);
    const qtyText = qty > 1 ? `${qty} × ` : '';
    return `I found ${qtyText}${p.title} for ${p.currency} ${price}. Tap "Add to Cart" on the page to grab it — I'll keep helping you shop.`;
  }
}
```

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @shoppingmate/adapters test suggest`
Expected: PASS — all 9 cases.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/src/suggest.ts packages/adapters/test/suggest.test.ts
git commit -m "feat(adapters): SuggestAdapter (Tier-3 fallback)"
```

---

## Phase C — Dispatcher exhaustiveness

### Task 5: Wire `'suggest'` into `getAdapter` with `assertNever`

**Files:**
- Modify: `packages/adapters/src/dispatch.ts`

- [ ] **Step 1: Replace dispatcher**

```ts
// packages/adapters/src/dispatch.ts
import type { Merchant } from '@shoppingmate/db';
import type { Adapter } from './types';
import { ShopifyAdapter } from './shopify';
import { WooAdapter } from './woo';
import { MagentoAdapter } from './magento';
import { BigCommerceAdapter } from './bigcommerce';
import { WixAdapter } from './wix';
import { SquarespaceAdapter } from './squarespace';
import { DOMAdapter } from './dom';
import { SuggestAdapter } from './suggest';
import type { DispatchDeps } from './types';

function assertNever(x: never): never {
  throw new Error(`Unhandled adapter type: ${String(x)}`);
}

export function getAdapter(merchant: Merchant, deps: DispatchDeps): Adapter {
  const t = merchant.adapterType;
  switch (t) {
    case 'shopify':     return new ShopifyAdapter(deps.fetch);
    case 'woo':         return new WooAdapter(deps.fetch);
    case 'magento':     return new MagentoAdapter(deps.fetch);
    case 'bigcommerce': return new BigCommerceAdapter(deps.fetch);
    case 'wix':         return new WixAdapter(deps.fetch);
    case 'squarespace': return new SquarespaceAdapter(deps.fetch);
    case 'dom':         return new DOMAdapter(deps.transport);
    case 'suggest':     return new SuggestAdapter(deps.transport);
    default:            return assertNever(t);
  }
}
```

- [ ] **Step 2: Verify exhaustiveness**

Add a temporary line at the top of `dispatch.ts`:

```ts
// @ts-expect-error — intentional: removing 'suggest' from adapterTypes must break this file
const _proof: never = 'suggest' as Merchant['adapterType'];
```

Run: `pnpm --filter @shoppingmate/adapters typecheck`
Expected: typecheck passes (because `'suggest'` IS in the union). Now delete the proof line.

- [ ] **Step 3: Re-run typecheck without the proof**

Run: `pnpm --filter @shoppingmate/adapters typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/adapters/src/dispatch.ts
git commit -m "feat(adapters): exhaustive dispatcher with assertNever"
```

### Task 6: Extend contract test to all 8 adapters

**Files:**
- Modify: `packages/adapters/test/contract.test.ts`

- [ ] **Step 1: Add Suggest to the parameterized list with relaxed assertions**

```ts
// packages/adapters/test/contract.test.ts — append to ADAPTERS array
const ADAPTERS = [
  // ...existing 7 entries unchanged...
  {
    name: 'suggest',
    build: () => new SuggestAdapter(new FakeWSTransport()),
    // SuggestAdapter does not produce a real CartState; skip cart-mutation
    // assertions that compare to a transactable shape.
    skipCartShapeAssertions: true,
  },
];
```

Then in the test body, branch on `skipCartShapeAssertions` to skip lines like `expect(state.totalCents).toBeGreaterThan(0)` for the Suggest entry; instead, assert `state.cartToken === 'suggest'` and `state.lines.length === 0`.

- [ ] **Step 2: Run the parameterized contract test**

Run: `pnpm --filter @shoppingmate/adapters test contract`
Expected: PASS — 8 adapters × ~6 contract checks.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/test/contract.test.ts
git commit -m "test(adapters): contract test covers all 8 adapters"
```

### Task 7: Export `SuggestAdapter` and `SUGGEST_PROMPT_HINT`

**Files:**
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1: Add exports**

```ts
// packages/adapters/src/index.ts — append
export { SuggestAdapter, SUGGEST_PROMPT_HINT, SUGGEST_CART_STATE_EMPTY, SUGGEST_CART_STATE_PLACEHOLDER } from './suggest';
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @shoppingmate/adapters typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/adapters/src/index.ts
git commit -m "feat(adapters): export SuggestAdapter and SUGGEST_PROMPT_HINT"
```

---

## Phase D — Promotion path

### Task 8: Write failing `promoteToSuggest` tests

**Files:**
- Test: `tests/worker/promoteToSuggest.test.ts`

- [ ] **Step 1: Write the tests**

```ts
// tests/worker/promoteToSuggest.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { promoteToSuggest } from '../../apps/worker/src/steps/promoteToSuggest';
import { db, merchants, metricEvents } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { resetDb, seedMerchant } from '../helpers/db';

describe('promoteToSuggest', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('updates adapter_type to suggest and refreshes last_indexed_at', async () => {
    await seedMerchant({ id: 'm-1', adapterType: 'dom', status: 'live' });
    const before = new Date();

    await promoteToSuggest('m-1', 'cloudflare_block_detected');

    const [m] = await db.select().from(merchants).where(eq(merchants.id, 'm-1'));
    expect(m.adapterType).toBe('suggest');
    expect(m.lastIndexedAt).not.toBeNull();
    expect(m.lastIndexedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('emits adapterPromotedToSuggest with from_adapter and reason tags', async () => {
    await seedMerchant({ id: 'm-2', adapterType: 'dom', status: 'live' });
    await promoteToSuggest('m-2', 'action_cap');

    const events = await db.select().from(metricEvents).where(eq(metricEvents.name, 'adapterPromotedToSuggest'));
    expect(events.length).toBe(1);
    expect(events[0].tags).toMatchObject({ merchantId: 'm-2', from_adapter: 'dom', reason: 'action_cap' });
  });

  it('is idempotent — re-running on a Suggest merchant is a no-op without emit', async () => {
    await seedMerchant({ id: 'm-3', adapterType: 'suggest', status: 'live' });
    await promoteToSuggest('m-3', 'duplicate_call');

    const events = await db.select().from(metricEvents).where(eq(metricEvents.name, 'adapterPromotedToSuggest'));
    expect(events.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `pnpm test promoteToSuggest`
Expected: FAIL with "Cannot find module".

### Task 9: Implement `promoteToSuggest`

**Files:**
- Create: `apps/worker/src/steps/promoteToSuggest.ts`

- [ ] **Step 1: Write it**

```ts
// apps/worker/src/steps/promoteToSuggest.ts
import { db, merchants, metricEvents } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';

export async function promoteToSuggest(merchantId: string, reason: string): Promise<void> {
  const [m] = await db.select().from(merchants).where(eq(merchants.id, merchantId));
  if (!m) throw new Error(`promoteToSuggest: merchant ${merchantId} not found`);
  if (m.adapterType === 'suggest') return; // idempotent no-op

  const fromAdapter = m.adapterType ?? 'unknown';

  await db
    .update(merchants)
    .set({ adapterType: 'suggest', lastIndexedAt: new Date() })
    .where(eq(merchants.id, merchantId));

  await metricEvents.emit('adapterPromotedToSuggest', {
    merchantId,
    from_adapter: fromAdapter,
    reason,
  });
}
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test promoteToSuggest`
Expected: PASS — 3 cases.

- [ ] **Step 3: Commit**

```bash
git add apps/worker/src/steps/promoteToSuggest.ts tests/worker/promoteToSuggest.test.ts
git commit -m "feat(worker): promoteToSuggest helper for DOM→Suggest auto-fallback"
```

### Task 10: Wire auto-promotion into `smokeTest`

**Files:**
- Modify: `apps/worker/src/steps/smokeTest.ts`
- Test: `tests/worker/smokeTest.test.ts`

- [ ] **Step 1: Write the failing integration test**

Append to `tests/worker/smokeTest.test.ts`:

```ts
describe('smokeTest auto-promotion to Suggest', () => {
  it('promotes DOM merchant to Suggest after 3 consecutive cartAdd unsupported results', async () => {
    await seedMerchant({ id: 'm-dom', adapterType: 'dom', status: 'onboarding' });
    // Stub DOMAdapter.cartAdd to return unsupported three times.
    stubAdapter('m-dom', {
      cartAdd: async () => ({ kind: 'unsupported', reason: 'no_selector' }),
      searchProducts: async () => ({ kind: 'ok', value: [{ sku: 'X', title: 'X', priceCents: 100, currency: 'USD', imageUrl: null, productUrl: 'https://x' }] }),
    });

    await runSmokeTest('m-dom');

    const [m] = await db.select().from(merchants).where(eq(merchants.id, 'm-dom'));
    expect(m.adapterType).toBe('suggest');
  });

  it('promotes DOM merchant to Suggest when DOMAdapter returns action_cap platform_error', async () => {
    await seedMerchant({ id: 'm-cap', adapterType: 'dom', status: 'onboarding' });
    stubAdapter('m-cap', {
      cartAdd: async () => ({ kind: 'platform_error', code: 'action_cap', message: 'cap exceeded' }),
      searchProducts: async () => ({ kind: 'ok', value: [{ sku: 'X', title: 'X', priceCents: 100, currency: 'USD', imageUrl: null, productUrl: 'https://x' }] }),
    });

    await runSmokeTest('m-cap');

    const [m] = await db.select().from(merchants).where(eq(merchants.id, 'm-cap'));
    expect(m.adapterType).toBe('suggest');
  });

  it('Suggest smoke just verifies searchProducts non-empty', async () => {
    await seedMerchant({ id: 'm-sug', adapterType: 'suggest', status: 'onboarding' });
    stubAdapter('m-sug', {
      searchProducts: async () => ({ kind: 'ok', value: [{ sku: 'A', title: 'A', priceCents: 100, currency: 'USD', imageUrl: null, productUrl: 'https://a' }] }),
    });

    const result = await runSmokeTest('m-sug');
    expect(result.passed).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test smokeTest`
Expected: FAIL — promotion logic and Suggest branch not yet implemented.

- [ ] **Step 3: Modify `smokeTest.ts`**

```ts
// apps/worker/src/steps/smokeTest.ts — add at the top of runSmokeTest()
import { promoteToSuggest } from './promoteToSuggest';

export async function runSmokeTest(merchantId: string): Promise<SmokeResult> {
  const merchant = await loadMerchant(merchantId);
  const adapter = getAdapter(merchant, deps);

  // Suggest merchants: pass if catalog non-empty.
  if (merchant.adapterType === 'suggest') {
    const r = await adapter.searchProducts({ merchant, sessionId: `smoke-${merchantId}`, cartToken: null }, '', 1);
    return { passed: r.kind === 'ok' && (r.value as unknown[]).length > 0, adapterType: 'suggest' };
  }

  // Existing 7-step flow...
  const ctx = { merchant, sessionId: `smoke-${merchantId}`, cartToken: null };
  let unsupportedStreak = 0;
  let lastAddResult: AdapterResult<CartState> | null = null;

  for (const sku of pickProbeSkus(merchant)) {
    const r = await adapter.cartAdd(ctx, sku, null, 1);
    lastAddResult = r;
    if (r.kind === 'unsupported') {
      unsupportedStreak += 1;
      if (unsupportedStreak >= 3 && merchant.adapterType === 'dom') {
        await promoteToSuggest(merchantId, 'three_unsupported_cart_adds');
        return runSmokeTest(merchantId); // re-run against SuggestAdapter
      }
      continue;
    }
    if (r.kind === 'platform_error' && r.code === 'action_cap' && merchant.adapterType === 'dom') {
      await promoteToSuggest(merchantId, 'action_cap');
      return runSmokeTest(merchantId);
    }
    if (r.kind === 'ok') break;
  }

  // ...rest of existing 7-step assertions unchanged (cartGet, cartUpdate, couponApply, checkoutUrl)...
  return { passed: lastAddResult?.kind === 'ok', adapterType: merchant.adapterType };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm test smokeTest`
Expected: PASS — including the 3 new cases plus all existing.

- [ ] **Step 5: Commit**

```bash
git add apps/worker/src/steps/smokeTest.ts tests/worker/smokeTest.test.ts
git commit -m "feat(worker): smokeTest auto-promotes DOM to Suggest on cap or 3 unsupported"
```

---

## Phase E — CLI escape hatch

### Task 11: Write failing `set-adapter` CLI test

**Files:**
- Test: `tests/api/scripts/set-adapter.test.ts`

- [ ] **Step 1: Write it**

```ts
// tests/api/scripts/set-adapter.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { setAdapter } from '../../../apps/api/scripts/set-adapter';
import { db, merchants, metricEvents } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { resetDb, seedMerchant } from '../../helpers/db';

describe('set-adapter CLI', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('sets adapter_type to suggest and emits adapterPromotedToSuggest', async () => {
    await seedMerchant({ id: 'm-1', adapterType: 'dom' });
    await setAdapter({ merchantId: 'm-1', type: 'suggest', reason: 'cloudflare' });

    const [m] = await db.select().from(merchants).where(eq(merchants.id, 'm-1'));
    expect(m.adapterType).toBe('suggest');

    const events = await db.select().from(metricEvents).where(eq(metricEvents.name, 'adapterPromotedToSuggest'));
    expect(events[0].tags).toMatchObject({ merchantId: 'm-1', from_adapter: 'dom', reason: 'cloudflare' });
  });

  it('rejects unknown adapter types', async () => {
    await seedMerchant({ id: 'm-2', adapterType: 'dom' });
    await expect(setAdapter({ merchantId: 'm-2', type: 'lol' as never, reason: 'x' })).rejects.toThrow(/unknown adapter type/i);
  });

  it('errors when merchant does not exist', async () => {
    await expect(setAdapter({ merchantId: 'no-such', type: 'suggest', reason: 'x' })).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

Run: `pnpm test set-adapter`
Expected: FAIL — module missing.

### Task 12: Implement `set-adapter` CLI

**Files:**
- Create: `apps/api/scripts/set-adapter.ts`

- [ ] **Step 1: Write it**

```ts
// apps/api/scripts/set-adapter.ts
import { db, merchants, adapterTypes, type AdapterType } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { promoteToSuggest } from '../../../apps/worker/src/steps/promoteToSuggest';

export interface SetAdapterArgs {
  merchantId: string;
  type: AdapterType;
  reason: string;
}

export async function setAdapter(args: SetAdapterArgs): Promise<void> {
  if (!(adapterTypes as readonly string[]).includes(args.type)) {
    throw new Error(`unknown adapter type: ${args.type}`);
  }
  const [m] = await db.select().from(merchants).where(eq(merchants.id, args.merchantId));
  if (!m) throw new Error(`merchant ${args.merchantId} not found`);

  if (args.type === 'suggest') {
    await promoteToSuggest(args.merchantId, args.reason);
    return;
  }

  await db.update(merchants).set({ adapterType: args.type }).where(eq(merchants.id, args.merchantId));
}

// CLI entry
if (require.main === module) {
  const args = parseFlags(process.argv.slice(2));
  setAdapter({ merchantId: args.merchant, type: args.type as AdapterType, reason: args.reason ?? 'manual_cli' })
    .then(() => { console.log(`OK: set ${args.merchant} → ${args.type}`); process.exit(0); })
    .catch((err: Error) => { console.error(err.message); process.exit(1); });
}

function parseFlags(argv: string[]): { merchant: string; type: string; reason?: string } {
  const out: Record<string, string> = {};
  for (const a of argv) {
    const m = a.match(/^--([^=]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  if (!out.merchant || !out.type) {
    console.error('Usage: set-adapter --merchant=<id> --type=<adapter_type> [--reason=<text>]');
    process.exit(2);
  }
  return out as never;
}
```

- [ ] **Step 2: Run the tests**

Run: `pnpm test set-adapter`
Expected: PASS.

- [ ] **Step 3: Register the CLI in package scripts**

Edit `apps/api/package.json` `"scripts"`:

```json
"set-adapter": "tsx scripts/set-adapter.ts"
```

Edit the root `shoppingmate:dev` dispatcher (the same script that already routes `provision` and `adapter-smoke` from Plans 2 + 3b) to add a `set-adapter` case that forwards args to `apps/api`'s script.

- [ ] **Step 4: Smoke the CLI manually**

Run: `pnpm shoppingmate:dev set-adapter --merchant=m-test --type=suggest --reason=manual_test`
Expected: prints `OK: set m-test → suggest` (assuming `m-test` exists; otherwise `merchant m-test not found`).

- [ ] **Step 5: Commit**

```bash
git add apps/api/scripts/set-adapter.ts tests/api/scripts/set-adapter.test.ts apps/api/package.json package.json
git commit -m "feat(cli): shoppingmate:dev set-adapter escape hatch"
```

---

## Phase F — adapter-smoke for Suggest

### Task 13: Extend adapter-smoke to handle Suggest

**Files:**
- Modify: `apps/api/scripts/adapter-smoke.ts`

- [ ] **Step 1: Add Suggest branch**

The existing `adapter-smoke.ts` from Plan 3b walks 7 steps using a real `getAdapter`. For Suggest, capture `WSTransport` outputs instead of asserting transactable cart state:

```ts
// apps/api/scripts/adapter-smoke.ts — add near top
import { FakeWSTransport } from '@shoppingmate/adapters/dom/fakeTransport';

// inside main(), after getAdapter():
let transport: FakeWSTransport | undefined;
if (merchant.adapterType === 'suggest' || merchant.adapterType === 'dom') {
  transport = new FakeWSTransport();
  // Acknowledge every send so the adapter doesn't block — DOM smoke uses the
  // real Playwright harness (Plan 3d, Task 16); Suggest just needs ackAll.
  transport.ackAll({ ok: true });
}

const deps = { fetch: globalThis.fetch, transport };
const adapter = getAdapter(merchant, deps);

// At step 3 (cartAdd):
const add = await adapter.cartAdd(ctx, probeSku, null, 1);
if (merchant.adapterType === 'suggest') {
  if (add.kind !== 'ok') throw new Error(`Suggest cartAdd should be ok, got ${add.kind}`);
  const sent = transport!.sent(ctx.sessionId);
  if (!sent.some((m) => m.type === 'ui.show_message')) throw new Error('expected ui.show_message');
  if (!sent.some((m) => m.type === 'ui.show_product_card')) throw new Error('expected ui.show_product_card');
  console.log('  ✓ Suggest emitted ui.show_message + ui.show_product_card');
}
```

- [ ] **Step 2: Smoke a Suggest merchant**

Pre-req: have a merchant in dev DB with `adapter_type='suggest'` and at least one product. Use the CLI from Task 12 to flip an existing merchant.

Run: `pnpm shoppingmate:dev adapter-smoke <merchant-id>`
Expected: all 7 steps green, log includes the `ui.show_*` assertions above.

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/adapter-smoke.ts
git commit -m "feat(scripts): adapter-smoke covers Suggest WS outputs"
```

---

## Phase G — Acceptance + tag

### Task 14: Full acceptance run

- [ ] **Step 1: Provision a Suggest-eligible merchant end-to-end**

Pick a known Cloudflare-blocked or shadow-DOM site (use any test merchant; the manual flag is the point):

```bash
pnpm shoppingmate:dev provision --domain=<some-site>
pnpm shoppingmate:dev set-adapter --merchant=<id> --type=suggest --reason=cloudflare
```

Expected: merchant reaches `status='live'` with `adapter_type='suggest'`.

- [ ] **Step 2: Force DOM smoke failure → auto-promote**

Pick a DOM-adapter test merchant. Temporarily corrupt its `adapter_config.selectors.add_to_cart_button` to a guaranteed-miss selector. Re-run onboarding:

```bash
pnpm shoppingmate:dev provision --domain=<dom-merchant-domain>
```

Expected:
- `merchants.adapter_type` flips from `'dom'` to `'suggest'`.
- One row in `metric_events` with `name='adapterPromotedToSuggest'` and `tags->>'reason'` matching `'three_unsupported_cart_adds'` or `'action_cap'`.

- [ ] **Step 3: Verify dispatcher exhaustiveness compile-time guarantee**

Temporarily add a 9th value to `adapterTypes` in `packages/db/src/schema/merchants.ts` (e.g., `'experimental'`) and run `pnpm --filter @shoppingmate/adapters typecheck`.
Expected: typecheck FAILS in `dispatch.ts` with "Argument of type 'experimental' is not assignable to parameter of type 'never'".
Then revert the change.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: green.

- [ ] **Step 5: Lint + typecheck**

Run: `pnpm lint && pnpm typecheck`
Expected: green.

### Task 15: Tag the release

- [ ] **Step 1: Create the tag**

```bash
git tag phase1-plan3e-suggest-adapter-complete -m "Phase 1 Plan 3 fully complete: Suggest adapter + DOM→Suggest auto-fallback + exhaustive dispatcher"
```

- [ ] **Step 2: Verify Plan 3 closure**

```bash
git tag --list 'phase1-plan3*'
```

Expected output (5 tags):

```
phase1-plan3a-onboarding-completion-complete
phase1-plan3b-wedge-adapters-complete
phase1-plan3c-remaining-platform-adapters-complete
phase1-plan3d-dom-adapter-complete
phase1-plan3e-suggest-adapter-complete
```

With this tag, **Plan 3 is fully closed**. Phase 1 moves to Plan 4 (voice agent), which imports `SUGGEST_PROMPT_HINT` from `@shoppingmate/adapters` for its system prompt fragment.
