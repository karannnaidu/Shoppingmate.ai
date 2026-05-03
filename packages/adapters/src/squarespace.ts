import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';
import { parseSetCookie } from './util/cookies.js';

type SQCart = {
  id: string;
  currency: string;
  subtotal: number;
  total: number;
  items: Array<{
    id: string;
    productId: string;
    variantId: string;
    sku: string;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
    image?: string;
  }>;
  promotions: Array<{ code: string }>;
};

function toState(c: SQCart): CartState {
  const lines: CartLine[] = (c.items ?? []).map((i) => ({
    lineId: i.id,
    sku: i.sku,
    variantId: i.variantId,
    title: i.name,
    qty: i.quantity,
    unitPriceCents: i.price,
    lineTotalCents: i.lineTotal,
    currency: c.currency,
    imageUrl: i.image ?? null,
  }));
  return {
    cartToken: c.id,
    lines,
    subtotalCents: c.subtotal,
    totalCents: c.total,
    currency: c.currency,
    appliedCoupons: (c.promotions ?? []).map((p) => p.code),
  };
}

export class SquarespaceAdapter implements Adapter {
  readonly kind = 'squarespace' as const;

  async searchProducts(
    ctx: AdapterContext,
    query: string,
    limit = 20,
  ): Promise<AdapterResult<Product[]>> {
    return { kind: 'ok', value: await repoSearch(ctx.merchant.id, query, limit) };
  }

  async getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>> {
    return { kind: 'ok', value: await repoGet(ctx.merchant.id, sku) };
  }

  private cookieHeader(ctx: AdapterContext): Record<string, string> {
    return ctx.cartToken ? { Cookie: `cart_id=${ctx.cartToken}` } : {};
  }

  async cartAdd(
    ctx: AdapterContext,
    _sku: string,
    variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
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
    const cookieCartId = jar.cart_id;
    return {
      kind: 'ok',
      value: toState({ ...body, id: cookieCartId ?? body.id }),
    };
  }

  async cartUpdate(
    ctx: AdapterContext,
    lineId: string,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/commerce/v1/cart/items/${lineId}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', ...this.cookieHeader(ctx) },
      body: JSON.stringify({ quantity: qty }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as SQCart) };
  }

  async cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/commerce/v1/cart`, {
      headers: this.cookieHeader(ctx),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as SQCart) };
  }

  async couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/api/commerce/v1/cart/promotions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...this.cookieHeader(ctx) },
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as SQCart) };
  }

  async checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>> {
    return { kind: 'ok', value: `https://${ctx.merchant.domain}/checkout/cart` };
  }
}
