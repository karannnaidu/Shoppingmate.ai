import type { Merchant } from '@shoppingmate/db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import cartFixture from './fixtures/shopifyCart.json' with { type: 'json' };

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => [
    { sku: 'A', title: 'Tee', merchantId: 'SM-T01', productUrl: 'https://shop.example.com/a' },
  ]),
  getProduct: vi.fn(async () => ({
    sku: 'A',
    title: 'Tee',
    merchantId: 'SM-T01',
    productUrl: 'https://shop.example.com/a',
    variants: [{ id: '12345', options: { Size: 'M' } }],
  })),
}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = {
  id: 'SM-T01',
  domain: 'shop.example.com',
  adapterType: 'shopify',
  adapterConfig: {},
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

describe('ShopifyAdapter — reads', () => {
  it('searchProducts delegates to catalogRepo', async () => {
    const { ShopifyAdapter } = await import('../src/shopify.js');
    const a = new ShopifyAdapter();
    const r = await a.searchProducts({ merchant, cartToken: null, sessionId: 's' }, 'tee');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value[0]?.sku).toBe('A');
  });

  it('getProduct delegates to catalogRepo', async () => {
    const { ShopifyAdapter } = await import('../src/shopify.js');
    const a = new ShopifyAdapter();
    const r = await a.getProduct({ merchant, cartToken: null, sessionId: 's' }, 'A');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value?.sku).toBe('A');
  });
});

describe('ShopifyAdapter — cartUpdate / couponApply / checkoutUrl', () => {
  it('cartUpdate POSTs /cart/change.js then refetches', async () => {
    server.use(
      http.post('https://shop.example.com/cart/change.js', () => HttpResponse.json(cartFixture)),
      http.get('https://shop.example.com/cart.js', () => HttpResponse.json(cartFixture)),
    );
    const { ShopifyAdapter } = await import('../src/shopify.js');
    const a = new ShopifyAdapter();
    const r = await a.cartUpdate({ merchant, cartToken: 'tok', sessionId: 's' }, '12345:1', 2);
    expect(r.kind).toBe('ok');
  });

  it('couponApply hits /discount/{code} then refetches', async () => {
    server.use(
      http.post(
        'https://shop.example.com/discount/SAVE10',
        () => new HttpResponse(null, { status: 302 }),
      ),
      http.get('https://shop.example.com/cart.js', () => HttpResponse.json(cartFixture)),
    );
    const { ShopifyAdapter } = await import('../src/shopify.js');
    const a = new ShopifyAdapter();
    const r = await a.couponApply({ merchant, cartToken: 'tok', sessionId: 's' }, 'SAVE10');
    expect(r.kind).toBe('ok');
  });

  it('checkoutUrl returns deterministic url', async () => {
    const { ShopifyAdapter } = await import('../src/shopify.js');
    const a = new ShopifyAdapter();
    const r = await a.checkoutUrl({ merchant, cartToken: 'tok', sessionId: 's' });
    expect(r).toEqual({ kind: 'ok', value: 'https://shop.example.com/checkout?cart=tok' });
  });
});

describe('ShopifyAdapter — cartAdd', () => {
  it('POSTs /cart/add.js then GETs /cart.js, returns CartState', async () => {
    server.use(
      http.post(
        'https://shop.example.com/cart/add.js',
        () =>
          new HttpResponse(JSON.stringify(cartFixture.items[0]), {
            status: 200,
            headers: { 'set-cookie': 'cart=Z2NwLXVzLWNlbnRyYWwx; path=/' },
          }),
      ),
      http.get('https://shop.example.com/cart.js', () => HttpResponse.json(cartFixture)),
    );
    const { ShopifyAdapter } = await import('../src/shopify.js');
    const a = new ShopifyAdapter();
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 's' },
      'TEE-BLUE-M',
      '12345',
      1,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('Z2NwLXVzLWNlbnRyYWwx');
      expect(r.value.lines[0]?.sku).toBe('TEE-BLUE-M');
      expect(r.value.totalCents).toBe(1999);
    }
  });
});
