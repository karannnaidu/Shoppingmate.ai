import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';

type BCCart = {
  id: string;
  currency: { code: string };
  cartAmount: number;
  baseAmount: number;
  lineItems: {
    physicalItems: Array<{
      id: string;
      productId: number;
      variantId: number;
      sku: string;
      name: string;
      quantity: number;
      listPrice: number;
      extendedListPrice: number;
      imageUrl?: string;
    }>;
  };
  coupons: Array<{ code: string }>;
};

function toState(c: BCCart): CartState {
  const lines: CartLine[] = (c.lineItems?.physicalItems ?? []).map((i) => ({
    lineId: i.id,
    sku: i.sku,
    variantId: String(i.variantId),
    title: i.name,
    qty: i.quantity,
    unitPriceCents: Math.round((i.listPrice ?? 0) * 100),
    lineTotalCents: Math.round((i.extendedListPrice ?? 0) * 100),
    currency: c.currency.code,
    imageUrl: i.imageUrl ?? null,
  }));
  return {
    cartToken: c.id,
    lines,
    subtotalCents: Math.round((c.baseAmount ?? 0) * 100),
    totalCents: Math.round((c.cartAmount ?? 0) * 100),
    currency: c.currency.code,
    appliedCoupons: (c.coupons ?? []).map((x) => x.code),
  };
}

export class BigCommerceAdapter implements Adapter {
  readonly kind = 'bigcommerce' as const;

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

  async cartAdd(
    ctx: AdapterContext,
    _sku: string,
    variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    if (!variantId) return { kind: 'unsupported', reason: 'variant_required' };
    const f = ctx.fetch ?? fetch;
    if (!ctx.cartToken) {
      const res = await f(`https://${ctx.merchant.domain}/api/storefront/carts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lineItems: [{ quantity: qty, variantId: Number(variantId) }],
        }),
      });
      if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
      return { kind: 'ok', value: toState((await res.json()) as BCCart) };
    }
    const res = await f(
      `https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}/items`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          lineItems: [{ quantity: qty, variantId: Number(variantId) }],
        }),
      },
    );
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as BCCart) };
  }

  async cartUpdate(
    ctx: AdapterContext,
    lineId: string,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(
      `https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}/items/${lineId}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lineItem: { quantity: qty } }),
      },
    );
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as BCCart) };
  }

  async cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    if (!ctx.cartToken) {
      return {
        kind: 'ok',
        value: {
          cartToken: '',
          lines: [],
          subtotalCents: 0,
          totalCents: 0,
          currency: 'USD',
          appliedCoupons: [],
        },
      };
    }
    const f = ctx.fetch ?? fetch;
    const res = await f(
      `https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}?include=lineItems.physicalItems.options`,
    );
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as BCCart) };
  }

  async couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>> {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(
      `https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}/coupons`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ couponCode: code }),
      },
    );
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState((await res.json()) as BCCart) };
  }

  async checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>> {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(
      `https://${ctx.merchant.domain}/api/storefront/carts/${ctx.cartToken}/redirect_urls`,
      { method: 'POST' },
    );
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    const body = (await res.json()) as { checkout_url: string };
    return { kind: 'ok', value: body.checkout_url };
  }
}
