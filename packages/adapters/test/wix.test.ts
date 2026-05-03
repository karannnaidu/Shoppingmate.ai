import type { Merchant } from '@shoppingmate/db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => [
    { sku: 'WX-TEE-001', title: 'Blue Tee', merchantId: 'SM-WX', productUrl: 'x' },
  ]),
  getProduct: vi.fn(async () => ({
    sku: 'WX-TEE-001',
    title: 'Blue Tee',
    merchantId: 'SM-WX',
    productUrl: 'x',
    variants: [{ id: 'wx-1', options: { Size: 'M' } }],
  })),
}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = {
  id: 'SM-WX',
  domain: 'shop.example.com',
  adapterType: 'wix',
  adapterConfig: {},
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

const cartFixture = {
  cart: {
    id: 'wix-cart-1',
    currency: 'USD',
    subtotal: 19.99,
    total: 19.99,
    lineItems: [
      {
        id: 'li-1',
        catalogReference: { catalogItemId: 'wx-1' },
        productName: { original: 'Blue Tee' },
        quantity: 1,
        price: 19.99,
        rowTotal: 19.99,
      },
    ],
    appliedDiscounts: [],
  },
};

describe('WixAdapter — cartAdd', () => {
  it('POSTs cart/lines/add and returns CartState', async () => {
    server.use(
      http.post(
        'https://shop.example.com/_api/wix-ecommerce-storefront-web/api/storefront/cart/lines/add',
        () =>
          new HttpResponse(JSON.stringify(cartFixture), {
            status: 200,
            headers: { 'set-cookie': '_wixCIDX=wix-cart-1; path=/' },
          }),
      ),
    );
    const { WixAdapter } = await import('../src/wix.js');
    const a = new WixAdapter();
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 's' },
      'WX-TEE-001',
      'wx-1',
      1,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('wix-cart-1');
      expect(r.value.lines[0]?.sku).toBe('wx-1');
      expect(r.value.totalCents).toBe(1999);
    }
  });

  it('returns unsupported when catalogItemId missing', async () => {
    const { WixAdapter } = await import('../src/wix.js');
    const a = new WixAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'WX-TEE-001', null, 1);
    expect(r.kind).toBe('unsupported');
  });
});

describe('WixAdapter — reads + checkout', () => {
  it('searchProducts delegates to repo', async () => {
    const { WixAdapter } = await import('../src/wix.js');
    const a = new WixAdapter();
    const r = await a.searchProducts({ merchant, cartToken: null, sessionId: 's' }, 'tee');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value[0]?.sku).toBe('WX-TEE-001');
  });

  it('checkoutUrl returns checkoutId deeplink when cartToken set', async () => {
    server.use(
      http.post(
        'https://shop.example.com/_api/wix-ecommerce-storefront-web/api/storefront/cart/createCheckout',
        () => HttpResponse.json({ checkoutId: 'co-1' }),
      ),
    );
    const { WixAdapter } = await import('../src/wix.js');
    const a = new WixAdapter();
    const r = await a.checkoutUrl({ merchant, cartToken: 'wix-cart-1', sessionId: 's' });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok')
      expect(r.value).toBe('https://shop.example.com/checkout?checkoutId=co-1');
  });
});
