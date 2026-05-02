import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { getAdapter } from '../src/dispatch.js';

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
  it('returns ShopifyAdapter for shopify', () => {
    const a = getAdapter(stubMerchant('shopify'));
    expect(a.kind).toBe('shopify');
  });
  it('returns WooAdapter for woo', () => {
    const a = getAdapter(stubMerchant('woo'));
    expect(a.kind).toBe('woo');
  });
  it.each(['magento', 'bigcommerce', 'wix', 'squarespace', 'dom', 'suggest'])(
    'throws adapter_not_implemented_in_plan3b for %s',
    (type) => {
      expect(() => getAdapter(stubMerchant(type))).toThrow(/adapter_not_implemented_in_plan3b/);
    },
  );
});
