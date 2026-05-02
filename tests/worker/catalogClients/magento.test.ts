import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fetchMagentoCatalog } from '../../../apps/worker/src/steps/catalogClients/magento.js';
import fixture from '../../fixtures/magentoProducts.json' with { type: 'json' };

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

describe('fetchMagentoCatalog', () => {
  it('paginates /rest/V1/products and normalizes', async () => {
    server.use(
      http.get('https://m.example.com/rest/V1/products', () => HttpResponse.json(fixture)),
    );
    const r = await fetchMagentoCatalog('m.example.com', { cap: 5000, timeoutMs: 90_000 });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.products[0]?.sku).toBe('MG-TEE-001');
      expect(r.products[0]?.priceCents).toBe(1999);
      expect(r.products[0]?.source).toBe('magento_rest');
      expect(r.products[0]?.productUrl).toBe('https://m.example.com/blue-tee.html');
    }
  });

  it('returns failed with requires_admin_token on 401', async () => {
    server.use(
      http.get(
        'https://m.example.com/rest/V1/products',
        () => new HttpResponse('Unauthorized', { status: 401 }),
      ),
    );
    const r = await fetchMagentoCatalog('m.example.com', { cap: 5000, timeoutMs: 90_000 });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('requires_admin_token');
  });
});
