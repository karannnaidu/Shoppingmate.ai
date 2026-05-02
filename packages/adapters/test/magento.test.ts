import type { Merchant } from '@shoppingmate/db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => [
    { sku: 'MG-TEE-001', title: 'Blue Tee', merchantId: 'SM-MG', productUrl: 'x' },
  ]),
  getProduct: vi.fn(async () => ({
    sku: 'MG-TEE-001',
    title: 'Blue Tee',
    merchantId: 'SM-MG',
    productUrl: 'x',
    variants: [],
  })),
}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = {
  id: 'SM-MG',
  domain: 'm.example.com',
  adapterType: 'magento',
  adapterConfig: {},
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

const totalsFixture = {
  grand_total: 19.99,
  subtotal: 19.99,
  base_currency_code: 'USD',
  items: [
    {
      item_id: 1,
      sku: 'MG-TEE-001',
      name: 'Blue Tee',
      qty: 1,
      price: 19.99,
      row_total: 19.99,
    },
  ],
  coupon_code: null,
};

describe('MagentoAdapter — cartAdd', () => {
  it('creates guest cart, adds item, returns CartState', async () => {
    server.use(
      http.post('https://m.example.com/rest/V1/guest-carts', () => HttpResponse.json('cart-123')),
      http.post('https://m.example.com/rest/V1/guest-carts/cart-123/items', () =>
        HttpResponse.json({
          item_id: 1,
          sku: 'MG-TEE-001',
          name: 'Blue Tee',
          qty: 1,
          price: 19.99,
        }),
      ),
      http.get('https://m.example.com/rest/V1/guest-carts/cart-123/totals', () =>
        HttpResponse.json(totalsFixture),
      ),
    );
    const { MagentoAdapter } = await import('../src/magento.js');
    const a = new MagentoAdapter();
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 's' },
      'MG-TEE-001',
      null,
      1,
    );
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('cart-123');
      expect(r.value.lines[0]?.sku).toBe('MG-TEE-001');
      expect(r.value.totalCents).toBe(1999);
    }
  });
});

describe('MagentoAdapter — reads + checkout', () => {
  it('searchProducts delegates to repo', async () => {
    const { MagentoAdapter } = await import('../src/magento.js');
    const a = new MagentoAdapter();
    const r = await a.searchProducts({ merchant, cartToken: null, sessionId: 's' }, 'tee');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value[0]?.sku).toBe('MG-TEE-001');
  });

  it('getProduct delegates to repo', async () => {
    const { MagentoAdapter } = await import('../src/magento.js');
    const a = new MagentoAdapter();
    const r = await a.getProduct({ merchant, cartToken: null, sessionId: 's' }, 'MG-TEE-001');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value?.sku).toBe('MG-TEE-001');
  });

  it('checkoutUrl returns guest-cart-id deeplink when cartToken present', async () => {
    const { MagentoAdapter } = await import('../src/magento.js');
    const a = new MagentoAdapter();
    const r = await a.checkoutUrl({ merchant, cartToken: 'cart-123', sessionId: 's' });
    expect(r).toEqual({
      kind: 'ok',
      value: 'https://m.example.com/checkout/?guest-cart-id=cart-123',
    });
  });
});
