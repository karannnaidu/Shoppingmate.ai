import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchBigCommerceCatalog } from '../../../apps/worker/src/steps/catalogClients/bigcommerce.js';
import fixture from '../../fixtures/bigcommerceProducts.json' with { type: 'json' };

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

describe('fetchBigCommerceCatalog', () => {
  it('reads /api/storefront/products and normalizes', async () => {
    server.use(
      http.get('https://shop.example.com/api/storefront/products', () =>
        HttpResponse.json(fixture),
      ),
    );
    const r = await fetchBigCommerceCatalog('shop.example.com', { cap: 5000, timeoutMs: 90_000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.products[0]?.sku).toBe('BC-TEE-001');
      expect(r.products[0]?.source).toBe('bigcommerce_storefront');
      expect(r.products[0]?.priceCents).toBe(1999);
      expect(r.products[0]?.variants).toHaveLength(1);
      expect(r.products[0]?.productUrl).toBe('https://shop.example.com/blue-tee/');
    }
  });

  it('returns failed on http_404', async () => {
    server.use(
      http.get(
        'https://shop.example.com/api/storefront/products',
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const r = await fetchBigCommerceCatalog('shop.example.com', { cap: 5000, timeoutMs: 90_000 });
    expect(r.kind).toBe('failed');
  });
});
