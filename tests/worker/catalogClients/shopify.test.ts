import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchShopifyCatalog } from '../../../apps/worker/src/steps/catalogClients/shopify.js';

const fixtures = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'fixtures', 'shopifyProducts.json'), 'utf8'),
);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchShopifyCatalog', () => {
  it('paginates /products.json and normalizes products', async () => {
    server.use(
      http.get('https://shop.test/products.json', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        const key = `page${page}` as keyof typeof fixtures;
        return HttpResponse.json(fixtures[key]);
      }),
    );

    const result = await fetchShopifyCatalog('shop.test', { cap: 5000, timeoutMs: 90_000 });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.products).toHaveLength(3);
    expect(result.products[0]).toMatchObject({
      sku: 'linen-beach-pants',
      title: 'Linen Beach Pants',
      productUrl: 'https://shop.test/products/linen-beach-pants',
      imageUrl: 'https://shop.test/cdn/shop/products/linen.jpg',
      priceCents: 4900,
      currency: 'USD',
      inStock: true,
    });
    expect(result.products[0].variants).toEqual([
      { id: '1001', sku: 'PANTS-S', priceCents: 4900, inStock: true, options: { option1: 'S' } },
      { id: '1002', sku: 'PANTS-M', priceCents: 4900, inStock: false, options: { option1: 'M' } },
    ]);
  });

  it('honors cap', async () => {
    server.use(
      http.get('https://shop.test/products.json', ({ request }) => {
        const page = new URL(request.url).searchParams.get('page') ?? '1';
        const key = `page${page}` as keyof typeof fixtures;
        return HttpResponse.json(fixtures[key]);
      }),
    );
    const result = await fetchShopifyCatalog('shop.test', { cap: 2, timeoutMs: 90_000 });
    expect(result.kind).toBe('ok');
    if (result.kind === 'ok') expect(result.products).toHaveLength(2);
  });

  it('returns failed on http error', async () => {
    server.use(
      http.get('https://shop.test/products.json', () => new HttpResponse(null, { status: 503 })),
    );
    const result = await fetchShopifyCatalog('shop.test', { cap: 5000, timeoutMs: 90_000 });
    expect(result.kind).toBe('failed');
  });
});
