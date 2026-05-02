import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from './types.js';

type MagentoTotalItem = {
  item_id: number;
  sku: string;
  name: string;
  qty: number;
  price: number;
  row_total: number;
};

type MagentoTotals = {
  grand_total: number;
  subtotal: number;
  base_currency_code: string;
  items: MagentoTotalItem[];
  coupon_code: string | null;
};

function toState(t: MagentoTotals, token: string): CartState {
  const lines: CartLine[] = (t.items ?? []).map((i) => ({
    lineId: String(i.item_id),
    sku: i.sku,
    variantId: null,
    title: i.name,
    qty: i.qty,
    unitPriceCents: Math.round((i.price ?? 0) * 100),
    lineTotalCents: Math.round((i.row_total ?? 0) * 100),
    currency: t.base_currency_code,
    imageUrl: null,
  }));
  return {
    cartToken: token,
    lines,
    subtotalCents: Math.round((t.subtotal ?? 0) * 100),
    totalCents: Math.round((t.grand_total ?? 0) * 100),
    currency: t.base_currency_code,
    appliedCoupons: t.coupon_code ? [t.coupon_code] : [],
  };
}

const EMPTY_TOTALS: MagentoTotals = {
  grand_total: 0,
  subtotal: 0,
  base_currency_code: 'USD',
  items: [],
  coupon_code: null,
};

export class MagentoAdapter implements Adapter {
  readonly kind = 'magento' as const;

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

  private async ensureCart(ctx: AdapterContext): Promise<string> {
    if (ctx.cartToken) return ctx.cartToken;
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/rest/V1/guest-carts`, { method: 'POST' });
    if (!res.ok) throw new Error(`magento_create_cart_${res.status}`);
    return (await res.json()) as string;
  }

  private async totals(ctx: AdapterContext, token: string): Promise<MagentoTotals> {
    const f = ctx.fetch ?? fetch;
    const res = await f(`https://${ctx.merchant.domain}/rest/V1/guest-carts/${token}/totals`);
    if (!res.ok) throw new Error(`magento_totals_${res.status}`);
    return (await res.json()) as MagentoTotals;
  }

  async cartAdd(
    ctx: AdapterContext,
    sku: string,
    _variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const f = ctx.fetch ?? fetch;
    const token = await this.ensureCart(ctx);
    const res = await f(`https://${ctx.merchant.domain}/rest/V1/guest-carts/${token}/items`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cartItem: { sku, qty, quote_id: token } }),
    });
    if (!res.ok) {
      return { kind: 'platform_error', status: res.status, body: await res.text() };
    }
    return { kind: 'ok', value: toState(await this.totals(ctx, token), token) };
  }

  async cartUpdate(
    ctx: AdapterContext,
    lineId: string,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const token = ctx.cartToken;
    if (!token) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(
      `https://${ctx.merchant.domain}/rest/V1/guest-carts/${token}/items/${lineId}`,
      {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cartItem: { qty, quote_id: token } }),
      },
    );
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState(await this.totals(ctx, token), token) };
  }

  async cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    if (!ctx.cartToken) return { kind: 'ok', value: toState(EMPTY_TOTALS, '') };
    return { kind: 'ok', value: toState(await this.totals(ctx, ctx.cartToken), ctx.cartToken) };
  }

  async couponApply(ctx: AdapterContext, code: string): Promise<AdapterResult<CartState>> {
    const token = ctx.cartToken;
    if (!token) return { kind: 'unsupported', reason: 'no_cart_token' };
    const f = ctx.fetch ?? fetch;
    const res = await f(
      `https://${ctx.merchant.domain}/rest/V1/guest-carts/${token}/coupons/${encodeURIComponent(code)}`,
      { method: 'PUT' },
    );
    if (!res.ok) return { kind: 'platform_error', status: res.status, body: await res.text() };
    return { kind: 'ok', value: toState(await this.totals(ctx, token), token) };
  }

  async checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>> {
    if (!ctx.cartToken) return { kind: 'unsupported', reason: 'no_cart_token' };
    return {
      kind: 'ok',
      value: `https://${ctx.merchant.domain}/checkout/?guest-cart-id=${ctx.cartToken}`,
    };
  }
}
