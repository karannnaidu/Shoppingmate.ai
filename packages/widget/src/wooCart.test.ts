import { afterEach, describe, expect, it, vi } from 'vitest';
import { executeHostAction, setHostPlatform } from './host/actions.js';
import { refreshShopifySections, shopifyProductLookup } from './shopifyCart.js';
import { resetWooNonce, wooCartAdd, wooCartSetQty } from './wooCart.js';

afterEach(() => {
  resetWooNonce();
  setHostPlatform(null);
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

// Minimal fake WooCommerce Store API with a server-side cart.
function fakeWoo(opts: { failAdd?: boolean } = {}) {
  const items: Array<{ key: string; id: number; quantity: number; name: string }> = [];
  const calls: Array<{ url: string; nonce: string | null }> = [];
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const h = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ url, nonce: h.Nonce ?? null });
    const json = (body: unknown) =>
      new Response(JSON.stringify(body), { status: 200, headers: { Nonce: 'n-123' } });
    if (url.endsWith('/cart') && !init?.method) {
      return json({
        items,
        items_count: items.reduce((a, i) => a + i.quantity, 0),
        totals: { total_price: '64900', currency_minor_unit: 2 },
      });
    }
    const body = JSON.parse(String(init?.body ?? '{}'));
    if (url.endsWith('/cart/add-item')) {
      if (opts.failAdd) return json({});
      const ex = items.find((i) => i.id === body.id);
      if (ex) ex.quantity += body.quantity;
      else items.push({ key: `k${body.id}`, id: body.id, quantity: body.quantity, name: 'Tee' });
      return json({});
    }
    if (url.endsWith('/cart/update-item')) {
      const it = items.find((i) => i.key === body.key);
      if (it) it.quantity = body.quantity;
      return json({});
    }
    if (url.endsWith('/cart/remove-item')) {
      const idx = items.findIndex((i) => i.key === body.key);
      if (idx >= 0) items.splice(idx, 1);
      return json({});
    }
    return new Response('{}', { status: 404 });
  });
  return { fetchFn, calls, items };
}

describe('WooCommerce Store API bridge', () => {
  it('adds with the nonce and verifies the cart actually changed', async () => {
    const w = fakeWoo();
    const r = await wooCartAdd('42', 2, w.fetchFn as unknown as typeof fetch);
    expect(r).toMatchObject({ ok: true, channel: 'woo-store-api', verified: true });
    if (r.ok) expect(r.values?.count).toBe('2');
    const add = w.calls.find((c) => c.url.endsWith('/add-item'));
    expect(add?.nonce).toBe('n-123');
  });

  it('reports failure when the add did not land (verify-after-write)', async () => {
    const w = fakeWoo({ failAdd: true });
    const r = await wooCartAdd('42', 1, w.fetchFn as unknown as typeof fetch);
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('sets an exact quantity and removes at 0', async () => {
    const w = fakeWoo();
    await wooCartAdd('7', 1, w.fetchFn as unknown as typeof fetch);
    expect(await wooCartSetQty('7', 3, w.fetchFn as unknown as typeof fetch)).toMatchObject({
      ok: true,
    });
    expect(w.items[0]?.quantity).toBe(3);
    expect(await wooCartSetQty('7', 0, w.fetchFn as unknown as typeof fetch)).toMatchObject({
      ok: true,
    });
    expect(w.items).toHaveLength(0);
  });

  it('host actions route to Woo when the platform is woocommerce', async () => {
    const w = fakeWoo();
    vi.spyOn(globalThis, 'fetch').mockImplementation(w.fetchFn as unknown as typeof fetch);
    setHostPlatform('woocommerce');
    const r = await executeHostAction({ type: 'cart_add', sku: '9', qty: 1 });
    expect(r).toMatchObject({ ok: true, channel: 'woo-store-api' });
    const g = await executeHostAction({ type: 'cart_get' });
    expect(g).toMatchObject({ ok: true, channel: 'woo-store-api' });
  });
});

describe('Shopify additions', () => {
  it('product lookup reports variants with stock', async () => {
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            title: 'Classic Tee',
            available: true,
            variants: [
              { id: 11, title: 'S', available: true, price: 2500 },
              { id: 12, title: 'M', available: false, price: 2500 },
            ],
          }),
        ),
    );
    const r = await shopifyProductLookup(
      '/products/classic-tee',
      fetchFn as unknown as typeof fetch,
    );
    expect(fetchFn).toHaveBeenCalledWith('/products/classic-tee.js', expect.anything());
    expect(r).toMatchObject({ ok: true, channel: 'shopify-ajax' });
    if (r.ok) expect(r.values?.variants).toContain('M (variantId 12, SOLD OUT');
  });

  it('refreshes Dawn-style cart sections via the Section Rendering API', async () => {
    document.body.innerHTML = '<div id="shopify-section-cart-icon-bubble"><span>0</span></div>';
    const fetchFn = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            'cart-icon-bubble': '<div id="shopify-section-cart-icon-bubble"><span>3</span></div>',
          }),
        ),
    );
    const n = await refreshShopifySections(fetchFn as unknown as typeof fetch);
    expect(n).toBe(1);
    expect(document.getElementById('shopify-section-cart-icon-bubble')?.textContent).toBe('3');
  });
});
