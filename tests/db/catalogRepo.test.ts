import { db, repos, schema } from '@shoppingmate/db';
import { generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

let merchantId: string;

beforeAll(async () => {
  merchantId = generateMerchantId();
  await db.insert(schema.merchants).values({
    id: merchantId,
    domain: 'fts.test',
    allowedDomains: ['fts.test'],
    status: 'live',
    adapterConfig: {},
  });
  await db.insert(schema.products).values([
    {
      merchantId,
      sku: 'a',
      title: 'Linen Beach Pants',
      description: 'Light cotton-linen blend',
      productUrl: 'https://fts.test/p/a',
      source: 'shopify_storefront',
    },
    {
      merchantId,
      sku: 'b',
      title: 'Cotton Tee',
      description: 'Plain cotton',
      productUrl: 'https://fts.test/p/b',
      source: 'shopify_storefront',
    },
    {
      merchantId,
      sku: 'c',
      title: 'Sun Hat',
      description: 'Wide brim, beach-ready',
      productUrl: 'https://fts.test/p/c',
      source: 'shopify_storefront',
    },
  ]);
});

afterAll(async () => {
  await db.delete(schema.products).where(eq(schema.products.merchantId, merchantId));
  await db.delete(schema.merchants).where(eq(schema.merchants.id, merchantId));
});

describe('catalogRepo', () => {
  it('searchProducts ranks title-matches above description-matches', async () => {
    const rows = await repos.catalog.searchProducts(merchantId, 'beach', 10);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0]?.sku).toBe('a'); // title hit ranks A
  });

  it('searchProducts with empty query returns most-recently-indexed', async () => {
    const rows = await repos.catalog.searchProducts(merchantId, '', 2);
    expect(rows).toHaveLength(2);
  });

  it('getProduct returns row by primary key', async () => {
    const p = await repos.catalog.getProduct(merchantId, 'a');
    expect(p?.title).toBe('Linen Beach Pants');
  });

  it('getProduct returns null for unknown sku', async () => {
    const p = await repos.catalog.getProduct(merchantId, 'zzz');
    expect(p).toBeNull();
  });
});
