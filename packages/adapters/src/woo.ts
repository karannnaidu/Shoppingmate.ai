import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';

type WooCart = {
  items: Array<{
    key: string;
    id: number;
    sku: string;
    name: string;
    quantity: number;
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

  private async authedFetch(
    ctx: AdapterContext,
    path: string,
    init: RequestInit & { retry?: boolean } = {},
  ): Promise<Response> {
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

  async cartAdd(
    ctx: AdapterContext,
    sku: string,
    variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const product = await repoGet(ctx.merchant.id, sku);
    const variants = product?.variants as
      | Array<{ id: string; options: Record<string, string> }>
      | undefined;
    const variation = variants?.find((v) => v.id === variantId)?.options;
    const variationArr = variation
      ? Object.entries(variation).map(([attribute, value]) => ({ attribute, value }))
      : [];

    const res = await this.authedFetch(ctx, '/wp-json/wc/store/v1/cart/add-item', {
      method: 'POST',
      body: JSON.stringify({ id: Number(variantId), quantity: qty, variation: variationArr }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const token = res.headers.get('cart-token') ?? ctx.cartToken ?? '';
    return { kind: 'ok', value: wooToState((await res.json()) as WooCart, token) };
  }

  async cartUpdate(
    ctx: AdapterContext,
    lineId: string,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const res = await this.authedFetch(ctx, '/wp-json/wc/store/v1/cart/update-item', {
      method: 'POST',
      body: JSON.stringify({ key: lineId, quantity: qty }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const token = res.headers.get('cart-token') ?? ctx.cartToken ?? '';
    return { kind: 'ok', value: wooToState((await res.json()) as WooCart, token) };
  }

  async cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    const res = await this.authedFetch(ctx, '/wp-json/wc/store/v1/cart');
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const token = res.headers.get('cart-token') ?? ctx.cartToken ?? '';
    return { kind: 'ok', value: wooToState((await res.json()) as WooCart, token) };
  }

  async couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>> {
    const res = await this.authedFetch(ctx, '/wp-json/wc/store/v1/cart/apply-coupon', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const token = res.headers.get('cart-token') ?? ctx.cartToken ?? '';
    return { kind: 'ok', value: wooToState((await res.json()) as WooCart, token) };
  }

  async checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>> {
    const url = ctx.merchant.checkoutUrl ?? `https://${ctx.merchant.domain}/checkout/`;
    return { kind: 'ok', value: url };
  }
}
