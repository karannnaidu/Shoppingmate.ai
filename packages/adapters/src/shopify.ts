import type { Adapter } from './types.js';

export class ShopifyAdapter implements Partial<Adapter> {
  readonly kind = 'shopify' as const;
}
