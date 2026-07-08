import type { Product } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { readVariants, resolveVariant, shapeProductForModel, singleVariantId } from './variant.js';

// Build a product row shaped like the synced catalog writes it. `variants` is a
// jsonb column typed as unknown, so tests pass plain arrays through `as Product`.
function product(overrides: Partial<Product> & { variants?: unknown }): Product {
  return {
    merchantId: 'm',
    sku: 'the-handle',
    title: 'A Product',
    description: 'desc',
    imageUrl: 'https://x.test/a.png',
    productUrl: 'https://x.test/products/the-handle',
    priceCents: 1999,
    currency: 'USD',
    inStock: true,
    source: 'shopify_storefront',
    ...overrides,
  } as unknown as Product;
}

const singleVariant = [{ id: '111', sku: 'A-1', priceCents: 1999, inStock: true, options: {} }];
const multiVariant = [
  { id: '201', sku: 'TEE-S-BLU', priceCents: 2500, inStock: true, options: { option1: 'Small', option2: 'Blue' } },
  { id: '202', sku: 'TEE-L-RED', priceCents: 2500, inStock: true, options: { option1: 'Large', option2: 'Red' } },
];

describe('readVariants', () => {
  it('reads a well-formed variants array', () => {
    expect(readVariants(product({ variants: singleVariant }))).toHaveLength(1);
  });
  it('returns [] for null / non-array / garbage', () => {
    expect(readVariants(product({ variants: null }))).toEqual([]);
    expect(readVariants(product({ variants: 'nope' as unknown }))).toEqual([]);
    expect(readVariants(product({ variants: [{ nope: true }] }))).toEqual([]);
  });
});

describe('singleVariantId', () => {
  it('returns the id when exactly one variant', () => {
    expect(singleVariantId(product({ variants: singleVariant }))).toBe('111');
  });
  it('returns null for multi-variant or no variants', () => {
    expect(singleVariantId(product({ variants: multiVariant }))).toBeNull();
    expect(singleVariantId(product({ variants: null }))).toBeNull();
  });
});

describe('resolveVariant', () => {
  it('single-variant → that id regardless of ref', () => {
    expect(resolveVariant(product({ variants: singleVariant }), 'anything')).toBe('111');
  });
  it('no variants → null', () => {
    expect(resolveVariant(product({ variants: null }), 'x')).toBeNull();
  });
  it('multi-variant: exact variant-id ref wins', () => {
    expect(resolveVariant(product({ variants: multiVariant }), '202')).toBe('202');
  });
  it('multi-variant: sku ref (case-insensitive)', () => {
    expect(resolveVariant(product({ variants: multiVariant }), 'tee-l-red')).toBe('202');
  });
  it('multi-variant: option value ref ("Large")', () => {
    expect(resolveVariant(product({ variants: multiVariant }), 'Large')).toBe('202');
  });
  it('multi-variant: loose option contains ("small tee")', () => {
    expect(resolveVariant(product({ variants: multiVariant }), 'small tee')).toBe('201');
  });
  it('multi-variant with no usable hint → first variant', () => {
    expect(resolveVariant(product({ variants: multiVariant }), '')).toBe('201');
  });
});

describe('shapeProductForModel', () => {
  it('single-variant: sets top-level variantId, no variants list', () => {
    const shaped = shapeProductForModel(product({ variants: singleVariant }));
    expect(shaped.variantId).toBe('111');
    expect(shaped.variants).toBeUndefined();
    expect(shaped.sku).toBe('the-handle');
    expect(shaped.priceCents).toBe(1999);
  });
  it('multi-variant: variantId null + variants list to choose from', () => {
    const shaped = shapeProductForModel(product({ variants: multiVariant }));
    expect(shaped.variantId).toBeNull();
    expect(Array.isArray(shaped.variants)).toBe(true);
    expect((shaped.variants as unknown[]).length).toBe(2);
    expect((shaped.variants as Array<{ variantId: string }>)[1].variantId).toBe('202');
  });
  it('no variants (Calmosis / DOM row): variantId null but sku preserved', () => {
    const shaped = shapeProductForModel(product({ variants: null, sku: 'green-mantra' }));
    expect(shaped.variantId).toBeNull();
    expect(shaped.variants).toBeUndefined();
    expect(shaped.sku).toBe('green-mantra');
  });
});
