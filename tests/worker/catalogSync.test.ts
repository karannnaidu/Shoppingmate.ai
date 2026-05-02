import { db, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { NormalizedProduct } from '../../apps/worker/src/steps/catalogClients/shopify.js';
import { catalogSync } from '../../apps/worker/src/steps/catalogSync.js';

let merchantId: string;

beforeAll(async () => {
  merchantId = generateMerchantId();
  await db.insert(schema.merchants).values({
    id: merchantId,
    domain: 'cs.test',
    allowedDomains: ['cs.test'],
    status: 'onboarding',
    platform: 'shopify',
    adapterType: 'shopify',
    adapterConfig: {},
  });
});

afterAll(async () => {
  await db.delete(schema.products).where(eq(schema.products.merchantId, merchantId));
  await db.delete(schema.merchants).where(eq(schema.merchants.id, merchantId));
});

describe('catalogSync', () => {
  it('writes ok products and marks live (>=80%)', async () => {
    const product: NormalizedProduct = {
      sku: 'a',
      title: 'A',
      description: 'desc',
      imageUrl: null,
      productUrl: 'https://cs.test/products/a',
      variants: [],
      priceCents: 100,
      currency: 'USD',
      inStock: true,
      source: 'shopify_storefront',
    };
    const result = await catalogSync({
      merchantId,
      domain: 'cs.test',
      platform: 'shopify',
      adapterType: 'shopify',
      fetchCatalog: async () => ({ kind: 'ok', products: [product], expected: 1 }),
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.productsCount).toBe(1);
    const rows = await db
      .select()
      .from(schema.products)
      .where(eq(schema.products.merchantId, merchantId));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.source).toBe('shopify_storefront');
  });

  it('returns partial when productsCount/expected < 0.8', async () => {
    const result = await catalogSync({
      merchantId,
      domain: 'cs.test',
      platform: 'shopify',
      adapterType: 'shopify',
      fetchCatalog: async () => ({
        kind: 'ok',
        products: [
          {
            sku: 'b',
            title: 'B',
            description: null,
            imageUrl: null,
            productUrl: 'https://cs.test/products/b',
            variants: [],
            priceCents: null,
            currency: null,
            inStock: null,
            source: 'shopify_storefront',
          },
        ],
        expected: 5,
      }),
    });
    expect(result.kind).toBe('partial');
  });

  it('propagates failed result', async () => {
    const result = await catalogSync({
      merchantId,
      domain: 'cs.test',
      platform: 'shopify',
      adapterType: 'shopify',
      fetchCatalog: async () => ({ kind: 'failed', reason: 'http_503' }),
    });
    expect(result.kind).toBe('failed');
  });

  it.each([
    ['magento' as const, 'magento_rest'],
    ['bigcommerce' as const, 'bigcommerce_storefront'],
    ['wix' as const, 'wix_stores'],
    ['squarespace' as const, 'squarespace_commerce'],
  ])('routes %s adapter to %s source', async (adapterType, source) => {
    await db.delete(schema.products).where(eq(schema.products.merchantId, merchantId));
    const product: NormalizedProduct = {
      sku: `${adapterType}-1`,
      title: 'X',
      description: null,
      imageUrl: null,
      productUrl: `https://cs.test/p/${adapterType}-1`,
      variants: [],
      priceCents: 100,
      currency: 'USD',
      inStock: true,
      source: source as NormalizedProduct['source'],
    };
    const result = await catalogSync({
      merchantId,
      domain: 'cs.test',
      platform: 'custom',
      adapterType,
      fetchCatalog: async () => ({ kind: 'ok', products: [product], expected: 1 }),
    });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') {
      expect(result.source).toBe(source);
    }
  });
});
