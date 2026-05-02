import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { smokeTest } from '../../apps/worker/src/steps/smokeTest.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('smokeTest', () => {
  it('shopify cart/add.js -> passed', async () => {
    server.use(
      http.post('https://shop.test/cart/add.js', () =>
        HttpResponse.json({ id: 1, quantity: 1, key: 'tok123' }),
      ),
    );
    const r = await smokeTest({
      adapterType: 'shopify',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
    });
    expect(r.kind).toBe('passed');
  });

  it('shopify 422 -> failed', async () => {
    server.use(
      http.post('https://shop.test/cart/add.js', () => new HttpResponse(null, { status: 422 })),
    );
    const r = await smokeTest({
      adapterType: 'shopify',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
    });
    expect(r.kind).toBe('failed');
  });

  it('woo store/v1/cart/add-item -> passed', async () => {
    server.use(
      http.post('https://woo.test/wp-json/wc/store/v1/cart/add-item', () =>
        HttpResponse.json({ items: [{ id: 200, quantity: 1 }] }),
      ),
    );
    const r = await smokeTest({
      adapterType: 'woo',
      domain: 'woo.test',
      firstVariantId: '200',
      productUrl: 'https://woo.test/product/x',
      selectors: null,
    });
    expect(r.kind).toBe('passed');
  });

  it('dom adapter without selectors -> failed', async () => {
    const r = await smokeTest({
      adapterType: 'dom',
      domain: 'd.test',
      firstVariantId: 'x',
      productUrl: 'https://d.test/products/x',
      selectors: null,
    });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('selectors_missing');
  });
});
