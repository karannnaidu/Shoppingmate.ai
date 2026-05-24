import { describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({ db: {}, schema: {} }));
vi.mock('@shoppingmate/jobs', () => ({ siteGraphCrawlQueue: { add: vi.fn() }, siteGraphExtractQueue: {} }));

import { handleShopifyProductWebhook } from './shopify.js';

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
