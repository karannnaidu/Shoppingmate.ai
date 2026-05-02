import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult, CartState } from './types.js';

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

  async cartAdd(): Promise<AdapterResult<CartState>> {
    return { kind: 'unsupported', reason: 'todo' };
  }
  async cartUpdate(): Promise<AdapterResult<CartState>> {
    return { kind: 'unsupported', reason: 'todo' };
  }
  async cartGet(): Promise<AdapterResult<CartState>> {
    return { kind: 'unsupported', reason: 'todo' };
  }
  async couponApply(): Promise<AdapterResult<CartState>> {
    return { kind: 'unsupported', reason: 'todo' };
  }
  async checkoutUrl(): Promise<AdapterResult<string>> {
    return { kind: 'unsupported', reason: 'todo' };
  }
}
