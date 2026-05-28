import { describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({ db: {}, schema: {} }));
vi.mock('@shoppingmate/jobs', () => ({ siteGraphCrawlQueue: { add: vi.fn() }, siteGraphExtractQueue: {} }));

import { handleShopifyProductWebhook, handleShopifyOrderWebhook } from './shopify.js';

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
    const out = await handleShopifyOrderWebhook({
      rawBody: validBody, hmacHeader: 'bad', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => false,
      attribute: vi.fn(),
    });
    expect(out.status).toBe(401);
  });

  it('returns 200 with no_visitor when sm_visitor_id missing', async () => {
    const body = JSON.stringify({ id: 1, total_price: '5.00', currency: 'USD', created_at: '2026-05-27T10:00:00Z', line_items: [] });
    const attribute = vi.fn();
    const out = await handleShopifyOrderWebhook({
      rawBody: body, hmacHeader: 'abc', shopDomain: 'x.myshopify.com',
      lookupMerchantId: async () => 'm1',
      verifyHmac: () => true,
      attribute,
    });
    expect(out.status).toBe(200);
    expect(out.body?.skipped).toBe('no_visitor_id');
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
    });
    expect(out.status).toBe(500);
    expect(out.body?.error).toBe('internal');
  });
});
