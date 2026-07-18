import { describe, expect, it, vi } from 'vitest';
import { provisionShopifyMerchant } from './shopifyProvision.js';

function deps(overrides = {}) {
  return {
    findMerchantByDomain: vi.fn().mockResolvedValue(null),
    createMerchant: vi.fn().mockResolvedValue(undefined),
    enqueueOnboarding: vi.fn().mockResolvedValue(undefined),
    generateId: vi.fn().mockReturnValue('SM-ABC123'),
    ...overrides,
  };
}

describe('provisionShopifyMerchant()', () => {
  it('creates a merchant, sets allowed domains, and enqueues onboarding for a new shop', async () => {
    const d = deps();
    const out = await provisionShopifyMerchant(d, {
      shop: 'Shoppingmate-RHRYVC5Z.myshopify.com',
      domains: ['shoppingmate-rhryvc5z.myshopify.com', 'brand.com'],
    });
    expect(out).toEqual({ merchantId: 'SM-ABC123', created: true });
    expect(d.createMerchant).toHaveBeenCalledWith({
      id: 'SM-ABC123',
      domain: 'shoppingmate-rhryvc5z.myshopify.com',
      allowedDomains: ['shoppingmate-rhryvc5z.myshopify.com', 'brand.com'],
    });
    expect(d.enqueueOnboarding).toHaveBeenCalledWith({
      merchantId: 'SM-ABC123',
      domain: 'shoppingmate-rhryvc5z.myshopify.com',
    });
  });

  it('is idempotent — returns the existing merchant on reinstall, no create/enqueue', async () => {
    const d = deps({
      findMerchantByDomain: vi.fn().mockResolvedValue({ id: 'SM-EXIST0', status: 'live' }),
    });
    const out = await provisionShopifyMerchant(d, { shop: 'shop.myshopify.com' });
    expect(out).toEqual({ merchantId: 'SM-EXIST0', created: false });
    expect(d.createMerchant).not.toHaveBeenCalled();
    expect(d.enqueueOnboarding).not.toHaveBeenCalled();
  });
});
