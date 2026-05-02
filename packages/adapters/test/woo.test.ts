import type { Merchant } from '@shoppingmate/db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import wooCart from './fixtures/wooCart.json' with { type: 'json' };

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => [
    { sku: 'TEE-BLUE-M', title: 'Blue Tee', merchantId: 'SM-W01', productUrl: 'x' },
  ]),
  getProduct: vi.fn(async () => ({
    sku: 'TEE-BLUE-M',
    title: 'Blue Tee',
    merchantId: 'SM-W01',
    productUrl: 'x',
    variants: [{ id: '42', options: { pa_size: 'M' } }],
  })),
}));

const server = setupServer();
beforeEach(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.close());

const merchant = {
  id: 'SM-W01',
  domain: 'woo.example.com',
  adapterType: 'woo',
  adapterConfig: {},
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

describe('WooAdapter — nonce retry', () => {
  it('retries once on 403 rest_cookie_invalid_nonce', async () => {
    let calls = 0;
    server.use(
      http.get(
        'https://woo.example.com/wp-json/wc/store/v1/cart',
        () =>
          new HttpResponse(
            JSON.stringify({
              items: [],
              totals: { total_price: '0', total_items: '0', currency_code: 'USD' },
              coupons: [],
            }),
            {
              status: 200,
              headers: { 'x-wc-store-api-nonce': 'nonceX', 'cart-token': 'tokX' },
            },
          ),
      ),
      http.post('https://woo.example.com/wp-json/wc/store/v1/cart/add-item', () => {
        calls++;
        if (calls === 1) {
          return new HttpResponse('{"code":"rest_cookie_invalid_nonce"}', { status: 403 });
        }
        return HttpResponse.json(wooCart);
      }),
    );
    const { WooAdapter } = await import('../src/woo.js');
    const a = new WooAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'TEE-BLUE-M', '42', 1);
    expect(r.kind).toBe('ok');
    expect(calls).toBe(2);
  });
});

describe('WooAdapter — cartAdd', () => {
  it('captures nonce on first GET, then POSTs add-item with nonce + token', async () => {
    let nonceUsed = '';
    server.use(
      http.get(
        'https://woo.example.com/wp-json/wc/store/v1/cart',
        () =>
          new HttpResponse(
            JSON.stringify({
              items: [],
              totals: { total_price: '0', total_items: '0', currency_code: 'USD' },
              coupons: [],
            }),
            {
              status: 200,
              headers: { 'x-wc-store-api-nonce': 'nonce123', 'cart-token': 'cartABC' },
            },
          ),
      ),
      http.post(
        'https://woo.example.com/wp-json/wc/store/v1/cart/add-item',
        async ({ request }) => {
          nonceUsed = request.headers.get('nonce') ?? '';
          return new HttpResponse(JSON.stringify(wooCart), {
            status: 200,
            headers: { 'cart-token': 'cartABC' },
          });
        },
      ),
    );
    const { WooAdapter } = await import('../src/woo.js');
    const a = new WooAdapter();
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's' }, 'TEE-BLUE-M', '42', 1);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.cartToken).toBe('cartABC');
      expect(r.value.lines[0]?.sku).toBe('TEE-BLUE-M');
    }
    expect(nonceUsed).toBe('nonce123');
  });
});
