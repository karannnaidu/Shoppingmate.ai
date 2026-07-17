import { describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({
  db: {},
  schema: {},
  metricNames: {
    conversionIngested: 'conversion.ingested',
    conversionMissNoVisitor: 'conversion.miss.no_visitor_in_window',
    conversionMissNoRecommendation: 'conversion.miss.no_recommendation_match',
    conversionMissMerchantUnknown: 'conversion.miss.merchant_unknown',
    conversionMissAuthFailed: 'conversion.miss.auth_failed',
    conversionMissDuplicate: 'conversion.miss.duplicate',
  },
}));
vi.mock('@shoppingmate/jobs', () => ({ siteGraphCrawlQueue: { add: vi.fn() }, siteGraphExtractQueue: {} }));

import {
  handleShopifyProductWebhook,
  handleShopifyOrderWebhook,
  handleShopifyCatalogUpsert,
  handleShopifyCatalogDelete,
  shopifyProductPayloadToRow,
} from './shopify.js';

describe('shopifyProductPayloadToRow()', () => {
  it('maps a product webhook payload to a catalog row with numeric variant ids', () => {
    const row = shopifyProductPayloadToRow(
      {
        id: 55,
        title: 'Tee',
        handle: 'tee',
        body_html: '<p>soft</p>',
        images: [{ src: 'https://cdn/t.jpg' }],
        variants: [
          { id: 9001, sku: 'TEE-S', price: '20.00', available: true, option1: 'S' },
          { id: 9002, sku: 'TEE-L', price: '22.00', available: false, option1: 'L' },
        ],
      },
      'shop.myshopify.com',
      'm1',
    );
    expect(row).toMatchObject({
      merchantId: 'm1',
      sku: 'tee',
      title: 'Tee',
      description: 'soft',
      imageUrl: 'https://cdn/t.jpg',
      productUrl: 'https://shop.myshopify.com/products/tee',
      priceCents: 2000,
      inStock: true,
      source: 'shopify_storefront',
    });
    expect(row?.variants).toEqual([
      { id: '9001', sku: 'TEE-S', priceCents: 2000, inStock: true, options: { option1: 'S' } },
      { id: '9002', sku: 'TEE-L', priceCents: 2200, inStock: false, options: { option1: 'L' } },
    ]);
  });

  it('returns null when the payload has no handle', () => {
    expect(shopifyProductPayloadToRow({ id: 1, title: 'x' }, 'shop.myshopify.com', 'm1')).toBeNull();
  });
});

describe('handleShopifyCatalogUpsert', () => {
  const body = JSON.stringify({
    id: 55,
    title: 'Tee',
    handle: 'tee',
    variants: [{ id: 9001, sku: 'TEE-S', price: '20.00', available: true }],
  });

  it('verifies signature and upserts the mapped row', async () => {
    const upsertProduct = vi.fn().mockResolvedValue(undefined);
    const out = await handleShopifyCatalogUpsert({
      rawBody: body,
      hmacHeader: 'abc',
      shopDomain: 'shop.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      upsertProduct,
    });
    expect(out.status).toBe(200);
    expect(upsertProduct).toHaveBeenCalledOnce();
    const [row] = upsertProduct.mock.calls[0]!;
    expect(row).toMatchObject({ merchantId: 'm1', sku: 'tee', priceCents: 2000 });
  });

  it('rejects bad signature with 401 and does not upsert', async () => {
    const upsertProduct = vi.fn();
    const out = await handleShopifyCatalogUpsert({
      rawBody: body,
      hmacHeader: 'bad',
      shopDomain: 'shop.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => false,
      upsertProduct,
    });
    expect(out.status).toBe(401);
    expect(upsertProduct).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown shop', async () => {
    const upsertProduct = vi.fn();
    const out = await handleShopifyCatalogUpsert({
      rawBody: body,
      hmacHeader: 'abc',
      shopDomain: 'nope.myshopify.com',
      lookupMerchantId: async () => null,
      verifyHmac: () => true,
      upsertProduct,
    });
    expect(out.status).toBe(404);
    expect(upsertProduct).not.toHaveBeenCalled();
  });

  it('returns 200 without upsert when payload has no handle', async () => {
    const upsertProduct = vi.fn();
    const out = await handleShopifyCatalogUpsert({
      rawBody: JSON.stringify({ id: 1 }),
      hmacHeader: 'abc',
      shopDomain: 'shop.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      upsertProduct,
    });
    expect(out.status).toBe(200);
    expect(upsertProduct).not.toHaveBeenCalled();
  });
});

describe('handleShopifyCatalogDelete', () => {
  it('verifies signature and deletes by merchant + handle', async () => {
    const deleteProduct = vi.fn().mockResolvedValue(undefined);
    const out = await handleShopifyCatalogDelete({
      rawBody: JSON.stringify({ id: 55, handle: 'tee' }),
      hmacHeader: 'abc',
      shopDomain: 'shop.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      deleteProduct,
    });
    expect(out.status).toBe(200);
    expect(deleteProduct).toHaveBeenCalledWith('m1', 'tee');
  });

  it('rejects bad signature with 401', async () => {
    const deleteProduct = vi.fn();
    const out = await handleShopifyCatalogDelete({
      rawBody: JSON.stringify({ id: 55, handle: 'tee' }),
      hmacHeader: 'bad',
      shopDomain: 'shop.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => false,
      deleteProduct,
    });
    expect(out.status).toBe(401);
    expect(deleteProduct).not.toHaveBeenCalled();
  });
});

describe('Shopify product webhook', () => {
  it('verifies signature and enqueues narrow re-extract', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const verify = vi.fn().mockReturnValue(true);
    const out = await handleShopifyProductWebhook({
      rawBody: '{"id":1,"handle":"kibble-x"}',
      hmacHeader: 'abc',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: verify,
      enqueueExtract: enqueue,
    });
    expect(verify).toHaveBeenCalled();
    expect(enqueue).toHaveBeenCalledWith({ merchantId: 'm1', urls: ['https://x.myshopify.com/products/kibble-x'] });
    expect(out.status).toBe(200);
  });

  it('rejects bad signature with 401', async () => {
    const out = await handleShopifyProductWebhook({
      rawBody: '{}',
      hmacHeader: 'bad',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => false,
      enqueueExtract: vi.fn(),
    });
    expect(out.status).toBe(401);
  });
});

describe('Shopify orders/create webhook', () => {
  const validBody = JSON.stringify({
    id: 12345,
    order_number: 'ORD-1',
    total_price: '50.00',
    currency: 'USD',
    created_at: '2026-05-27T10:00:00Z',
    line_items: [{ sku: 'SKU-A', quantity: 1, price: '50.00' }],
    note_attributes: [{ name: 'sm_visitor_id', value: 'v1' }],
  });

  it('verifies signature and calls attribute() with extracted visitor id', async () => {
    const attribute = vi.fn().mockResolvedValue({ wrote: ['influenced'], skipped: [], missReason: null });
    const out = await handleShopifyOrderWebhook({
      rawBody: validBody,
      hmacHeader: 'abc',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn().mockResolvedValue(undefined),
    });
    expect(out.status).toBe(200);
    expect(attribute).toHaveBeenCalledOnce();
    const [order] = attribute.mock.calls[0]!;
    expect(order.merchantId).toBe('m1');
    expect(order.orderId).toBe('12345');
    expect(order.visitorId).toBe('v1');
    expect(order.matchSource).toBe('shopify_webhook');
    expect(order.totalCents).toBe(5000);
    expect(order.lineItems).toEqual([{ sku: 'SKU-A', quantity: 1, priceCents: 5000 }]);
  });

  it('rejects bad signature with 401', async () => {
    const recordMetric = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: validBody, hmacHeader: 'bad', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => false,
      attribute: vi.fn(),
      recordMetric,
    });
    expect(out.status).toBe(401);
    expect(recordMetric).not.toHaveBeenCalled();
  });

  it('returns 200 with no_visitor_id when sm_visitor_id missing', async () => {
    const body = JSON.stringify({ id: 1, total_price: '5.00', currency: 'USD', created_at: '2026-05-27T10:00:00Z', line_items: [] });
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn().mockResolvedValue(undefined),
    });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      ok: true,
      wrote: [],
      skipped: ['no_visitor_id'],
      missReason: null,
    });
    expect(attribute).not.toHaveBeenCalled();
  });

  it('returns 500 when attribute() throws', async () => {
    const out = await handleShopifyOrderWebhook({
      rawBody: validBody,
      hmacHeader: 'abc',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute: vi.fn().mockRejectedValue(new Error('db down')),
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(500);
    expect(out.body?.error).toBe('internal');
  });

  it('returns idempotent 200 with skipped[] when attribute reports duplicate', async () => {
    const attribute = vi.fn().mockResolvedValue({
      wrote: [],
      skipped: ['influenced', 'assisted'],
      missReason: null,
    });
    const out = await handleShopifyOrderWebhook({
      rawBody: validBody,
      hmacHeader: 'abc',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn().mockResolvedValue(undefined),
    });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      ok: true,
      wrote: [],
      skipped: ['influenced', 'assisted'],
      missReason: null,
    });
  });

  it('returns 400 invalid_amount when total_price is malformed', async () => {
    const body = JSON.stringify({
      id: 1,
      total_price: 'abc',
      currency: 'USD',
      created_at: '2026-05-27T10:00:00Z',
      line_items: [{ sku: 'SKU-A', quantity: 1, price: '50.00' }],
      note_attributes: [{ name: 'sm_visitor_id', value: 'v1' }],
    });
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(400);
    expect(out.body?.error).toBe('invalid_amount');
    expect(attribute).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_amount when total_price is negative', async () => {
    const body = JSON.stringify({
      id: 1,
      total_price: '-10.00',
      currency: 'USD',
      created_at: '2026-05-27T10:00:00Z',
      line_items: [{ sku: 'SKU-A', quantity: 1, price: '50.00' }],
      note_attributes: [{ name: 'sm_visitor_id', value: 'v1' }],
    });
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(400);
    expect(out.body?.error).toBe('invalid_amount');
    expect(attribute).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_occurred_at when created_at is unparseable', async () => {
    const body = JSON.stringify({
      id: 1,
      total_price: '50.00',
      currency: 'USD',
      created_at: 'not-a-date',
      line_items: [{ sku: 'SKU-A', quantity: 1, price: '50.00' }],
      note_attributes: [{ name: 'sm_visitor_id', value: 'v1' }],
    });
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(400);
    expect(out.body?.error).toBe('invalid_occurred_at');
    expect(attribute).not.toHaveBeenCalled();
  });

  it('does not crash when note_attributes is an object instead of array', async () => {
    const body = JSON.stringify({
      id: 1,
      total_price: '50.00',
      currency: 'USD',
      created_at: '2026-05-27T10:00:00Z',
      line_items: [{ sku: 'SKU-A', quantity: 1, price: '50.00' }],
      note_attributes: { sm_visitor_id: 'v1' },
    });
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn().mockResolvedValue(undefined),
    });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      ok: true,
      wrote: [],
      skipped: ['no_visitor_id'],
      missReason: null,
    });
    expect(attribute).not.toHaveBeenCalled();
  });

  it('treats non-string sm_visitor_id value as missing', async () => {
    const body = JSON.stringify({
      id: 1,
      total_price: '50.00',
      currency: 'USD',
      created_at: '2026-05-27T10:00:00Z',
      line_items: [{ sku: 'SKU-A', quantity: 1, price: '50.00' }],
      note_attributes: [{ name: 'sm_visitor_id', value: 12345 }],
    });
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn().mockResolvedValue(undefined),
    });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({
      ok: true,
      wrote: [],
      skipped: ['no_visitor_id'],
      missReason: null,
    });
    expect(attribute).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_json when body is not valid JSON', async () => {
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: '{not json',
      hmacHeader: 'abc',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(400);
    expect(out.body?.error).toBe('invalid_json');
    expect(attribute).not.toHaveBeenCalled();
  });

  it('returns 404 merchant_unknown when lookupMerchantId returns null', async () => {
    const recordMetric = vi.fn();
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: validBody,
      hmacHeader: 'abc',
      shopDomain: 'unknown.myshopify.com',
      lookupMerchantId: async () => null,
      verifyHmac: () => true,
      attribute,
      recordMetric,
    });
    expect(out.status).toBe(404);
    expect(out.body?.error).toBe('merchant_unknown');
    expect(attribute).not.toHaveBeenCalled();
    expect(recordMetric).not.toHaveBeenCalled();
  });

  it('returns 500 internal when lookupMerchantId throws', async () => {
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: validBody,
      hmacHeader: 'abc',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => { throw new Error('db down'); },
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(500);
    expect(out.body?.error).toBe('internal');
    expect(attribute).not.toHaveBeenCalled();
  });

  it('returns 400 invalid_amount when a line item price is malformed', async () => {
    const body = JSON.stringify({
      id: 1,
      total_price: '50.00',
      currency: 'USD',
      created_at: '2026-05-27T10:00:00Z',
      line_items: [{ sku: 'SKU-A', quantity: 1, price: 'abc' }],
      note_attributes: [{ name: 'sm_visitor_id', value: 'v1' }],
    });
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric: vi.fn(),
    });
    expect(out.status).toBe(400);
    expect(out.body?.error).toBe('invalid_amount');
    expect(attribute).not.toHaveBeenCalled();
  });

  it('emits conversionIngested per wrote[] entry on success', async () => {
    const recordMetric = vi.fn().mockResolvedValue(undefined);
    const attribute = vi.fn().mockResolvedValue({ wrote: ['influenced'], skipped: [], missReason: null });
    const out = await handleShopifyOrderWebhook({
      rawBody: validBody,
      hmacHeader: 'abc',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
      recordMetric,
    });
    expect(out.status).toBe(200);
    expect(recordMetric).toHaveBeenCalledOnce();
    expect(recordMetric).toHaveBeenCalledWith({
      merchantId: 'm1',
      metricName: 'conversion.ingested',
      tags: { source: 'shopify_webhook', kind: 'influenced' },
    });
  });

  it('emits conversionMissNoVisitor when sm_visitor_id is absent', async () => {
    const recordMetric = vi.fn().mockResolvedValue(undefined);
    const body = JSON.stringify({ id: 1, total_price: '5.00', currency: 'USD', created_at: '2026-05-27T10:00:00Z', line_items: [] });
    const out = await handleShopifyOrderWebhook({
      rawBody: body,
      hmacHeader: 'abc',
      shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute: vi.fn(),
      recordMetric,
    });
    expect(out.status).toBe(200);
    expect(recordMetric).toHaveBeenCalledOnce();
    expect(recordMetric).toHaveBeenCalledWith({
      merchantId: 'm1',
      metricName: 'conversion.miss.no_visitor_in_window',
      tags: { source: 'shopify_webhook' },
    });
  });
});
