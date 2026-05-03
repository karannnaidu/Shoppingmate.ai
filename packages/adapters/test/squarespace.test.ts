import type { Merchant } from '@shoppingmate/db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => [
    { sku: 'SQ-TEE-001-M', title: 'Blue Tee', merchantId: 'SM-SQ', productUrl: 'x' },
  ]),
  getProduct: vi.fn(async () => ({
    sku: 'SQ-TEE-001-M',
    title: 'Blue Tee',
    merchantId: 'SM-SQ',
    productUrl: 'x',
    variants: [{ id: 'sq-1-m', options: { Size: 'M' } }],
  })),
}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = {
  id: 'SM-SQ',
  domain: 'shop.example.com',
  adapterType: 'squarespace',
  adapterConfig: {},
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

const cartFixture = {
  id: 'sq-cart-1',
  currency: 'USD',
  subtotal: 1999,
  total: 1999,
  items: [
    {
      id: 'li-1',
      productId: 'sq-1',
      variantId: 'sq-1-m',
      sku: 'SQ-TEE-001-M',
      name: 'Blue Tee',
      quantity: 1,
      price: 1999,
      lineTotal: 1999,
    },
  ],
  promotions: [],
};

describe('SquarespaceAdapter — cartAdd', () => {
  it('POSTs /api/commerce/v1/cart/items', async () => {
    server.use(
      http.post(
        'https://shop.example.com/api/commerce/v1/cart/items',
        () =>
          new HttpResponse(JSON.stringify(cartFixture), {
            status: 200,
            headers: { 'set-cookie': 'cart_id=sq-cart-1; path=/' },
          }),
      ),
    );
    const { SquarespaceAdapter } = await import('../src/squarespace.js');
    const a = new SquarespaceAdapter();
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 's' },
      'SQ-TEE-001-M',
      'sq-1-m',
      1,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('sq-cart-1');
      expect(r.value.lines[0]?.sku).toBe('SQ-TEE-001-M');
      expect(r.value.totalCents).toBe(1999);
    }
  });

  it('returns unsupported when variantId missing', async () => {
    const { SquarespaceAdapter } = await import('../src/squarespace.js');
    const a = new SquarespaceAdapter();
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 's' },
      'SQ-TEE-001-M',
      null,
      1,
    );
    expect(r.kind).toBe('unsupported');
  });
});

describe('SquarespaceAdapter — checkout', () => {
  it('checkoutUrl returns deterministic /checkout/cart', async () => {
    const { SquarespaceAdapter } = await import('../src/squarespace.js');
    const a = new SquarespaceAdapter();
    const r = await a.checkoutUrl({ merchant, cartToken: 'sq-cart-1', sessionId: 's' });
    expect(r).toEqual({ kind: 'ok', value: 'https://shop.example.com/checkout/cart' });
  });
});
