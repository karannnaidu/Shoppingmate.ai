import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it, vi } from 'vitest';
import { getAdapter } from '../src/dispatch.js';
import { implementedAdapters } from '../src/implementedAdapters.js';

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => []),
  getProduct: vi.fn(async () => null),
}));

const stubMerchant = (adapterType: string): Merchant =>
  ({
    id: 'SM-T01',
    domain: 'example.com',
    adapterType,
    adapterConfig: {},
    status: 'live',
    installedAt: new Date(),
    personaId: 'concierge',
    allowedDomains: [],
  }) as unknown as Merchant;

describe('getAdapter', () => {
  it.each([
    ['shopify', 'shopify'],
    ['woo', 'woo'],
    ['magento', 'magento'],
    ['bigcommerce', 'bigcommerce'],
    ['wix', 'wix'],
    ['squarespace', 'squarespace'],
  ])('returns kind=%s for adapterType=%s', (kind, type) => {
    expect(getAdapter(stubMerchant(type)).kind).toBe(kind);
  });

  it.each(['dom', 'suggest'])('throws adapter_not_implemented_in_plan3c for %s', (type) => {
    expect(() => getAdapter(stubMerchant(type))).toThrow(/adapter_not_implemented_in_plan3c/);
  });
});

describe('implementedAdapters', () => {
  it('contains all platforms 3c wired', () => {
    expect(implementedAdapters.has('magento')).toBe(true);
    expect(implementedAdapters.has('bigcommerce')).toBe(true);
    expect(implementedAdapters.has('wix')).toBe(true);
    expect(implementedAdapters.has('squarespace')).toBe(true);
  });
});
