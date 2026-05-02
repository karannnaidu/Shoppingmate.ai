import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { fetchWooCatalog } from '../../../apps/worker/src/steps/catalogClients/woo.js';

const fixtures = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', '..', 'fixtures', 'wooProducts.json'), 'utf8'),
);

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('fetchWooCatalog', () => {
  it('paginates Store API and normalizes products', async () => {
    server.use(
      http.get('https://woo.test/wp-json/wc/store/v1/products', ({ request }) => {
        const page = Number(new URL(request.url).searchParams.get('page') ?? '1');
        return HttpResponse.json(fixtures[`page${page}`]);
      }),
    );

    const result = await fetchWooCatalog('woo.test', { cap: 5000, timeoutMs: 90_000 });
    expect(result.kind).toBe('ok');
    if (result.kind !== 'ok') return;
    expect(result.products).toHaveLength(2);
    expect(result.products[0]).toMatchObject({
      sku: 'ceramic-mug',
      title: 'Ceramic Mug',
      productUrl: 'https://woo.test/product/ceramic-mug/',
      imageUrl: 'https://woo.test/wp-content/uploads/mug.jpg',
      priceCents: 1500,
      currency: 'USD',
      inStock: true,
    });
    expect(result.products[1].inStock).toBe(false);
  });

  it('returns failed on 404', async () => {
    server.use(
      http.get(
        'https://woo.test/wp-json/wc/store/v1/products',
        () => new HttpResponse(null, { status: 404 }),
      ),
    );
    const result = await fetchWooCatalog('woo.test', { cap: 5000, timeoutMs: 90_000 });
    expect(result.kind).toBe('failed');
  });
});
