# Phase 1 — Plan 3d: DOMAdapter (custom websites + selector_cache runtime)

**Status:** Design
**Date:** 2026-05-02
**Parent spec:** [`2026-04-30-shoppingmate-phase1-design.md`](./2026-04-30-shoppingmate-phase1-design.md) §6.3, §7.3, §7.4
**Prior plans:** 3a (catalog sync + selector extraction + selector_cache schema), 3b (Adapter interface), 3c (Magento/BC/Wix/SQ)

---

## 1. Goal

Make custom-platform merchants (Plan 3a `adapter_type='dom'`) transactable. The DOMAdapter doesn't call HTTP APIs on the merchant — it pushes action sequences over the gtag WebSocket and reads back what gtag observed in the visitor's browser.

Plan 3d delivers:

1. `DOMAdapter` implementing the `Adapter` interface from Plan 3b — translates `cartAdd`/`cartGet`/`couponApply`/`checkoutUrl` into `dom.click` / `dom.fill` / `dom.read` / `dom.wait_for` action sequences.
2. A WebSocket transport contract (`apps/api/src/routes/widget/ws.ts`) for sending actions and awaiting acks.
3. Runtime selector resolver: when a selector returns null or wait-for times out, populate `selector_cache` via Haiku 4.5, retry, then degrade to Suggest if still failing.
4. Override-permanence rule (parent spec §7.4): `source='merchant_override'` rows are never overwritten by the resolver.
5. Per-session caps and safety guards from parent spec §7.3 (50 actions/turn, 200/session, 5 LLM resolutions/session).

After Plan 3d, ~12% of merchants (custom platforms) onboard end-to-end and are transactable as long as their site uses standard DOM patterns.

## 2. Decomposition (parent context)

| Sub | Scope | Status |
|---|---|---|
| 3a | Catalog sync + onboarding-time selector extraction (Sonnet) + selector_cache schema | done |
| 3b | Adapter interface + Shopify + Woo | done |
| 3c | Magento/BigCommerce/Wix/Squarespace | done |
| **3d** | DOMAdapter + selector_cache runtime + Haiku resolver + WS transport contract | **this spec** |
| 3e | SuggestAdapter | next |

## 3. Non-goals (explicit for 3d)

- **No widget runtime / gtag bundle code.** The widget side ships in Plan 5 (gtag bundle). Plan 3d implements the **server side** of the WS contract and tests against a fake gtag harness.
- **No real-time DOM mutation snapshots into LLM.** When healing fires, we send the resolver only the truncated DOM the gtag harness gave us — no live re-render loop.
- **No daily recrawl / Phase 2 healed-selector promotion.** Resolver writes `source='llm_resolved'`; nothing reads those rows back into `merchants.adapter_config`.
- **No alerting on override failures.** When a `merchant_override` selector fails, we set `last_test_passed=false` and write a `suggested_replacement` but emit only a metric. Email/Slack alerts land in Phase 2.
- **No Suggest fallback in 3d.** When DOMAdapter exhausts retries, it returns `AdapterResult.unsupported` so the caller can degrade. The actual Suggest tier is 3e.
- **No closed Shadow DOM / Cloudflare bot challenge handling.** Those are Suggest-only sites by definition.
- **No on-the-fly checkout-URL discovery.** `checkoutUrl` returns whatever onboarding wrote; if absent, return `unsupported`.

## 4. Architecture

```
LLM tool-call: cart.add({ sku, variant, qty })
                       │
                       ▼
            DOMAdapter.cartAdd(ctx, ...)
                       │
                       ▼
   build action sequence from merchants.adapter_config.selectors
                       │
                       ▼
   selectorResolver(merchantId, pageTemplateHash, selectorKey)
     ┌──────────────────────────────────────────┐
     │ 1. selector_cache lookup                 │
     │    if source='merchant_override' &&      │
     │       last_test_passed=false →           │
     │         return DEGRADE_TO_SUGGEST        │
     │ 2. fall through to adapter_config.selectors
     │ 3. on null/timeout from gtag:            │
     │      Haiku 4.5(html, key) → selector     │
     │      write selector_cache(source=        │
     │        'llm_resolved')                   │
     │      retry once                          │
     │ 4. after 3 retries → unsupported         │
     └──────────────────────────────────────────┘
                       │
                       ▼
            wsTransport.send(action)
                       │
                       ▼
   gtag side (Plan 5; faked in Plan 3d tests)
                       │
                       ▼
   ack { ok | error: 'selector_not_found' | 'timeout', html?, screenshotId? }
                       │
                       ▼
            CartState built from ack.read values
```

**Process boundaries:** DOMAdapter lives in `packages/adapters/`. The WebSocket transport lives in `apps/api/`. The Haiku resolver lives in `packages/adapters/src/dom/resolver.ts` so it ships with the adapter (used only here in Phase 1).

## 5. Schema changes

### 5.1 `selector_cache` extension

Plan 3a shipped the table with `merchant_id, page_template_hash, selector_key, resolved_selector, source, locked, last_tested_at, last_test_passed`. Plan 3d adds the columns the parent spec §11.1 listed but Plan 3a deferred:

```sql
ALTER TABLE selector_cache ADD COLUMN override_locked_at timestamptz;     -- when merchant set the override (null for non-overrides)
ALTER TABLE selector_cache ADD COLUMN suggested_replacement text;          -- LLM hint when override failing
ALTER TABLE selector_cache ADD COLUMN alert_sent_at timestamptz;           -- Phase 2 alerter; populated null in 3d
```

### 5.2 `metric_names` registry additions

```ts
domAction                          // tags: { merchantId, action_type, ok }
domActionFailed                    // tags: { merchantId, action_type, reason }
selectorResolverHit                // tags: { merchantId, key, source: 'auto'|'llm_resolved'|'merchant_override' }
selectorResolverMiss               // tags: { merchantId, key, reason: 'null'|'timeout' }
selectorResolverHealed             // tags: { merchantId, key, latency_ms, input_tokens, output_tokens }
selectorResolverGaveUp             // tags: { merchantId, key, retries }
selectorOverrideFailing            // tags: { merchantId, key }   ← when source='merchant_override' and last_test_passed=false
domAdapterDegradedToSuggest        // tags: { merchantId, reason }
domSessionActionCap                // tags: { merchantId, sessionId, cap }
```

### 5.3 No new Redis keys in 3d

Per-session counters (action count, resolver count) live in Redis under `domsession:{sessionId}` with 24h TTL. Plan 3d adds the helper but Plan 4 owns the actual session lifecycle. Schema for the helper:

```jsonc
{
  "actionsThisTurn": 0,
  "actionsThisSession": 0,
  "resolverCallsThisSession": 0,
  "lastTurnAt": "2026-05-02T..."
}
```

## 6. Components

### 6.1 `packages/adapters/src/dom/transport.ts`

Abstract `WSTransport` interface so the adapter is testable without a real WebSocket:

```ts
export type DomAction =
  | { type: 'dom.navigate'; url: string }
  | { type: 'dom.click'; selector: string }
  | { type: 'dom.fill'; selector: string; value: string }
  | { type: 'dom.read'; selector: string }
  | { type: 'dom.wait_for'; selector: string; condition: 'present'|'mutation'; timeoutMs: number }
  | { type: 'dom.snapshot' };

export type DomAck =
  | { ok: true; value?: string; screenshotId?: string }
  | { ok: false; reason: 'selector_not_found'|'timeout'|'navigate_blocked'|'safety_blocked'; html?: string; screenshotId?: string };

export interface WSTransport {
  send(sessionId: string, action: DomAction): Promise<DomAck>;
}
```

In Plan 3d unit tests, a `FakeWSTransport` returns scripted acks. Real WS lives in `apps/api/src/routes/widget/ws.ts` (skeleton in 3d, full pipe in Plan 5 gtag).

### 6.2 `packages/adapters/src/dom/resolver.ts`

```ts
export type ResolveOutcome =
  | { kind: 'use_selector'; selector: string; source: SelectorSource }
  | { kind: 'degrade_to_suggest'; reason: string }
  | { kind: 'gave_up'; reason: string };

export async function resolveSelector(
  ctx: { merchant: Merchant; sessionId: string; pageTemplateHash: string; selectorKey: string; html?: string; },
  options?: { llmCall?: (prompt: string) => Promise<string>; maxLlmPerSession?: number; },
): Promise<ResolveOutcome>;
```

Behavior:
1. SELECT from `selector_cache` by `(merchant, page_template_hash, key)`.
2. If row exists and `source='merchant_override'`:
    - If `last_test_passed=false` → `degrade_to_suggest` (override-permanence rule). Set `suggested_replacement` (call Haiku for hint, store, do NOT apply).
    - Else → `use_selector` with that override.
3. If row exists and `source ∈ {'auto','llm_resolved'}` → `use_selector` with the cached value.
4. Else → fall back to `merchants.adapter_config.selectors[selectorKey]`.
5. If caller reports back the selector failed (separate `markSelectorFailed` call, see §6.3): increment retry counter, call Haiku 4.5 with prompt:

   ```
   You are extracting a CSS selector from this DOM. Return ONLY the selector string, no explanation.
   Selector key: {selectorKey}
   Hint about what to look for: {KEY_HINTS[selectorKey]}
   Truncated HTML:
   {html}
   ```

   Cap input at 8000 tokens (truncate HTML if larger). Cache result in `selector_cache` with `source='llm_resolved'`. Return `use_selector`.
6. After 3 unsuccessful resolutions for the same `(session, key)`: `gave_up` → caller degrades the tool-call.
7. Per-session resolver call cap: 5 (parent spec §7.4). Beyond cap, `gave_up`.

### 6.3 `packages/adapters/src/dom/index.ts` — DOMAdapter

Implements `Adapter` from Plan 3b. Each method:
1. Builds the action sequence from selectors (resolver gates each lookup).
2. For each action: `transport.send(sessionId, action)`. On `ok=false` with `selector_not_found` or `timeout`, call `markSelectorFailed()` and have the resolver heal-and-retry.
3. After 50 actions/turn or 200/session → return `unsupported` with `reason='action_cap'`.

| Method | Action sequence |
|---|---|
| `searchProducts` | Delegates to `catalogRepo.searchProducts(merchant.id, query, limit)` (Plan 3a). No DOM round-trip. |
| `getProduct` | Delegates to `catalogRepo.getProduct(merchant.id, sku)`. |
| `cartAdd` | `[ navigate(productUrl), click(variant_swatch_template), fill(qty_input, qty), click(add_to_cart_button), wait_for(cart_count, mutation), read(cart_page_total) ]`. Build minimal `CartState` from read values. |
| `cartUpdate` | `[ navigate(cart_url), fill(qty_input scoped to lineId, qty), wait_for(cart_page_total, mutation), read(cart_page_total) ]`. |
| `cartGet` | `[ navigate(cart_url), read(cart_page_total), read each line item under known selector pattern ]`. (Phase 2 introduces a structured cart-state read.) |
| `couponApply` | `[ navigate(cart_url), fill(coupon_field, code), click(coupon_apply_button), wait_for(cart_page_total, mutation), read(cart_page_total) ]`. |
| `checkoutUrl` | Returns `merchant.adapterConfig.selectors.checkout_url` if present, else `merchant.checkoutUrl`, else `{kind:'unsupported', reason:'no_checkout_url'}`. No DOM action. |

**Cart token semantics:** DOMAdapter has no opaque cart token — the merchant's cart cookie lives in the visitor's browser. Use `cartToken=session_id` as a no-op placeholder so the `Adapter` interface is satisfied.

### 6.4 `apps/api/src/routes/widget/ws.ts` (skeleton)

Plan 3d ships the WS endpoint shape and message envelope; Plan 5 fills in the visitor-browser side.

- `ws://api.shoppingmate.ai/v1/widget/{sessionId}/ws`
- Inbound (gtag → server): `{ type: 'ack', actionId, ok, value?, reason?, html?, screenshotId? }`, `{ type: 'snapshot', html, screenshotId }`
- Outbound (server → gtag): `{ type: 'action', actionId, action: DomAction }`
- Server keeps `Map<sessionId, WebSocket>` and a `Map<actionId, Deferred<DomAck>>` to await acks. Configurable per-action timeout (default 5s).

Auth: WS upgrade carries `?token=<short-lived JWT signed by api>` minted by `/v1/install` in Plan 2 (extension to existing endpoint — non-breaking, just a new query param).

### 6.5 Override-permanence enforcement

Helper in `selector_cache` repo: `markOverrideFailing(merchantId, hash, key)` flips `last_test_passed=false` and stores a Haiku-suggested replacement but does NOT mutate `resolved_selector`. The resolver checks this state on every call and refuses to auto-heal.

To set an override: not implemented in Phase 1 (no dashboard). The path is in code so Phase 2 can add the dashboard without schema changes.

## 7. Pipeline / wiring changes

- **`packages/adapters/src/dispatch.ts`:** `case 'dom': return new DOMAdapter(transport)` (transport injected by Plan 4 / CLI).
- **`apps/api/src/index.ts`:** mount the WS route.
- **No onboarding changes.** Plan 3a already extracts selectors; 3d uses them at runtime.

## 8. Testing strategy

- **Unit tests** for the resolver: cache hits per source, override-failing path, healing path with mocked LLM, cap exhaustion, override-permanence (verifying `resolved_selector` never gets overwritten).
- **Adapter tests** for DOMAdapter using `FakeWSTransport`: each method's action sequence, partial failures triggering healing, cap exhaustion.
- **Contract test** from 3b extends to 7 adapters.
- **WS skeleton test** with a real WebSocket client and the api app: send a fake ack, server resolves the deferred.
- **Acceptance:** `pnpm shoppingmate:dev adapter-smoke <dom-merchant>` runs against a real custom site using a tiny scripted Playwright harness as the gtag stand-in. The harness lives in `apps/api/scripts/dom-smoke-harness.ts`.

## 9. Acceptance criteria

A Plan 3d build is "done" when:

1. For a real custom website (e.g., a hand-built test site) with `adapter_type='dom'`, `adapter-smoke` walks `searchProducts → getProduct → cartAdd → cartGet → cartUpdate → checkoutUrl` green using the Playwright harness.
2. The resolver heals at least one selector during the run (force a stale `adapter_config.selectors.add_to_cart_button`; resolver replaces with `llm_resolved` and retry succeeds).
3. Override-permanence test passes: row with `source='merchant_override'` + selector that doesn't exist on the page → resolver returns `degrade_to_suggest`, `selector_cache.resolved_selector` unchanged, `suggested_replacement` populated.
4. Action-cap and resolver-cap tests pass.
5. `pnpm shoppingmate:dev provision --domain=<custom-site>` reaches `status='live'` (smoke now goes through DOMAdapter via Plan 3a's smoke handler — DOM smoke is no longer "wait for cart count mutation only" but "DOMAdapter.cartAdd returns ok").
6. Lint + typecheck clean. Tag `phase1-plan3d-dom-adapter-complete`.

## 10. Open questions

- **Mutation-observer semantics in the harness:** Playwright headless can dispatch real events; mutation observer fires correctly. Verified during 3a selector extraction work. No 3d work needed.
- **JWT secret rotation for WS auth:** out of scope for Phase 1; reuse the existing `INSTALL_TOKEN_SECRET` from Plan 2.

---

**Out of scope, restated:** widget bundle (Plan 5), Suggest tier (3e), daily recrawl (Phase 2), override dashboard (Phase 2), email/Slack alerts (Phase 2), structured cart-state read (Phase 2). Reads of catalog stay on Plan 3a's `catalogRepo`.
