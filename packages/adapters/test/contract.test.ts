import { describe, expect, it, vi } from 'vitest';
import { ShopifyAdapter } from '../src/shopify.js';
import type { Adapter } from '../src/types.js';
import { WooAdapter } from '../src/woo.js';

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => []),
  getProduct: vi.fn(async () => null),
}));

const adapters: Adapter[] = [new ShopifyAdapter(), new WooAdapter()];

describe.each(adapters)('Adapter contract — $kind', (a) => {
  it('exposes kind', () => {
    expect(typeof a.kind).toBe('string');
  });
  it('every Adapter method is a function', () => {
    for (const m of [
      'searchProducts',
      'getProduct',
      'cartAdd',
      'cartUpdate',
      'cartGet',
      'couponApply',
      'checkoutUrl',
    ] as const) {
      expect(typeof (a as unknown as Record<string, unknown>)[m]).toBe('function');
    }
  });
});
