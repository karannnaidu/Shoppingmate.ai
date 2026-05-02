# Phase 1 — Plan 3e: SuggestAdapter (Tier-3 fallback)

**Status:** Design
**Date:** 2026-05-02
**Parent spec:** [`2026-04-30-shoppingmate-phase1-design.md`](./2026-04-30-shoppingmate-phase1-design.md) §7.5
**Prior plans:** 3a (catalog), 3b (Adapter interface), 3c (Magento/BC/Wix/SQ), 3d (DOMAdapter)

---

## 1. Goal

Close out the adapter trilogy with the fallback for the ~3-5% of sites where DOM control is impossible: closed Shadow DOM widgets, Cloudflare bot challenges, sites that block synthetic events.

Plan 3e delivers:

1. `SuggestAdapter` implementing the `Adapter` interface from Plan 3b.
2. Promotion path from Plan 3d: when `DOMAdapter` returns `unsupported` repeatedly during onboarding smoke OR when fingerprint flags a site as Suggest-eligible, set `merchants.adapter_type='suggest'` and rerun smoke against `SuggestAdapter`.
3. UI message contract over the WS transport (`ui.show_message`, `ui.show_product_card`) so the agent can guide the visitor verbally and visually without driving the cart.
4. `adapter-smoke` extension covering the Suggest path.
5. Wiring `getAdapter` so all eight adapter types (`shopify | woo | magento | bigcommerce | wix | squarespace | dom | suggest`) are now implemented.

After Plan 3e, every merchant who passes Plan 3a's safety check ends Phase 1 with a transactable or assist-only adapter. Phase 1 adapter coverage = 100%.

## 2. Decomposition (parent context)

| Sub | Scope | Status |
|---|---|---|
| 3a | Catalog sync + selectors + smoke + selector_cache schema | done |
| 3b | Adapter interface + Shopify + Woo | done |
| 3c | Magento/BC/Wix/Squarespace | done |
| 3d | DOMAdapter + selector_cache runtime + Haiku resolver | done |
| **3e** | SuggestAdapter | **this spec, last in Plan 3** |

## 3. Non-goals (explicit for 3e)

- **No revenue from Suggest sessions.** Suggest doesn't drive transactions; billing for these sessions is per-conversation only (already covered in Plan 1's billing schema).
- **No "human-in-the-loop" handoff.** Suggest does not page a CSR. It just narrates.
- **No screenshot annotation / pointer overlay in 3e.** That's Plan 5+ widget work. Plan 3e ships the message contract; the widget just displays text and product cards.
- **No automatic Suggest-detection at fingerprint time.** Sites become `adapter_type='suggest'` only via the Plan 3d-driven escalation path or explicit `pnpm shoppingmate:dev set-adapter --merchant=<id> --type=suggest`. Cloudflare-bot-detection rules are too brittle for Phase 1.
- **No coupon application.** Suggest can mention a coupon code in the chat but cannot apply it. `couponApply` returns `unsupported`.

## 4. Architecture

```
Tool-call from LLM in Plan 4: cart.add({ sku, variant, qty })
                       │
                       ▼
            getAdapter(merchant) → SuggestAdapter
                       │
                       ▼
   SuggestAdapter.cartAdd(ctx, sku, variantId, qty)
       1. catalogRepo.getProduct(merchant.id, sku)
       2. wsTransport.send(sessionId, {
              type: 'ui.show_message',
              text: 'I found {title} for {price}. Tap "Add to Cart" on
                     the page to grab it — I'll keep helping you shop.'
          })
       3. wsTransport.send(sessionId, {
              type: 'ui.show_product_card',
              product: { title, image, price, productUrl }
          })
       4. return { kind:'ok', value: SUGGEST_CART_STATE_PLACEHOLDER }
                       │
                       ▼
   gtag (Plan 5) renders the message + card; visitor takes the action manually.
```

**The Suggest adapter is a transparent shim** — it never throws `unsupported`, never degrades, never times out. It's the bottom of the fallback ladder.

## 5. Schema changes

None. `merchants.adapter_type='suggest'` is already in the enum.

`metric_names` registry additions:

```ts
suggestMessageSent           // tags: { merchantId, sessionId, action_type: 'cartAdd'|'cartUpdate'|'couponApply' }
suggestProductCardSent       // tags: { merchantId, sessionId }
suggestCartGetEmpty          // tags: { merchantId, sessionId }   ← Suggest never knows the cart contents
adapterPromotedToSuggest     // tags: { merchantId, from_adapter, reason }
```

## 6. Components

### 6.1 `packages/adapters/src/suggest.ts`

```ts
export class SuggestAdapter implements Adapter {
  readonly kind = 'suggest' as const;
  constructor(private transport: WSTransport) {}

  async searchProducts(ctx, query, limit = 20) {
    return { kind:'ok', value: await catalogRepo.searchProducts(ctx.merchant.id, query, limit) };
  }
  async getProduct(ctx, sku) {
    return { kind:'ok', value: await catalogRepo.getProduct(ctx.merchant.id, sku) };
  }
  async cartAdd(ctx, sku, variantId, qty) {
    const p = await catalogRepo.getProduct(ctx.merchant.id, sku);
    if (!p) return { kind:'unsupported', reason:'product_not_in_catalog' };
    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_message',
      text: this.composeAddText(p, qty),
    });
    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_product_card',
      product: { title: p.title, imageUrl: p.imageUrl, priceCents: p.priceCents, currency: p.currency, productUrl: p.productUrl },
    });
    return { kind:'ok', value: SUGGEST_CART_STATE_PLACEHOLDER };
  }
  async cartUpdate(ctx, lineId, qty) { /* show_message + placeholder */ }
  async cartGet(ctx) {
    // Suggest cannot read the visitor's cart. Return empty placeholder so the LLM doesn't loop.
    return { kind:'ok', value: SUGGEST_CART_STATE_EMPTY };
  }
  async couponApply(ctx, code) {
    await this.transport.send(ctx.sessionId, {
      type:'ui.show_message',
      text:`Try entering coupon code ${code} at checkout.`,
    });
    return { kind:'ok', value: SUGGEST_CART_STATE_PLACEHOLDER };
  }
  async checkoutUrl(ctx) {
    return ctx.merchant.checkoutUrl
      ? { kind:'ok', value: ctx.merchant.checkoutUrl }
      : { kind:'unsupported', reason:'no_checkout_url' };
  }
}
```

`SUGGEST_CART_STATE_PLACEHOLDER` is a frozen object with empty lines, zero totals, and a sentinel `cartToken='suggest'`. The LLM sees that and (per Plan 4 prompt) understands the cart isn't observable.

### 6.2 `packages/adapters/src/dom/transport.ts` (extension)

Add UI action types to `DomAction` so the same WS plumbing serves both DOM and Suggest:

```ts
| { type:'ui.show_message'; text: string }
| { type:'ui.show_product_card'; product: { title; imageUrl; priceCents; currency; productUrl } }
```

(These are still routed over the same WS connection; the gtag widget renders them in chat.)

### 6.3 `packages/adapters/src/dispatch.ts` (final extension)

```ts
case 'suggest': return new SuggestAdapter(transport);
```

After 3e, every case in the switch is implemented. The default branch becomes `assertNever(merchant.adapterType)` — exhaustiveness check.

### 6.4 Promotion path

A new helper `apps/worker/src/steps/promoteToSuggest.ts`:

```ts
export async function promoteToSuggest(merchantId: string, reason: string): Promise<void>;
```

Called by:
- `apps/worker/src/steps/smokeTest.ts` when DOMAdapter smoke fails with `reason='action_cap'` or returns `unsupported` for `cartAdd` 3 times in a row.
- The CLI `pnpm shoppingmate:dev set-adapter --merchant=<id> --type=suggest --reason="<text>"`.

Effect: `UPDATE merchants SET adapter_type='suggest', last_indexed_at=now()`, emit `adapterPromotedToSuggest`, then re-run smokeTest (which now uses SuggestAdapter and trivially passes — Suggest's smoke just verifies `searchProducts` returns a non-empty list).

## 7. Pipeline / wiring changes

- **Onboarding handler:** smokeTest gains the auto-promotion branch above. Single new code path, no new step.
- **`apps/api`:** the WS route from 3d already accepts the new `ui.show_message`/`ui.show_product_card` types — no route changes.
- **Plan 4 (future) prompt wiring:** the LLM system prompt needs a paragraph for `adapter_type='suggest'` ("you can recommend; the visitor must click Add to Cart themselves"). Plan 3e ships the prompt fragment as a constant in `packages/adapters/src/suggest.ts:SUGGEST_PROMPT_HINT` so Plan 4 just imports it.

## 8. Testing strategy

- **Unit tests** for `SuggestAdapter` using `FakeWSTransport`: each method's outbound message shape, placeholder state contents, no-product-in-catalog path.
- **Contract test** auto-extends to 8 adapters.
- **Promotion test:** simulated DOM smoke failure → `promoteToSuggest` runs → `merchants.adapter_type='suggest'` → second smoke against SuggestAdapter passes.
- **Acceptance:** `pnpm shoppingmate:dev adapter-smoke <suggest-merchant>` runs the full 7-step flow with the WS harness asserting the `ui.show_*` messages were sent.

## 9. Acceptance criteria

A Plan 3e build is "done" when:

1. `pnpm shoppingmate:dev provision --domain=<some-cloudflare-locked-site>` followed by `pnpm shoppingmate:dev set-adapter --merchant=<id> --type=suggest --reason="cloudflare"` reaches `status='live'` and `adapter_type='suggest'`.
2. Forcing DOM smoke to fail (e.g., temporarily breaking selectors in adapter_config) and re-running onboarding promotes the merchant to Suggest automatically with `metric_events.adapterPromotedToSuggest` recorded.
3. `getAdapter(merchant)` is exhaustive — TypeScript compile fails if a new `AdapterType` is added without a dispatcher branch (verified via `assertNever`).
4. `pnpm shoppingmate:dev adapter-smoke` runs all 7 steps green for a Suggest merchant, with the WS harness capturing the expected `ui.show_message` + `ui.show_product_card` payloads.
5. Contract test green for all 8 adapters.
6. Lint + typecheck clean. Tag `phase1-plan3e-suggest-adapter-complete`. With this tag, **Plan 3 is fully closed** and Phase 1 moves to Plan 4 (voice agent).

## 10. Open questions

- **Voice phrasing for Suggest:** TTS-friendly text like "Tap Add to Cart on the page" needs a per-merchant tone in Plan 4 personas. Plan 3e ships a default phrasing; Plan 4's persona system overrides it.

---

**Out of scope, restated:** human handoff, screenshot pointer overlays, automatic Cloudflare detection, coupon application. Reads still on Plan 3a's `catalogRepo`. Voice prompt integration on Plan 4.
