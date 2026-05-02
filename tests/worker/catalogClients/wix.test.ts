import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchWixCatalog } from '../../../apps/worker/src/steps/catalogClients/wix.js';
import fixture from '../../fixtures/wixProducts.json' with { type: 'json' };

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

describe('fetchWixCatalog', () => {
  it('reads wix-ecommerce-storefront-web/products and normalizes', async () => {
    server.use(
      http.get(
        'https://shop.example.com/_api/wix-ecommerce-storefront-web/api/storefront/products',
        () => HttpResponse.json(fixture),
      ),
    );
    const r = await fetchWixCatalog('shop.example.com', { cap: 5000, timeoutMs: 90_000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.products[0]?.sku).toBe('WX-TEE-001');
      expect(r.products[0]?.source).toBe('wix_stores');
      expect(r.products[0]?.priceCents).toBe(1999);
      expect(r.products[0]?.productUrl).toBe('https://shop.example.com/product/blue-tee');
    }
  });

  it('returns failed on http_500', async () => {
    server.use(
      http.get(
        'https://shop.example.com/_api/wix-ecommerce-storefront-web/api/storefront/products',
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    const r = await fetchWixCatalog('shop.example.com', { cap: 5000, timeoutMs: 90_000 });
    expect(r.kind).toBe('failed');
  });
});
