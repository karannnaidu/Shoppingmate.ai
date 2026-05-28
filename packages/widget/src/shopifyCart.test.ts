import { describe, expect, it, vi } from 'vitest';
import { injectShopifyCartAttribute } from './shopifyCart.js';

describe('injectShopifyCartAttribute', () => {
  it('POSTs sm_visitor_id to /cart/update.js when on a Shopify storefront', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await injectShopifyCartAttribute({ visitorId: 'v_abc', platform: 'shopify', fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(
      '/cart/update.js',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ attributes: { sm_visitor_id: 'v_abc' } }),
      }),
    );
  });

  it('is a no-op on non-Shopify platforms', async () => {
    const fetchFn = vi.fn();
    await injectShopifyCartAttribute({ visitorId: 'v_abc', platform: 'woocommerce', fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('swallows fetch errors silently (best-effort)', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error('CORS'));
    await expect(
      injectShopifyCartAttribute({ visitorId: 'v_abc', platform: 'shopify', fetchFn }),
    ).resolves.not.toThrow();
  });
});
