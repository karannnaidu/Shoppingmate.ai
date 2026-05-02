import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult, CartState } from './types.js';
import { formatCookieHeader, parseSetCookie } from './util/cookies.js';

type ShopifyCart = {
  token: string;
  items: Array<{
    key: string;
    sku: string;
    variant_id: number;
    title: string;
    quantity: number;
    price: number;
    line_price: number;
    image: string | null;
  }>;
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
  return {
    cartToken: '',
    lines: [],
    subtotalCents: 0,
    totalCents: 0,
    currency: 'USD',
    appliedCoupons: [],
  };
}

export class ShopifyAdapter implements Adapter {
  readonly kind = 'shopify' as const;

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

  private async fetchCart(
    ctx: AdapterContext,
    cookieJar: Record<string, string>,
  ): Promise<CartState> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/cart.js`, {
      headers: { Cookie: formatCookieHeader(cookieJar) },
    });
    if (!res.ok) throw new Error(`shopify_cart_get_${res.status}`);
    const body = (await res.json()) as ShopifyCart;
    return shopifyCartToState(body, cookieJar.cart ?? '');
  }

  async cartAdd(
    ctx: AdapterContext,
    _sku: string,
    variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const f = ctx.fetch ?? fetch;
    const cookieJar: Record<string, string> = ctx.cartToken ? { cart: ctx.cartToken } : {};
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

  async cartUpdate(): Promise<AdapterResult<CartState>> {
    return { kind: 'unsupported', reason: 'todo' };
  }

  async cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    if (!ctx.cartToken) return { kind: 'ok', value: emptyCart() };
    const value = await this.fetchCart(ctx, { cart: ctx.cartToken });
    return { kind: 'ok', value };
  }

  async couponApply(): Promise<AdapterResult<CartState>> {
    return { kind: 'unsupported', reason: 'todo' };
  }

  async checkoutUrl(): Promise<AdapterResult<string>> {
    return { kind: 'unsupported', reason: 'todo' };
  }
}
