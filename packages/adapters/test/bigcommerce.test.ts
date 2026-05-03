import type { Merchant } from '@shoppingmate/db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => [
    { sku: 'BC-TEE-001-M', title: 'Blue Tee', merchantId: 'SM-BC', productUrl: 'x' },
  ]),
  getProduct: vi.fn(async () => ({
    sku: 'BC-TEE-001-M',
    title: 'Blue Tee',
    merchantId: 'SM-BC',
    productUrl: 'x',
    variants: [{ id: '9101', options: { Size: 'M' } }],
  })),
}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = {
  id: 'SM-BC',
  domain: 'shop.example.com',
  adapterType: 'bigcommerce',
  adapterConfig: {},
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

const cartFixture = {
  id: 'cart-bc-1',
  currency: { code: 'USD' },
  cartAmount: 19.99,
  baseAmount: 19.99,
  lineItems: {
    physicalItems: [
      {
        id: 'li-1',
        productId: 9001,
        variantId: 9101,
        sku: 'BC-TEE-001-M',
        name: 'Blue Tee — Medium',
        quantity: 1,
        listPrice: 19.99,
        extendedListPrice: 19.99,
      },
    ],
  },
  coupons: [],
};

describe('BigCommerceAdapter — cartAdd', () => {
  it('creates cart, returns CartState', async () => {
    server.use(
      http.post('https://shop.example.com/api/storefront/carts', () =>
        HttpResponse.json(cartFixture),
      ),
    );
    const { BigCommerceAdapter } = await import('../src/bigcommerce.js');
    const a = new BigCommerceAdapter();
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 's' },
      'BC-TEE-001-M',
      '9101',
      1,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('cart-bc-1');
      expect(r.value.lines[0]?.sku).toBe('BC-TEE-001-M');
      expect(r.value.totalCents).toBe(1999);
    }
  });

  it('returns unsupported when variantId missing', async () => {
    const { BigCommerceAdapter } = await import('../src/bigcommerce.js');
    const a = new BigCommerceAdapter();
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 's' },
      'BC-TEE-001',
      null,
      1,
    );
    expect(r.kind).toBe('unsupported');
  });
});

describe('BigCommerceAdapter — checkoutUrl', () => {
  it('hits redirect_urls endpoint when cartToken set', async () => {
    server.use(
      http.post('https://shop.example.com/api/storefront/carts/cart-bc-1/redirect_urls', () =>
        HttpResponse.json({ checkout_url: 'https://shop.example.com/checkout/cart-bc-1' }),
      ),
    );
    const { BigCommerceAdapter } = await import('../src/bigcommerce.js');
    const a = new BigCommerceAdapter();
    const r = await a.checkoutUrl({ merchant, cartToken: 'cart-bc-1', sessionId: 's' });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value).toBe('https://shop.example.com/checkout/cart-bc-1');
  });
});
