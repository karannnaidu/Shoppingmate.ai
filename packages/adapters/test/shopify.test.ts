import type { Merchant } from '@shoppingmate/db';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
