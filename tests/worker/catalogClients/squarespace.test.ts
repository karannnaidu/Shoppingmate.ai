import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchSquarespaceCatalog } from '../../../apps/worker/src/steps/catalogClients/squarespace.js';
import fixture from '../../fixtures/squarespaceProducts.json' with { type: 'json' };

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

describe('fetchSquarespaceCatalog', () => {
  it('reads /api/commerce/v1/products and normalizes', async () => {
    server.use(
      http.get('https://shop.example.com/api/commerce/v1/products', () =>
        HttpResponse.json(fixture),
      ),
    );
    const r = await fetchSquarespaceCatalog('shop.example.com', { cap: 5000, timeoutMs: 90_000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.products[0]?.sku).toBe('SQ-TEE-001');
      expect(r.products[0]?.variants).toHaveLength(1);
      expect(r.products[0]?.source).toBe('squarespace_commerce');
      expect(r.products[0]?.priceCents).toBe(1999);
      expect(r.products[0]?.productUrl).toBe('https://shop.example.com/shop/blue-tee');
    }
  });

  it('returns failed on http_503', async () => {
    server.use(
      http.get(
        'https://shop.example.com/api/commerce/v1/products',
        () => new HttpResponse(null, { status: 503 }),
      ),
    );
    const r = await fetchSquarespaceCatalog('shop.example.com', { cap: 5000, timeoutMs: 90_000 });
    expect(r.kind).toBe('failed');
  });
});
