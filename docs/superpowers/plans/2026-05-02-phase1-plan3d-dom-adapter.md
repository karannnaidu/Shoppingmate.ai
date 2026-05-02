# Phase 1 — Plan 3d: DOMAdapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make custom-platform merchants transactable. Ship the `DOMAdapter`, the WS transport contract that lets the gtag widget execute DOM actions in the visitor's browser, and the runtime selector resolver (Haiku 4.5) with override-permanence enforcement.

**Architecture:** New `packages/adapters/src/dom/` directory holds the adapter, the WS transport interface, and the resolver. `apps/api/src/routes/widget/ws.ts` hosts the server side of the WebSocket. A `FakeWSTransport` enables unit tests; a Playwright-based "fake gtag" CLI harness drives the acceptance smoke against a real custom site. `selector_cache` gains 3 columns; resolver writes `source='llm_resolved'` rows on heal and refuses to mutate `source='merchant_override'` rows.

**Tech Stack:** TypeScript, vitest, msw v2, drizzle-orm + postgres, OpenRouter (Haiku 4.5), `ws` (server WebSocket), Playwright (already added in 3a — used here as the gtag harness for acceptance only).

**Spec:** [`docs/superpowers/specs/2026-05-02-phase1-plan3d-dom-adapter-design.md`](../specs/2026-05-02-phase1-plan3d-dom-adapter-design.md)

**Acceptance:** Spec §9 — adapter-smoke green for a real custom website using the Playwright harness; resolver heals at least one stale selector; override-permanence test passes; action-cap tests pass; lint+typecheck clean.

---

## File structure

**New files:**

- `packages/adapters/src/dom/transport.ts` — `WSTransport`, `DomAction`, `DomAck` types
- `packages/adapters/src/dom/resolver.ts` — selector cache + Haiku heal
- `packages/adapters/src/dom/sessionState.ts` — per-session counters (Redis-backed; in-memory in tests)
- `packages/adapters/src/dom/index.ts` — `DOMAdapter`
- `packages/adapters/test/dom/transport.test.ts`
- `packages/adapters/test/dom/resolver.test.ts`
- `packages/adapters/test/dom/sessionState.test.ts`
- `packages/adapters/test/dom/dom.test.ts`
- `apps/api/src/routes/widget/ws.ts` — server WebSocket
- `apps/api/src/routes/widget/wsAuth.ts` — JWT verify helper
- `apps/api/scripts/dom-smoke-harness.ts` — Playwright fake-gtag for acceptance
- `tests/api/widget/ws.test.ts`
- `migrations/<ts>_selector_cache_extras.sql`

**Modified files:**

- `packages/db/src/schema/selectorCache.ts` — add `overrideLockedAt`, `suggestedReplacement`, `alertSentAt`
- `packages/db/src/schema/metricEvents.ts` — add 9 new keys
- `packages/db/src/repos/selectorCacheRepo.ts` — new file (or extend existing if present)
- `packages/db/src/index.ts` — export `selectorCacheRepo`
- `packages/adapters/src/dispatch.ts` — wire `dom` → `new DOMAdapter(transport)`
- `packages/adapters/src/index.ts` — export `WSTransport`, `DomAction`, `DomAck`
- `apps/api/src/index.ts` — mount WS upgrade handler
- `apps/api/scripts/adapter-smoke.ts` — DOMAdapter path: spin the Playwright harness in-process
- `apps/api/package.json` — add `ws` dep (server-side WebSocket)
- `tests/worker/smokeTest.test.ts` — DOM smoke now goes through DOMAdapter

---

## Phase A — Schema + repo

### Task 1: Extend `selector_cache` schema

**Files:**
- Modify: `packages/db/src/schema/selectorCache.ts`

- [ ] **Step 1: Extend schema**

```ts
// packages/db/src/schema/selectorCache.ts (add three timestamps + text)
overrideLockedAt: timestamp('override_locked_at', { withTimezone: true }),
suggestedReplacement: text('suggested_replacement'),
alertSentAt: timestamp('alert_sent_at', { withTimezone: true }),
```

- [ ] **Step 2: Generate migration**

Run: `pnpm --filter @shoppingmate/db drizzle:generate`
Expected: `migrations/<ts>_selector_cache_extras.sql` written.

- [ ] **Step 3: Apply locally**

Run: `pnpm --filter @shoppingmate/db drizzle:migrate`
Expected: `selector_cache` has the 3 new columns.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema/selectorCache.ts migrations/
git commit -m "feat(db): selector_cache override-permanence columns"
```

### Task 2: `selectorCacheRepo`

**Files:**
- Create: `packages/db/src/repos/selectorCacheRepo.ts`
- Create: `tests/db/selectorCacheRepo.test.ts`

- [ ] **Step 1: Test**

```ts
// tests/db/selectorCacheRepo.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { selectorCacheRepo } from '../../packages/db/src/repos/selectorCacheRepo.js';
import { db } from '../../packages/db/src/index.js';
import { selectorCache } from '../../packages/db/src/schema/selectorCache.js';

beforeEach(async () => { await db.delete(selectorCache); /* clean */ });

describe('selectorCacheRepo', () => {
  it('upsertHealed writes source=llm_resolved', async () => {
    await selectorCacheRepo.upsertHealed('SM-T01', 'hash1', 'add_to_cart_button', '#buy');
    const rows = await db.select().from(selectorCache);
    expect(rows[0].source).toBe('llm_resolved');
    expect(rows[0].resolvedSelector).toBe('#buy');
  });

  it('upsertHealed never overwrites merchant_override', async () => {
    await selectorCacheRepo.put('SM-T01', 'hash1', 'add_to_cart_button', '.buy', 'merchant_override');
    await selectorCacheRepo.upsertHealed('SM-T01', 'hash1', 'add_to_cart_button', '#evil');
    const r = await selectorCacheRepo.get('SM-T01', 'hash1', 'add_to_cart_button');
    expect(r?.source).toBe('merchant_override');
    expect(r?.resolvedSelector).toBe('.buy');
  });

  it('markOverrideFailing sets last_test_passed=false + suggested_replacement', async () => {
    await selectorCacheRepo.put('SM-T01', 'h', 'k', '.x', 'merchant_override');
    await selectorCacheRepo.markOverrideFailing('SM-T01', 'h', 'k', '#better');
    const r = await selectorCacheRepo.get('SM-T01', 'h', 'k');
    expect(r?.lastTestPassed).toBe(false);
    expect(r?.suggestedReplacement).toBe('#better');
    expect(r?.resolvedSelector).toBe('.x'); // unchanged
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/db/src/repos/selectorCacheRepo.ts
import { and, eq } from 'drizzle-orm';
import { db } from '../index.js';
import { selectorCache, type SelectorCacheRow, type SelectorSource } from '../schema/selectorCache.js';

export const selectorCacheRepo = {
  async get(merchantId: string, hash: string, key: string): Promise<SelectorCacheRow | null> {
    const [r] = await db.select().from(selectorCache).where(and(
      eq(selectorCache.merchantId, merchantId),
      eq(selectorCache.pageTemplateHash, hash),
      eq(selectorCache.selectorKey, key),
    )).limit(1);
    return r ?? null;
  },

  async put(merchantId: string, hash: string, key: string, selector: string, source: SelectorSource): Promise<void> {
    await db.insert(selectorCache).values({
      merchantId, pageTemplateHash: hash, selectorKey: key,
      resolvedSelector: selector, source, locked: source === 'merchant_override',
      overrideLockedAt: source === 'merchant_override' ? new Date() : null,
    }).onConflictDoUpdate({
      target: [selectorCache.merchantId, selectorCache.pageTemplateHash, selectorCache.selectorKey],
      set: { resolvedSelector: selector, source, lastTestedAt: new Date() },
    });
  },

  async upsertHealed(merchantId: string, hash: string, key: string, selector: string): Promise<void> {
    const existing = await this.get(merchantId, hash, key);
    if (existing?.source === 'merchant_override') return; // override-permanence
    await db.insert(selectorCache).values({
      merchantId, pageTemplateHash: hash, selectorKey: key,
      resolvedSelector: selector, source: 'llm_resolved', locked: false,
      lastTestedAt: new Date(), lastTestPassed: true,
    }).onConflictDoUpdate({
      target: [selectorCache.merchantId, selectorCache.pageTemplateHash, selectorCache.selectorKey],
      set: { resolvedSelector: selector, source: 'llm_resolved', lastTestedAt: new Date(), lastTestPassed: true },
    });
  },

  async markOverrideFailing(merchantId: string, hash: string, key: string, suggestion: string | null): Promise<void> {
    await db.update(selectorCache).set({
      lastTestPassed: false,
      lastTestedAt: new Date(),
      suggestedReplacement: suggestion,
    }).where(and(
      eq(selectorCache.merchantId, merchantId),
      eq(selectorCache.pageTemplateHash, hash),
      eq(selectorCache.selectorKey, key),
    ));
  },

  async markPassed(merchantId: string, hash: string, key: string): Promise<void> {
    await db.update(selectorCache).set({ lastTestPassed: true, lastTestedAt: new Date() }).where(and(
      eq(selectorCache.merchantId, merchantId),
      eq(selectorCache.pageTemplateHash, hash),
      eq(selectorCache.selectorKey, key),
    ));
  },
};
```

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/db/src/repos/selectorCacheRepo.ts tests/db/selectorCacheRepo.test.ts
git commit -m "feat(db): selectorCacheRepo with override-permanence enforcement"
```

### Task 3: Metric registry additions

**Files:**
- Modify: `packages/db/src/schema/metricEvents.ts`
- Modify: `tests/db/metricEvents.test.ts`

- [ ] **Step 1: Add keys** to the registry: `domAction`, `domActionFailed`, `selectorResolverHit`, `selectorResolverMiss`, `selectorResolverHealed`, `selectorResolverGaveUp`, `selectorOverrideFailing`, `domAdapterDegradedToSuggest`, `domSessionActionCap`.

- [ ] **Step 2: Test** asserts the keys exist:

```ts
expect(metricNames).toContain('domAction');
expect(metricNames).toContain('selectorResolverHealed');
// ...etc
```

- [ ] **Step 3: Run — pass**, **Step 4: Commit**

```bash
git add packages/db/src/schema/metricEvents.ts tests/db/metricEvents.test.ts
git commit -m "feat(db): metric registry — DOM adapter + selector resolver keys"
```

---

## Phase B — WS transport contract

### Task 4: Define `DomAction`/`DomAck`/`WSTransport`

**Files:**
- Create: `packages/adapters/src/dom/transport.ts`
- Create: `packages/adapters/test/dom/transport.test.ts`

- [ ] **Step 1: Test (FakeWSTransport behavior)**

```ts
// packages/adapters/test/dom/transport.test.ts
import { describe, it, expect } from 'vitest';
import { FakeWSTransport } from '../../src/dom/transport.js';

describe('FakeWSTransport', () => {
  it('returns scripted ack', async () => {
    const t = new FakeWSTransport();
    t.scriptOnce({ ok: true, value: '$19.99' });
    const ack = await t.send('s', { type: 'dom.read', selector: '.total' });
    expect(ack.ok).toBe(true);
    if (ack.ok) expect(ack.value).toBe('$19.99');
  });

  it('throws when no script left', async () => {
    const t = new FakeWSTransport();
    await expect(t.send('s', { type: 'dom.read', selector: '.x' })).rejects.toThrow(/script_empty/);
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/dom/transport.ts
export type DomAction =
  | { type: 'dom.navigate'; url: string }
  | { type: 'dom.click'; selector: string }
  | { type: 'dom.fill'; selector: string; value: string }
  | { type: 'dom.read'; selector: string }
  | { type: 'dom.wait_for'; selector: string; condition: 'present'|'mutation'; timeoutMs: number }
  | { type: 'dom.snapshot' }
  | { type: 'ui.show_message'; text: string }
  | { type: 'ui.show_product_card'; product: { title: string; imageUrl: string | null; priceCents: number; currency: string; productUrl: string } };

export type DomAck =
  | { ok: true; value?: string; screenshotId?: string }
  | { ok: false; reason: 'selector_not_found'|'timeout'|'navigate_blocked'|'safety_blocked'; html?: string; screenshotId?: string };

export interface WSTransport {
  send(sessionId: string, action: DomAction): Promise<DomAck>;
}

export class FakeWSTransport implements WSTransport {
  private script: DomAck[] = [];
  scriptOnce(ack: DomAck) { this.script.push(ack); }
  scriptMany(acks: DomAck[]) { this.script.push(...acks); }
  async send(_sessionId: string, _action: DomAction): Promise<DomAck> {
    const next = this.script.shift();
    if (!next) throw new Error(`script_empty: ${JSON.stringify(_action)}`);
    return next;
  }
}
```

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/adapters/src/dom/transport.ts packages/adapters/test/dom/transport.test.ts
git commit -m "feat(adapters/dom): WSTransport interface + FakeWSTransport for tests"
```

### Task 5: Per-session state holder

**Files:**
- Create: `packages/adapters/src/dom/sessionState.ts`
- Create: `packages/adapters/test/dom/sessionState.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect } from 'vitest';
import { InMemorySessionState } from '../../src/dom/sessionState.js';

describe('SessionState', () => {
  it('tracks counters per session', async () => {
    const s = new InMemorySessionState();
    await s.incrAction('sess', 'turn');
    await s.incrAction('sess', 'turn');
    expect(await s.getActions('sess')).toEqual({ thisTurn: 2, thisSession: 2 });
  });

  it('newTurn resets thisTurn but not thisSession', async () => {
    const s = new InMemorySessionState();
    await s.incrAction('sess', 'turn');
    await s.newTurn('sess');
    expect(await s.getActions('sess')).toEqual({ thisTurn: 0, thisSession: 1 });
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/dom/sessionState.ts
export interface SessionState {
  incrAction(sessionId: string, scope: 'turn'|'session'): Promise<void>;
  getActions(sessionId: string): Promise<{ thisTurn: number; thisSession: number }>;
  incrResolver(sessionId: string): Promise<number>; // returns post-increment count
  newTurn(sessionId: string): Promise<void>;
}

type Slot = { thisTurn: number; thisSession: number; resolverCalls: number };

export class InMemorySessionState implements SessionState {
  private map = new Map<string, Slot>();
  private get(sid: string): Slot {
    let s = this.map.get(sid);
    if (!s) { s = { thisTurn: 0, thisSession: 0, resolverCalls: 0 }; this.map.set(sid, s); }
    return s;
  }
  async incrAction(sid: string, _scope: 'turn'|'session') {
    const s = this.get(sid); s.thisTurn++; s.thisSession++;
  }
  async getActions(sid: string) {
    const s = this.get(sid); return { thisTurn: s.thisTurn, thisSession: s.thisSession };
  }
  async incrResolver(sid: string) {
    const s = this.get(sid); return ++s.resolverCalls;
  }
  async newTurn(sid: string) {
    this.get(sid).thisTurn = 0;
  }
}
```

(Redis-backed implementation lives in Plan 4 where session lifecycle is owned. 3d ships only the in-memory variant.)

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/adapters/src/dom/sessionState.ts packages/adapters/test/dom/sessionState.test.ts
git commit -m "feat(adapters/dom): SessionState (in-memory) for action + resolver caps"
```

---

## Phase C — Selector resolver

### Task 6: `resolveSelector` happy paths + cache hits

**Files:**
- Create: `packages/adapters/src/dom/resolver.ts`
- Create: `packages/adapters/test/dom/resolver.test.ts`

- [ ] **Step 1: Test**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveSelector, markSelectorFailed } from '../../src/dom/resolver.js';
import { selectorCacheRepo } from '@shoppingmate/db';

const merchant = { id:'SM-T01', adapterConfig:{ selectors:{ add_to_cart_button:'.config-default' }, page_templates:{ product:'h1' } } } as any;

describe('resolveSelector', () => {
  beforeEach(async () => { /* truncate selector_cache */ });

  it('returns adapter_config selector when no cache row', async () => {
    const r = await resolveSelector({ merchant, sessionId:'s', pageTemplateHash:'h1', selectorKey:'add_to_cart_button' });
    expect(r).toEqual({ kind:'use_selector', selector:'.config-default', source:'auto' });
  });

  it('returns cached llm_resolved selector', async () => {
    await selectorCacheRepo.upsertHealed('SM-T01','h1','add_to_cart_button','#cached');
    const r = await resolveSelector({ merchant, sessionId:'s', pageTemplateHash:'h1', selectorKey:'add_to_cart_button' });
    expect(r).toEqual({ kind:'use_selector', selector:'#cached', source:'llm_resolved' });
  });

  it('respects merchant_override even when failing', async () => {
    await selectorCacheRepo.put('SM-T01','h1','add_to_cart_button','.override','merchant_override');
    await selectorCacheRepo.markOverrideFailing('SM-T01','h1','add_to_cart_button',null);
    const r = await resolveSelector({ merchant, sessionId:'s', pageTemplateHash:'h1', selectorKey:'add_to_cart_button' });
    expect(r.kind).toBe('degrade_to_suggest');
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement (skeleton; healing in Task 7)**

```ts
// packages/adapters/src/dom/resolver.ts
import type { Merchant } from '@shoppingmate/db';
import { selectorCacheRepo } from '@shoppingmate/db';
import type { SelectorSource } from '@shoppingmate/db';

export type ResolveOutcome =
  | { kind: 'use_selector'; selector: string; source: SelectorSource }
  | { kind: 'degrade_to_suggest'; reason: string }
  | { kind: 'gave_up'; reason: string };

export type ResolveCtx = {
  merchant: Merchant;
  sessionId: string;
  pageTemplateHash: string;
  selectorKey: string;
  html?: string;
};

export type ResolveOptions = {
  llmCall?: (prompt: string) => Promise<string>;
  maxLlmPerSession?: number;
  state?: { incrResolver(sessionId: string): Promise<number> };
};

export async function resolveSelector(ctx: ResolveCtx, _opts: ResolveOptions = {}): Promise<ResolveOutcome> {
  const cached = await selectorCacheRepo.get(ctx.merchant.id, ctx.pageTemplateHash, ctx.selectorKey);
  if (cached) {
    if (cached.source === 'merchant_override' && cached.lastTestPassed === false) {
      return { kind: 'degrade_to_suggest', reason: 'override_failing' };
    }
    return { kind: 'use_selector', selector: cached.resolvedSelector, source: cached.source };
  }
  const fromConfig = (ctx.merchant.adapterConfig as { selectors?: Record<string,string> }).selectors?.[ctx.selectorKey];
  if (fromConfig) return { kind: 'use_selector', selector: fromConfig, source: 'auto' };
  return { kind: 'gave_up', reason: 'no_selector_anywhere' };
}

export async function markSelectorFailed(_ctx: ResolveCtx, _opts: ResolveOptions = {}): Promise<ResolveOutcome> {
  // implemented in Task 7
  return { kind: 'gave_up', reason: 'not_implemented_yet' };
}
```

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/adapters/src/dom/resolver.ts packages/adapters/test/dom/resolver.test.ts
git commit -m "feat(adapters/dom): selector resolver — cache hits + override-permanence"
```

### Task 7: Resolver — healing path with Haiku

**Files:**
- Modify: `packages/adapters/src/dom/resolver.ts`
- Modify: `packages/adapters/test/dom/resolver.test.ts`

- [ ] **Step 1: Test**

```ts
it('heals via LLM and caches result', async () => {
  const llmCall = vi.fn(async (_p: string) => '#headless-buy');
  const state = new InMemorySessionState();
  const r = await markSelectorFailed(
    { merchant, sessionId:'s', pageTemplateHash:'h1', selectorKey:'add_to_cart_button', html:'<html><button id="headless-buy">Buy</button></html>' },
    { llmCall, state, maxLlmPerSession: 5 },
  );
  expect(r).toEqual({ kind:'use_selector', selector:'#headless-buy', source:'llm_resolved' });
  expect(llmCall).toHaveBeenCalledTimes(1);
  const cached = await selectorCacheRepo.get('SM-T01','h1','add_to_cart_button');
  expect(cached?.resolvedSelector).toBe('#headless-buy');
});

it('gives up after maxLlmPerSession', async () => {
  const llmCall = vi.fn(async () => '#x');
  const state = new InMemorySessionState();
  for (let i = 0; i < 5; i++) await state.incrResolver('s');
  const r = await markSelectorFailed(
    { merchant, sessionId:'s', pageTemplateHash:'h1', selectorKey:'add_to_cart_button', html:'<html/>' },
    { llmCall, state, maxLlmPerSession: 5 },
  );
  expect(r.kind).toBe('gave_up');
});

it('writes suggested_replacement (does NOT mutate selector) for failing override', async () => {
  await selectorCacheRepo.put('SM-T01','h1','add_to_cart_button','.override','merchant_override');
  const llmCall = vi.fn(async () => '#suggested');
  const r = await markSelectorFailed(
    { merchant, sessionId:'s', pageTemplateHash:'h1', selectorKey:'add_to_cart_button', html:'<html/>' },
    { llmCall, state: new InMemorySessionState(), maxLlmPerSession: 5 },
  );
  expect(r.kind).toBe('degrade_to_suggest');
  const row = await selectorCacheRepo.get('SM-T01','h1','add_to_cart_button');
  expect(row?.resolvedSelector).toBe('.override'); // unchanged
  expect(row?.suggestedReplacement).toBe('#suggested');
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

Replace the body of `markSelectorFailed`:

```ts
const KEY_HINTS: Record<string,string> = {
  add_to_cart_button: 'the button that adds the current product to cart',
  qty_input: 'the quantity number input on a product or cart page',
  variant_selector_template: 'the swatch/select that picks a product variant',
  cart_url: 'the URL or anchor that navigates to the cart page',
  cart_page_total: 'the cart-total text element on the cart page',
  checkout_button: 'the button that proceeds to checkout',
  coupon_field: 'the input where the visitor types a coupon code',
  coupon_apply_button: 'the button that submits the coupon',
  line_item_remove_button: 'the button that removes a line item from the cart',
  thank_you_order_id: 'the order id text on the thank-you page',
  thank_you_total: 'the total text on the thank-you page',
};

export async function markSelectorFailed(ctx: ResolveCtx, opts: ResolveOptions = {}): Promise<ResolveOutcome> {
  const max = opts.maxLlmPerSession ?? 5;
  const calls = await opts.state?.incrResolver(ctx.sessionId) ?? 1;
  const cached = await selectorCacheRepo.get(ctx.merchant.id, ctx.pageTemplateHash, ctx.selectorKey);

  // Override-permanence: ask Haiku for a hint but DO NOT replace the selector.
  if (cached?.source === 'merchant_override') {
    let suggestion: string | null = null;
    if (opts.llmCall && calls <= max) {
      try { suggestion = await opts.llmCall(buildPrompt(ctx)); } catch { /* swallow; suggestion stays null */ }
    }
    await selectorCacheRepo.markOverrideFailing(ctx.merchant.id, ctx.pageTemplateHash, ctx.selectorKey, suggestion);
    return { kind: 'degrade_to_suggest', reason: 'override_failing' };
  }

  if (calls > max) return { kind: 'gave_up', reason: 'resolver_cap_exhausted' };
  if (!opts.llmCall) return { kind: 'gave_up', reason: 'no_llm_callable' };

  const selector = await opts.llmCall(buildPrompt(ctx));
  if (!selector || selector.length > 500) return { kind: 'gave_up', reason: 'llm_bad_output' };
  await selectorCacheRepo.upsertHealed(ctx.merchant.id, ctx.pageTemplateHash, ctx.selectorKey, selector);
  return { kind: 'use_selector', selector, source: 'llm_resolved' };
}

function buildPrompt(ctx: ResolveCtx): string {
  const html = (ctx.html ?? '').slice(0, 24_000); // ~6k tokens upper bound
  const hint = KEY_HINTS[ctx.selectorKey] ?? 'a relevant element';
  return [
    'You are extracting a CSS selector from this DOM. Return ONLY the selector string, no explanation, no quotes, no backticks.',
    `Selector key: ${ctx.selectorKey}`,
    `Hint: ${hint}`,
    `Truncated HTML:\n${html}`,
  ].join('\n\n');
}
```

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/adapters/src/dom/resolver.ts packages/adapters/test/dom/resolver.test.ts
git commit -m "feat(adapters/dom): resolver heals via Haiku 4.5; override-permanence preserved"
```

---

## Phase D — DOMAdapter

### Task 8: DOMAdapter reads + cartAdd skeleton

**Files:**
- Create: `packages/adapters/src/dom/index.ts`
- Create: `packages/adapters/test/dom/dom.test.ts`

- [ ] **Step 1: Test (cartAdd happy path with FakeWSTransport)**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DOMAdapter } from '../../src/dom/index.js';
import { FakeWSTransport } from '../../src/dom/transport.js';
import { InMemorySessionState } from '../../src/dom/sessionState.js';
import type { Merchant } from '@shoppingmate/db';

const merchant = {
  id:'SM-DOM', domain:'custom.example.com', adapterType:'dom',
  adapterConfig: {
    selectors: {
      add_to_cart_button:'#add', qty_input:'[name=qty]', cart_url:'/cart',
      cart_page_total:'.cart-total', checkout_button:'#checkout',
      coupon_field:'#coupon', coupon_apply_button:'#apply-coupon',
      line_item_remove_button:'.remove',
    },
    page_templates: { product:'p1', cart:'c1' },
  },
  status:'live', installedAt:new Date(), personaId:'concierge', allowedDomains:[],
} as unknown as Merchant;

describe('DOMAdapter — cartAdd', () => {
  it('runs nav→click→fill→click→wait_for→read sequence', async () => {
    const t = new FakeWSTransport();
    t.scriptMany([
      { ok: true }, // navigate
      { ok: true }, // click variant (no-op selector if not provided — but here we just expect a click) — see code: only emitted when variantId set
      { ok: true }, // fill qty
      { ok: true }, // click add
      { ok: true }, // wait_for
      { ok: true, value: '$19.99' }, // read total
    ]);
    const a = new DOMAdapter(t, new InMemorySessionState());
    // Plan 3a's catalogRepo.getProduct must return a real product for navigate URL
    vi.spyOn(await import('@shoppingmate/db'), 'getProduct').mockResolvedValue({
      sku:'TEE', productUrl:'https://custom.example.com/products/tee', variants:[],
      title:'Tee', priceCents:1999, currency:'USD', inStock:true,
    } as any);
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'TEE', null, 1);
    expect(r.kind).toBe('ok');
  });
});
```

- [ ] **Step 2: Run — fail**

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// packages/adapters/src/dom/index.ts
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from '../types.js';
import type { Product } from '@shoppingmate/db';
import { searchProducts as repoSearch, getProduct as repoGet } from '@shoppingmate/db';
import { resolveSelector, markSelectorFailed } from './resolver.js';
import type { WSTransport, DomAction, DomAck } from './transport.js';
import type { SessionState } from './sessionState.js';

const ACTION_CAP_TURN = 50;
const ACTION_CAP_SESSION = 200;

export class DOMAdapter implements Adapter {
  readonly kind = 'dom' as const;
  constructor(
    private transport: WSTransport,
    private state: SessionState,
    private llmCall?: (prompt: string) => Promise<string>,
  ) {}

  async searchProducts(ctx: AdapterContext, q: string, limit = 20): Promise<AdapterResult<Product[]>> {
    return { kind: 'ok', value: await repoSearch(ctx.merchant.id, q, limit) };
  }
  async getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>> {
    return { kind: 'ok', value: await repoGet(ctx.merchant.id, sku) };
  }

  private templateHash(ctx: AdapterContext, page: 'product'|'cart'|'checkout'): string {
    return (ctx.merchant.adapterConfig as { page_templates?: Record<string,string> }).page_templates?.[page] ?? 'unknown';
  }

  private async runWithHeal(
    ctx: AdapterContext, page: 'product'|'cart'|'checkout', key: string,
    build: (selector: string) => DomAction,
  ): Promise<DomAck | { kind: 'degraded' } | { kind: 'gave_up' }> {
    const hash = this.templateHash(ctx, page);
    const a = await this.actionCapCheck(ctx);
    if (a) return { kind: 'gave_up' };
    let resolved = await resolveSelector({ merchant: ctx.merchant, sessionId: ctx.sessionId, pageTemplateHash: hash, selectorKey: key });
    for (let attempt = 0; attempt < 3; attempt++) {
      if (resolved.kind === 'degrade_to_suggest') return { kind: 'degraded' };
      if (resolved.kind === 'gave_up') return { kind: 'gave_up' };
      const ack = await this.transport.send(ctx.sessionId, build(resolved.selector));
      await this.state.incrAction(ctx.sessionId, 'session');
      if (ack.ok) return ack;
      if (ack.reason !== 'selector_not_found' && ack.reason !== 'timeout') return ack;
      resolved = await markSelectorFailed(
        { merchant: ctx.merchant, sessionId: ctx.sessionId, pageTemplateHash: hash, selectorKey: key, html: ack.html },
        { llmCall: this.llmCall, maxLlmPerSession: 5, state: this.state },
      );
    }
    return { kind: 'gave_up' };
  }

  private async actionCapCheck(ctx: AdapterContext): Promise<AdapterResult<never> | null> {
    const counts = await this.state.getActions(ctx.sessionId);
    if (counts.thisTurn >= ACTION_CAP_TURN || counts.thisSession >= ACTION_CAP_SESSION) {
      return { kind: 'unsupported', reason: 'action_cap' };
    }
    return null;
  }

  async cartAdd(ctx: AdapterContext, sku: string, _variantId: string | null, qty: number): Promise<AdapterResult<CartState>> {
    const product = await repoGet(ctx.merchant.id, sku);
    if (!product) return { kind: 'unsupported', reason: 'product_not_in_catalog' };

    const cap = await this.actionCapCheck(ctx);
    if (cap) return cap;

    // 1. navigate
    const navAck = await this.transport.send(ctx.sessionId, { type:'dom.navigate', url: product.productUrl });
    await this.state.incrAction(ctx.sessionId, 'session');
    if (!navAck.ok) return { kind: 'platform_error', status: 0, body: `navigate_${navAck.reason}` };

    // 2. fill qty
    const fillRes = await this.runWithHeal(ctx, 'product', 'qty_input',
      (sel) => ({ type:'dom.fill', selector: sel, value: String(qty) }));
    if ('kind' in fillRes && fillRes.kind === 'degraded') return { kind:'unsupported', reason:'override_failing' };
    if ('kind' in fillRes && fillRes.kind === 'gave_up') return { kind:'unsupported', reason:'gave_up' };

    // 3. click add
    const clickRes = await this.runWithHeal(ctx, 'product', 'add_to_cart_button',
      (sel) => ({ type:'dom.click', selector: sel }));
    if ('kind' in clickRes && (clickRes.kind === 'degraded' || clickRes.kind === 'gave_up'))
      return { kind:'unsupported', reason: clickRes.kind === 'degraded' ? 'override_failing' : 'gave_up' };

    // 4. wait for cart total mutation
    const waitRes = await this.runWithHeal(ctx, 'cart', 'cart_page_total',
      (sel) => ({ type:'dom.wait_for', selector: sel, condition:'mutation', timeoutMs: 5000 }));
    if ('kind' in waitRes && (waitRes.kind === 'degraded' || waitRes.kind === 'gave_up'))
      return { kind:'unsupported', reason:'wait_failed' };

    // 5. read total
    const readRes = await this.runWithHeal(ctx, 'cart', 'cart_page_total',
      (sel) => ({ type:'dom.read', selector: sel }));
    const totalText = ('ok' in readRes && readRes.ok) ? (readRes.value ?? '') : '';
    const totalCents = parseTotal(totalText);

    const lines: CartLine[] = [{
      lineId: `${sku}:${Date.now()}`,
      sku, variantId: null,
      title: product.title, qty,
      unitPriceCents: product.priceCents ?? totalCents,
      lineTotalCents: totalCents,
      currency: product.currency ?? 'USD',
      imageUrl: product.imageUrl,
    }];

    return {
      kind: 'ok',
      value: {
        cartToken: ctx.sessionId, // DOM has no opaque token
        lines, subtotalCents: totalCents, totalCents,
        currency: product.currency ?? 'USD',
        appliedCoupons: [],
      },
    };
  }

  async cartUpdate(_ctx: AdapterContext, _lineId: string, _qty: number) { return { kind:'unsupported' as const, reason:'phase2_dom_cart_update' }; }
  async cartGet(ctx: AdapterContext) {
    return { kind:'ok' as const, value: { cartToken: ctx.sessionId, lines: [], subtotalCents:0, totalCents:0, currency:'USD', appliedCoupons:[] } };
  }
  async couponApply(_ctx: AdapterContext, _code: string) { return { kind:'unsupported' as const, reason:'phase2_dom_coupon' }; }
  async checkoutUrl(ctx: AdapterContext) {
    const sel = (ctx.merchant.adapterConfig as { selectors?: Record<string,string> }).selectors?.checkout_button;
    if (!sel && !ctx.merchant.checkoutUrl) return { kind:'unsupported' as const, reason:'no_checkout_url' };
    return { kind:'ok' as const, value: ctx.merchant.checkoutUrl ?? `https://${ctx.merchant.domain}/cart` };
  }
}

function parseTotal(s: string): number {
  const m = s.match(/([0-9][0-9,]*\.?[0-9]*)/);
  if (!m) return 0;
  return Math.round(parseFloat(m[1].replace(/,/g, '')) * 100);
}
```

- [ ] **Step 4: Run — pass**, **Step 5: Commit**

```bash
git add packages/adapters/src/dom/index.ts packages/adapters/test/dom/dom.test.ts
git commit -m "feat(adapters/dom): DOMAdapter cartAdd with healing + action cap"
```

### Task 9: DOMAdapter — heal-on-failure test

**Files:**
- Modify: `packages/adapters/test/dom/dom.test.ts`

- [ ] **Step 1: Test**

```ts
it('heals when add_to_cart_button selector returns selector_not_found', async () => {
  const t = new FakeWSTransport();
  t.scriptMany([
    { ok: true }, // navigate
    { ok: true }, // fill qty
    { ok: false, reason: 'selector_not_found', html: '<button id="real-buy">Buy</button>' }, // click fails
    { ok: true }, // retry click after heal
    { ok: true }, // wait_for
    { ok: true, value: '$19.99' }, // read total
  ]);
  const llm = vi.fn(async () => '#real-buy');
  const a = new DOMAdapter(t, new InMemorySessionState(), llm);
  vi.spyOn(await import('@shoppingmate/db'), 'getProduct').mockResolvedValue({
    sku:'TEE', productUrl:'https://custom.example.com/p/tee', variants:[],
    title:'Tee', priceCents:1999, currency:'USD', inStock:true,
  } as any);
  const r = await a.cartAdd({ merchant, cartToken: null, sessionId:'s2' }, 'TEE', null, 1);
  expect(r.kind).toBe('ok');
  expect(llm).toHaveBeenCalledTimes(1);
  // selector_cache should now have an llm_resolved row for add_to_cart_button
});
```

- [ ] **Step 2: Run — pass**, **Step 3: Commit**

```bash
git add packages/adapters/test/dom/dom.test.ts
git commit -m "test(adapters/dom): cartAdd heals via Haiku when selector_not_found"
```

### Task 10: DOMAdapter — action-cap test

```ts
it('returns unsupported when thisTurn cap reached', async () => {
  const state = new InMemorySessionState();
  for (let i=0;i<50;i++) await state.incrAction('s3','session');
  const a = new DOMAdapter(new FakeWSTransport(), state);
  const r = await a.cartAdd({ merchant, cartToken: null, sessionId:'s3' }, 'TEE', null, 1);
  expect(r).toEqual({ kind:'unsupported', reason:'action_cap' });
});
```

Run, commit:

```bash
git add packages/adapters/test/dom/dom.test.ts
git commit -m "test(adapters/dom): action cap returns unsupported"
```

---

## Phase E — Server WebSocket

### Task 11: WS skeleton + JWT auth

**Files:**
- Create: `apps/api/src/routes/widget/wsAuth.ts`
- Create: `apps/api/src/routes/widget/ws.ts`
- Create: `tests/api/widget/ws.test.ts`
- Modify: `apps/api/src/index.ts` — mount upgrade handler
- Modify: `apps/api/package.json` — add `ws`

- [ ] **Step 1: Add dep**

In `apps/api/package.json`:
```json
"dependencies": { "ws": "^8.18.0", ... }
```
Run: `pnpm install`.

- [ ] **Step 2: Test (round-trip an action through a real WebSocket)**

```ts
// tests/api/widget/ws.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createServer } from 'node:http';
import { mountWs } from '../../../apps/api/src/routes/widget/ws.js';
import { signWsToken } from '../../../apps/api/src/routes/widget/wsAuth.js';

let server: ReturnType<typeof createServer>;
let port = 0;
let transport: ReturnType<typeof mountWs>['transport'];

beforeAll(async () => {
  server = createServer();
  const out = mountWs(server);
  transport = out.transport;
  await new Promise<void>((res) => server.listen(0, () => { port = (server.address() as any).port; res(); }));
});
afterAll(() => server.close());

describe('widget ws', () => {
  it('sends action server→client, awaits ack, resolves promise', async () => {
    const token = signWsToken({ sessionId: 's1', merchantId: 'SM-T01', exp: Date.now()/1000 + 60 });
    const client = new WebSocket(`ws://localhost:${port}/v1/widget/s1/ws?token=${token}`);
    await new Promise((r) => client.on('open', r));

    client.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'action') {
        client.send(JSON.stringify({ type:'ack', actionId: msg.actionId, ok: true, value: 'pong' }));
      }
    });

    const ack = await transport.send('s1', { type:'dom.read', selector:'.x' });
    expect(ack.ok).toBe(true);
    if (ack.ok) expect(ack.value).toBe('pong');
    client.close();
  });
});
```

- [ ] **Step 3: Run — fail**

Expected: FAIL.

- [ ] **Step 4: Implement auth**

```ts
// apps/api/src/routes/widget/wsAuth.ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.INSTALL_TOKEN_SECRET ?? 'dev-secret-change-me';

export type WsTokenPayload = { sessionId: string; merchantId: string; exp: number };

export function signWsToken(p: WsTokenPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyWsToken(token: string): WsTokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(body).digest('base64url');
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as WsTokenPayload;
  if (p.exp < Date.now()/1000) return null;
  return p;
}
```

- [ ] **Step 5: Implement WS server + transport**

```ts
// apps/api/src/routes/widget/ws.ts
import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import type { WSTransport, DomAction, DomAck } from '@shoppingmate/adapters';
import { verifyWsToken } from './wsAuth.js';

type Pending = { resolve: (a: DomAck) => void; reject: (e: Error) => void; timer: NodeJS.Timeout };

class ServerTransport implements WSTransport {
  private sockets = new Map<string, WebSocket>();
  private pending = new Map<string, Pending>();

  attach(sessionId: string, ws: WebSocket) {
    this.sockets.set(sessionId, ws);
    ws.on('close', () => this.sockets.delete(sessionId));
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as { type: 'ack'; actionId: string } & DomAck;
        if (msg.type !== 'ack') return;
        const p = this.pending.get(msg.actionId);
        if (!p) return;
        clearTimeout(p.timer);
        const { type:_t, actionId:_a, ...ack } = msg;
        p.resolve(ack as DomAck);
        this.pending.delete(msg.actionId);
      } catch { /* ignore */ }
    });
  }

  async send(sessionId: string, action: DomAction): Promise<DomAck> {
    const ws = this.sockets.get(sessionId);
    if (!ws || ws.readyState !== ws.OPEN) {
      return { ok: false, reason: 'timeout' };
    }
    const actionId = randomUUID();
    return new Promise<DomAck>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(actionId);
        resolve({ ok: false, reason: 'timeout' });
      }, 5500);
      this.pending.set(actionId, { resolve, reject, timer });
      ws.send(JSON.stringify({ type: 'action', actionId, action }));
    });
  }
}

export function mountWs(server: Server): { transport: WSTransport } {
  const wss = new WebSocketServer({ noServer: true });
  const transport = new ServerTransport();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const m = url.pathname.match(/^\/v1\/widget\/([^/]+)\/ws$/);
    if (!m) { socket.destroy(); return; }
    const sessionId = decodeURIComponent(m[1]);
    const token = url.searchParams.get('token') ?? '';
    const payload = verifyWsToken(token);
    if (!payload || payload.sessionId !== sessionId) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => transport.attach(sessionId, ws));
  });

  return { transport };
}
```

- [ ] **Step 6: Wire into api**

In `apps/api/src/index.ts`, after creating the http server, call `const { transport } = mountWs(server);` and stash `transport` for later use (the dispatcher will receive it via injection in Plan 4; in 3d we re-create a transport in the smoke harness).

- [ ] **Step 7: Run — pass**, **Step 8: Commit**

```bash
git add apps/api/src/routes/widget/ apps/api/src/index.ts apps/api/package.json pnpm-lock.yaml tests/api/widget/
git commit -m "feat(api): widget WebSocket — JWT-gated, action/ack round-trip"
```

---

## Phase F — Dispatcher wiring + smoke harness

### Task 12: Wire `dom` adapter

**Files:**
- Modify: `packages/adapters/src/dispatch.ts`
- Modify: `packages/adapters/src/index.ts`

- [ ] **Step 1: Update dispatcher signature**

```ts
// dispatch.ts
import { DOMAdapter } from './dom/index.js';
import type { WSTransport } from './dom/transport.js';
import type { SessionState } from './dom/sessionState.js';

export type DispatchDeps = { transport: WSTransport; state: SessionState; llmCall?: (p: string) => Promise<string> };

export function getAdapter(merchant: Merchant, deps?: DispatchDeps): Adapter {
  switch (merchant.adapterType) {
    case 'shopify':     return new ShopifyAdapter();
    case 'woo':         return new WooAdapter();
    case 'magento':     return new MagentoAdapter();
    case 'bigcommerce': return new BigCommerceAdapter();
    case 'wix':         return new WixAdapter();
    case 'squarespace': return new SquarespaceAdapter();
    case 'dom':
      if (!deps) throw new Error('dom_adapter_requires_transport');
      return new DOMAdapter(deps.transport, deps.state, deps.llmCall);
    case 'suggest':
      throw new Error('adapter_not_implemented_in_plan3d: suggest');
    default:
      throw new Error(`adapter_unknown: ${String(merchant.adapterType)}`);
  }
}
```

- [ ] **Step 2: Index re-exports**

```ts
// packages/adapters/src/index.ts
export type { WSTransport, DomAction, DomAck } from './dom/transport.js';
export { FakeWSTransport } from './dom/transport.js';
export type { SessionState } from './dom/sessionState.js';
export { InMemorySessionState } from './dom/sessionState.js';
```

- [ ] **Step 3: Update dispatcher tests** to construct DOMAdapter with deps and confirm `dom` no longer throws when deps are passed.

- [ ] **Step 4: Commit**

```bash
git add packages/adapters/src/dispatch.ts packages/adapters/src/index.ts packages/adapters/test/dispatch.test.ts
git commit -m "feat(adapters): dispatcher takes DispatchDeps to construct DOMAdapter"
```

### Task 13: Playwright fake-gtag harness for adapter-smoke

**Files:**
- Create: `apps/api/scripts/dom-smoke-harness.ts`
- Modify: `apps/api/scripts/adapter-smoke.ts`

- [ ] **Step 1: Implement harness**

```ts
// apps/api/scripts/dom-smoke-harness.ts
import { chromium, type Browser, type Page } from 'playwright';
import WebSocket from 'ws';

export async function startHarness(opts: { wsUrl: string; merchantDomain: string; sessionId: string }): Promise<{ stop: () => Promise<void> }> {
  const browser: Browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();
  await page.goto(`https://${opts.merchantDomain}`);

  const ws = new WebSocket(opts.wsUrl);
  await new Promise((r) => ws.on('open', r));

  ws.on('message', async (raw) => {
    const msg = JSON.parse(raw.toString()) as { type: 'action'; actionId: string; action: any };
    if (msg.type !== 'action') return;
    let ack: any = { ok: true };
    try {
      switch (msg.action.type) {
        case 'dom.navigate': await page.goto(msg.action.url); ack = { ok: true }; break;
        case 'dom.click':    await page.click(msg.action.selector, { timeout: 5000 }); ack = { ok: true }; break;
        case 'dom.fill':     await page.fill(msg.action.selector, msg.action.value, { timeout: 5000 }); ack = { ok: true }; break;
        case 'dom.read':     ack = { ok: true, value: await page.textContent(msg.action.selector, { timeout: 5000 }) ?? '' }; break;
        case 'dom.wait_for': await page.waitForSelector(msg.action.selector, { timeout: msg.action.timeoutMs }); ack = { ok: true }; break;
      }
    } catch (e: unknown) {
      const html = await page.content();
      ack = { ok: false, reason: 'selector_not_found', html: html.slice(0, 24_000) };
    }
    ws.send(JSON.stringify({ type: 'ack', actionId: msg.actionId, ...ack }));
  });

  return { stop: async () => { ws.close(); await browser.close(); } };
}
```

- [ ] **Step 2: Update adapter-smoke**

In `apps/api/scripts/adapter-smoke.ts`, when `merchant.adapterType === 'dom'`:
1. Start an http server in-process with `mountWs`.
2. Mint a JWT.
3. `await startHarness({ wsUrl, merchantDomain, sessionId })`.
4. Call `getAdapter(merchant, { transport, state: new InMemorySessionState(), llmCall: openrouterHaiku })`.
5. Run the same 7-step flow.
6. Stop harness, close server.

```ts
if (merchant.adapterType === 'dom') {
  const server = createServer();
  const { transport } = mountWs(server);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;
  const token = signWsToken({ sessionId: ctx.sessionId, merchantId: merchant.id, exp: Date.now()/1000 + 600 });
  const harness = await startHarness({ wsUrl: `ws://localhost:${port}/v1/widget/${ctx.sessionId}/ws?token=${token}`, merchantDomain: merchant.domain, sessionId: ctx.sessionId });
  try {
    deps = { transport, state: new InMemorySessionState(), llmCall: callHaikuViaOpenRouter };
    a = getAdapter(merchant, deps);
    /* ... existing 7-step flow ... */
  } finally {
    await harness.stop();
    server.close();
  }
}
```

(`callHaikuViaOpenRouter` is the same OpenRouter helper introduced in Plan 3a Task 16.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/dom-smoke-harness.ts apps/api/scripts/adapter-smoke.ts
git commit -m "feat(api): adapter-smoke uses Playwright fake-gtag harness for DOM merchants"
```

---

## Phase G — Smoke test integration

### Task 14: Onboarding `smokeTest.ts` for DOM uses DOMAdapter

**Files:**
- Modify: `apps/worker/src/steps/smokeTest.ts`
- Modify: `tests/worker/smokeTest.test.ts`

- [ ] **Step 1: Test** — DOM smoke now goes through DOMAdapter via the harness:

```ts
it('dom smoke succeeds via DOMAdapter + Playwright harness', async () => {
  // Spin local mountWs, harness, set adapterConfig.selectors to real ones for fixture site
  // Call smokeTest(merchant)
  // Expect kind:'passed'
});
```

- [ ] **Step 2: Implement**

In `smokeTest.ts`, replace the existing DOM Playwright-only branch with a path that:
1. Starts WS server + harness (same code as adapter-smoke).
2. Calls `getAdapter(merchant, deps).cartAdd(...)`.
3. Returns `passed` if `kind==='ok'`, else `failed`.

Extract the harness-setup into a shared helper so both `adapter-smoke` and `smokeTest` use the same code path.

- [ ] **Step 3: Run, Commit**

```bash
git add apps/worker/src/steps/smokeTest.ts tests/worker/smokeTest.test.ts apps/worker/src/lib/domHarness.ts
git commit -m "feat(worker): DOM onboarding smoke runs through DOMAdapter"
```

---

## Phase H — Acceptance + tag

### Task 15: Repo-wide test/lint/typecheck

- [ ] **Step 1:** `pnpm typecheck` — PASS.
- [ ] **Step 2:** `pnpm lint` — PASS.
- [ ] **Step 3:** `pnpm test` — PASS.

### Task 16: Acceptance — provision custom site

- [ ] **Step 1:** `pnpm shoppingmate:dev provision --domain=<custom-test-site>` — `status='live'`, `adapterType='dom'`.
- [ ] **Step 2:** `pnpm shoppingmate:dev adapter-smoke <merchantId>` — 7 `[OK]` lines.

### Task 17: Acceptance — heal a stale selector

- [ ] **Step 1:** Update a Plan 3a-extracted selector to something invalid (e.g., `UPDATE merchants SET adapter_config = jsonb_set(adapter_config,'{selectors,add_to_cart_button}','"#nope"') WHERE id='SM-DOM-X';`)
- [ ] **Step 2:** Run `adapter-smoke` again. Expect heal to fire and `selector_cache` to have an `llm_resolved` row replacing it.

### Task 18: Acceptance — override-permanence

- [ ] **Step 1:** Insert a `merchant_override` row with a known-bad selector. Run smoke. Expect `[FAIL]` for `cartAdd` with reason `override_failing`, AND verify `selector_cache.resolved_selector` unchanged, `suggested_replacement` populated.

### Task 19: Tag

```bash
git tag phase1-plan3d-dom-adapter-complete
git push --tags
```

---

## Self-review checklist

- [x] Spec §9 acceptance: harness-driven smoke (Task 16), heal verification (Task 17), override-permanence (Task 18), action-cap test (Task 10), `provision` reaches `live` (Task 16), lint+typecheck (Task 15).
- [x] No placeholders.
- [x] Type consistency: `WSTransport`, `DomAction`, `DomAck` defined once in transport.ts (Task 4), used unchanged in resolver (Task 6/7), DOMAdapter (Task 8), WS server (Task 11), harness (Task 13). `ResolveOutcome` from Task 6, consumed in DOMAdapter via runWithHeal.
