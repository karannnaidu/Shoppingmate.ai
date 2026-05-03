import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { WSTransport } from './dom/transport.js';
import type { Adapter, AdapterContext, AdapterResult, CartState } from './types.js';

/**
 * Sentinel CartState used by SuggestAdapter — the LLM should treat the cart as
 * unobservable. cartToken='suggest' is the discriminator downstream code can
 * look for to skip cart-aware reasoning loops.
 */
export const SUGGEST_CART_STATE_EMPTY: CartState = Object.freeze({
  cartToken: 'suggest',
  lines: [] as CartState['lines'],
  subtotalCents: 0,
  totalCents: 0,
  currency: 'USD',
  appliedCoupons: [],
});

export const SUGGEST_CART_STATE_PLACEHOLDER: CartState = Object.freeze({
  cartToken: 'suggest',
  lines: [] as CartState['lines'],
  subtotalCents: 0,
  totalCents: 0,
  currency: 'USD',
  appliedCoupons: [],
});

/**
 * Prompt fragment to inject into the voice agent's system prompt when the
 * merchant uses the Suggest adapter, so the model knows to recommend rather
 * than transact.
 */
export const SUGGEST_PROMPT_HINT = `
You are running on a site where you cannot drive the cart programmatically.
You can recommend products and show product cards, but the visitor must
click "Add to Cart" themselves on the page. The "cart" tool returns an
empty placeholder — do not loop trying to read it.
`.trim();

/**
 * Tier-3 adapter: cart-less fallback for sites where automation fails.
 * Emits ui.show_message / ui.show_product_card actions instead of mutating a
 * real cart. Used when DOMAdapter exhausts caps or is forced via the
 * `set-adapter` CLI.
 *
 * Plan 4 alignment (2026-05-04): when the agent runtime constructs
 * DispatchDeps, it passes a NoOpWSTransport so the legacy
 * `ui.show_message` / `ui.show_product_card` calls become silent. The
 * runtime emits canonical `cards` events directly from this adapter's
 * `searchProducts` / `getProduct` results — Sonnet does not "see" any
 * UI events, only the JSON product list.
 *
 * Plan 3e tests still pass because they construct the adapter with
 * FakeWSTransport and assert on the calls it captures.
 */
export class SuggestAdapter implements Adapter {
  readonly kind = 'suggest' as const;

  constructor(private transport: WSTransport) {}

  async searchProducts(
    ctx: AdapterContext,
    query: string,
    limit = 20,
  ): Promise<AdapterResult<Product[]>> {
    const value = await repoSearch(ctx.merchant.id, query, limit);
    return { kind: 'ok', value };
  }

  async getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>> {
    const value = await repoGet(ctx.merchant.id, sku);
    return { kind: 'ok', value };
  }

  async cartAdd(
    ctx: AdapterContext,
    sku: string,
    _variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const p = await repoGet(ctx.merchant.id, sku);
    if (!p) return { kind: 'unsupported', reason: 'product_not_in_catalog' };

    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_message',
      text: this.composeAddText(p, qty),
    });

    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_product_card',
      product: {
        title: p.title,
        imageUrl: p.imageUrl,
        priceCents: p.priceCents ?? 0,
        currency: p.currency ?? 'USD',
        productUrl: p.productUrl,
      },
    });

    return { kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER };
  }

  async cartUpdate(
    ctx: AdapterContext,
    _lineId: string,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_message',
      text: `To set the quantity to ${qty}, please update it on the page — I can't change carts directly here.`,
    });
    return { kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER };
  }

  async cartGet(_ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    return { kind: 'ok', value: SUGGEST_CART_STATE_EMPTY };
  }

  async couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>> {
    await this.transport.send(ctx.sessionId, {
      type: 'ui.show_message',
      text: `Try entering coupon code ${code} at checkout.`,
    });
    return { kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER };
  }

  async checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>> {
    const url = (ctx.merchant as { checkoutUrl?: string | null }).checkoutUrl ?? null;
    return url ? { kind: 'ok', value: url } : { kind: 'unsupported', reason: 'no_checkout_url' };
  }

  private composeAddText(
    p: { title: string; priceCents: number | null; currency: string | null },
    qty: number,
  ): string {
    const cents = p.priceCents ?? 0;
    const currency = p.currency ?? 'USD';
    const price = (cents / 100).toFixed(2);
    const qtyText = qty > 1 ? `${qty} \u00d7 ` : '';
    return `I found ${qtyText}${p.title} for ${currency} ${price}. Tap "Add to Cart" on the page to grab it — I'll keep helping you shop.`;
  }
}
