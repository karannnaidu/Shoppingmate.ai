import { describe, expect, it, vi } from 'vitest';
import { provisionShopifyMerchant } from './shopifyProvision.js';

function deps(overrides = {}) {
  return {
    findMerchantByDomain: vi.fn().mockResolvedValue(null),
    createMerchant: vi.fn().mockResolvedValue(undefined),
    updateToken: vi.fn().mockResolvedValue(undefined),
    enqueueOnboarding: vi.fn().mockResolvedValue(undefined),
    encryptToken: vi.fn((t) => `enc(${t})`),
    generateId: vi.fn().mockReturnValue('SM-ABC123'),
    ...overrides,
  };
}

describe('provisionShopifyMerchant()', () => {
  it('creates a merchant with the encrypted token, sets domains, enqueues onboarding', async () => {
    const d = deps();
    const out = await provisionShopifyMerchant(d, {
      shop: 'Shoppingmate-RHRYVC5Z.myshopify.com',
      domains: ['shoppingmate-rhryvc5z.myshopify.com', 'brand.com'],
      accessToken: 'shpat_live',
    });
    expect(out).toEqual({ merchantId: 'SM-ABC123', created: true });
    expect(d.createMerchant).toHaveBeenCalledWith({
      id: 'SM-ABC123',
      domain: 'shoppingmate-rhryvc5z.myshopify.com',
      allowedDomains: ['shoppingmate-rhryvc5z.myshopify.com', 'brand.com'],
      tokenEnc: 'enc(shpat_live)',
    });
    expect(d.enqueueOnboarding).toHaveBeenCalledWith({
      merchantId: 'SM-ABC123',
      domain: 'shoppingmate-rhryvc5z.myshopify.com',
    });
  });

  it('is idempotent — returns existing merchant and refreshes its token on reinstall', async () => {
    const d = deps({
      findMerchantByDomain: vi.fn().mockResolvedValue({ id: 'SM-EXIST0', status: 'live' }),
    });
    const out = await provisionShopifyMerchant(d, {
      shop: 'shop.myshopify.com',
      accessToken: 'shpat_new',
    });
    expect(out).toEqual({ merchantId: 'SM-EXIST0', created: false });
    expect(d.updateToken).toHaveBeenCalledWith('SM-EXIST0', 'enc(shpat_new)');
    expect(d.createMerchant).not.toHaveBeenCalled();
    expect(d.enqueueOnboarding).not.toHaveBeenCalled();
  });

  it('stores no token when none is provided', async () => {
    const d = deps();
    await provisionShopifyMerchant(d, { shop: 'shop.myshopify.com' });
    expect(d.createMerchant).toHaveBeenCalledWith(
      expect.objectContaining({ tokenEnc: null }),
    );
    expect(d.encryptToken).not.toHaveBeenCalled();
  });
});
