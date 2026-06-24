import { describe, expect, it, vi } from 'vitest';
import {
  injectShopifyCartAttribute,
  shopifyApplyCoupon,
  shopifyCartAdd,
  shopifyCartClear,
  shopifyCartGet,
} from './shopifyCart.js';

const CART = { item_count: 2, items: [{ id: 111, quantity: 2, product_title: 'Tee', variant_title: 'M' }], total_price: 4000 };
function okJson(body: unknown) {
  return { ok: true, json: async () => body } as unknown as Response;
}

describe('injectShopifyCartAttribute', () => {
  it('POSTs sm_visitor_id to /cart/update.js when on a Shopify storefront', async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: true });
    await injectShopifyCartAttribute({ visitorId: 'v_abc', platform: 'shopify', fetchFn });
    expect(fetchFn).toHaveBeenCalledWith(
      '/cart/update.js',
      expect.objectContaining({
        method: 'POST',
        credentials: 'same-origin',
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

describe('shopify Cart AJAX bridge', () => {
  it('adds a variant then VERIFIES via /cart.js before claiming success', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url === '/cart/add.js') return okJson({ id: 111 });
      if (url === '/cart.js') return okJson(CART);
      return okJson({});
    }) as unknown as typeof fetch;
    const r = await shopifyCartAdd('111', 2, fetchFn);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values).toMatchObject({ count: '2', subtotal: '40.00' });
    expect(fetchFn).toHaveBeenCalledWith('/cart/add.js', expect.objectContaining({ method: 'POST' }));
  });

  it('reports failure when the add did not actually land in the cart (verify-after)', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url === '/cart/add.js') return okJson({ id: 999 });
      if (url === '/cart.js') return okJson({ item_count: 0, items: [], total_price: 0 });
      return okJson({});
    }) as unknown as typeof fetch;
    const r = await shopifyCartAdd('999', 1, fetchFn);
    expect(r.ok).toBe(false);
  });

  it('rejects a non-numeric variant ref (must be a resolved variant id)', async () => {
    const fetchFn = vi.fn() as unknown as typeof fetch;
    expect(await shopifyCartAdd('green-mantra', 1, fetchFn)).toEqual({ ok: false, reason: 'not_found' });
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('reads the cart into count/items/subtotal values', async () => {
    const fetchFn = vi.fn(async () => okJson(CART)) as unknown as typeof fetch;
    const r = await shopifyCartGet(fetchFn);
    expect(r).toEqual({ ok: true, values: { count: '2', items: 'Tee M x2', subtotal: '40.00' } });
  });

  it('treats a 422 add (sold out) as not_found', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false }) as Response) as unknown as typeof fetch;
    expect(await shopifyCartAdd('111', 1, fetchFn)).toEqual({ ok: false, reason: 'not_found' });
  });

  it('clears the cart', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true }) as Response) as unknown as typeof fetch;
    expect(await shopifyCartClear(fetchFn)).toEqual({ ok: true });
  });

  it('applies a discount code via the /discount link', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true }) as Response) as unknown as typeof fetch;
    const r = await shopifyApplyCoupon('SAVE10', fetchFn);
    expect(r.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledWith('/discount/SAVE10', expect.objectContaining({ method: 'GET' }));
  });
});
