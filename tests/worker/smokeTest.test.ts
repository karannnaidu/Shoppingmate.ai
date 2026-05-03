import * as adapters from '@shoppingmate/adapters';
import type { Adapter } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { smokeTest } from '../../apps/worker/src/steps/smokeTest.js';

const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

const stubMerchant = (adapterType: Merchant['adapterType']): Merchant =>
  ({
    id: 'SM-T01',
    domain: 'shop.test',
    adapterType,
    adapterConfig: {},
    status: 'live',
    installedAt: new Date(),
    personaId: 'concierge',
    allowedDomains: [],
  }) as unknown as Merchant;

function mockAdapter(kind: Adapter['kind'], outcome: 'ok' | 'platform_error' | 'unsupported') {
  const cartAdd = vi.fn(async () => {
    if (outcome === 'ok') {
      return {
        kind: 'ok' as const,
        value: {
          cartToken: 'tok',
          lines: [],
          subtotalCents: 0,
          totalCents: 0,
          currency: 'USD',
          appliedCoupons: [],
        },
      };
    }
    if (outcome === 'platform_error') {
      return { kind: 'platform_error' as const, status: 422, body: 'err' };
    }
    return { kind: 'unsupported' as const, reason: 'variant_required' };
  });
  const stub = {
    kind,
    searchProducts: vi.fn(),
    getProduct: vi.fn(),
    cartAdd,
    cartUpdate: vi.fn(),
    cartGet: vi.fn(),
    couponApply: vi.fn(),
    checkoutUrl: vi.fn(),
  } as unknown as Adapter;
  vi.spyOn(adapters, 'getAdapter').mockReturnValue(stub);
  return { stub, cartAdd };
}

describe('smokeTest — adapter delegation', () => {
  it.each(['shopify', 'woo', 'magento', 'bigcommerce', 'wix', 'squarespace'] as const)(
    '%s succeeds when adapter cartAdd returns ok',
    async (kind) => {
      mockAdapter(kind, 'ok');
      const r = await smokeTest({
        adapterType: kind,
        domain: 'shop.test',
        firstVariantId: '1001',
        productUrl: 'https://shop.test/products/x',
        selectors: null,
        merchant: stubMerchant(kind),
        sku: 'SKU-1',
      });
      expect(r.kind).toBe('passed');
    },
  );

  it('fails with http_<status> when platform_error', async () => {
    mockAdapter('shopify', 'platform_error');
    const r = await smokeTest({
      adapterType: 'shopify',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
      merchant: stubMerchant('shopify'),
      sku: 'SKU-1',
    });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('http_422');
  });

  it('fails with reason when unsupported', async () => {
    mockAdapter('bigcommerce', 'unsupported');
    const r = await smokeTest({
      adapterType: 'bigcommerce',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
      merchant: stubMerchant('bigcommerce'),
      sku: 'SKU-1',
    });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('variant_required');
  });

  it('fails with merchant_missing when no merchant on non-dom adapter', async () => {
    const r = await smokeTest({
      adapterType: 'shopify',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
    });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('merchant_missing');
  });
});

describe('smokeTest — dom adapter', () => {
  it('without selectors -> failed selectors_missing', async () => {
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

  it('with selectors but no merchant -> failed merchant_missing', async () => {
    const r = await smokeTest({
      adapterType: 'dom',
      domain: 'd.test',
      firstVariantId: 'x',
      productUrl: 'https://d.test/products/x',
      selectors: {
        add_to_cart_button: '.add',
        cart_page_total: '.total',
      } as unknown as Parameters<typeof smokeTest>[0]['selectors'],
    });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('merchant_missing');
  });
});

// Legacy harness: confirm shopify/woo flows still work end-to-end via the
// real ShopifyAdapter/WooAdapter going through MSW. These are the tests the
// smoke step exercised in Plan 3a, kept as integration-style checks.
describe('smokeTest — real adapter integration via MSW', () => {
  it('shopify cart/add.js -> passed', async () => {
    server.use(
      http.post('https://shop.test/cart/add.js', () =>
        HttpResponse.json({ id: 1, quantity: 1, key: 'tok123' }),
      ),
      http.get('https://shop.test/cart.js', () =>
        HttpResponse.json({
          token: 'tok123',
          items: [],
          total_price: 0,
          items_subtotal_price: 0,
          currency: 'USD',
          applied_discount_codes: [],
        }),
      ),
    );
    const r = await smokeTest({
      adapterType: 'shopify',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
      merchant: stubMerchant('shopify'),
      sku: 'SKU-1',
    });
    expect(r.kind).toBe('passed');
  });

  it('shopify 422 -> failed http_422', async () => {
    server.use(
      http.post('https://shop.test/cart/add.js', () => new HttpResponse(null, { status: 422 })),
    );
    const r = await smokeTest({
      adapterType: 'shopify',
      domain: 'shop.test',
      firstVariantId: '1001',
      productUrl: 'https://shop.test/products/x',
      selectors: null,
      merchant: stubMerchant('shopify'),
      sku: 'SKU-1',
    });
    expect(r.kind).toBe('failed');
    if (r.kind === 'failed') expect(r.reason).toBe('http_422');
  });
});
