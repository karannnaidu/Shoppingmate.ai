import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';

type WixCart = {
  cart: {
    id: string;
    currency: string;
    subtotal: number;
    total: number;
    lineItems: Array<{
      id: string;
      catalogReference: { catalogItemId: string };
      productName: { original: string };
      quantity: number;
      price: number;
      rowTotal: number;
      image?: string;
    }>;
    appliedDiscounts: Array<{ code: string }>;
  };
};

function toState(c: WixCart['cart']): CartState {
  const lines: CartLine[] = (c.lineItems ?? []).map((i) => ({
    lineId: i.id,
    sku: i.catalogReference.catalogItemId,
    variantId: null,
    title: i.productName.original,
    qty: i.quantity,
    unitPriceCents: Math.round((i.price ?? 0) * 100),
    lineTotalCents: Math.round((i.rowTotal ?? 0) * 100),
    currency: c.currency,
    imageUrl: i.image ?? null,
  }));
  return {
    cartToken: c.id,
    lines,
    subtotalCents: Math.round((c.subtotal ?? 0) * 100),
    totalCents: Math.round((c.total ?? 0) * 100),
    currency: c.currency,
    appliedCoupons: (c.appliedDiscounts ?? []).map((d) => d.code),
  };
}

const BASE = '/_api/wix-ecommerce-storefront-web/api/storefront/cart';

export class WixAdapter implements Adapter {
  readonly kind = 'wix' as const;

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

  async cartAdd(
    ctx: AdapterContext,
    _sku: string,
    variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    if (!variantId) return { kind: 'unsupported', reason: 'catalog_item_id_required' };
    const res = await this.post(ctx, `${BASE}/lines/add`, {
      lineItems: [{ catalogReference: { catalogItemId: variantId }, quantity: qty }],
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as WixCart;
    return { kind: 'ok', value: toState(body.cart) };
  }

  async cartUpdate(
    ctx: AdapterContext,
    lineId: string,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const res = await this.post(ctx, `${BASE}/lines/update`, {
      lineItems: [{ id: lineId, quantity: qty }],
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as WixCart;
    return { kind: 'ok', value: toState(body.cart) };
  }

  async cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}${BASE}`, {
      headers: ctx.cartToken ? { Cookie: `_wixCIDX=${ctx.cartToken}` } : {},
    });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as WixCart;
    return { kind: 'ok', value: toState(body.cart) };
  }

  async couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>> {
    const res = await this.post(ctx, `${BASE}/coupon`, { couponCode: code });
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as WixCart;
    return { kind: 'ok', value: toState(body.cart) };
  }

  async checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>> {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    const res = await this.post(ctx, `${BASE}/createCheckout`, {});
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as { checkoutId: string };
    return { kind: 'ok', value: `https://${ctx.merchant.domain}/checkout?checkoutId=${body.checkoutId}` };
  }
}
