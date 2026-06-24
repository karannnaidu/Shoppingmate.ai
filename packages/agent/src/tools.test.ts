import type {
  Adapter,
  AdapterContext,
  AdapterResult,
  CartState,
  Product,
} from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { buildToolSurface, dispatchTool, normalizeCalmosisSku } from './tools.js';

const merchant = { adapterType: 'shopify' } as unknown as Merchant;

describe('normalizeCalmosisSku()', () => {
  it('passes through the exact canonical SKUs', () => {
    for (const sku of ['peace-mantra', 'sleep-mantra', 'green-mantra', 'dog-mantra', 'bliss-club']) {
      expect(normalizeCalmosisSku(sku)).toBe(sku);
    }
  });

  it('coerces loose model phrasings the hook would otherwise reject', () => {
    expect(normalizeCalmosisSku('green')).toBe('green-mantra');
    expect(normalizeCalmosisSku('Green Mantra')).toBe('green-mantra');
    expect(normalizeCalmosisSku('green mantra')).toBe('green-mantra');
    expect(normalizeCalmosisSku('greenmantra')).toBe('green-mantra');
    expect(normalizeCalmosisSku('green_mantra')).toBe('green-mantra');
    expect(normalizeCalmosisSku('  PEACE  ')).toBe('peace-mantra');
    expect(normalizeCalmosisSku('bliss club')).toBe('bliss-club');
    expect(normalizeCalmosisSku('blissclub')).toBe('bliss-club');
  });

  it('leaves a genuinely unknown reference unchanged (hook will reject honestly)', () => {
    expect(normalizeCalmosisSku('gift-card')).toBe('gift-card');
    expect(normalizeCalmosisSku('')).toBe('');
  });
});

describe('buildToolSurface()', () => {
  it('returns six tools with dot-namespaced names', () => {
    const tools = buildToolSurface(merchant);
    const names = tools.map((t) => t.function.name);
    expect(names).toEqual([
      'products.search',
      'products.get',
      'cart.add',
      'cart.update',
      'cart.get',
      'coupons.apply',
      'checkout.url',
    ]);
  });

  it('each tool has a JSON-Schema parameters object', () => {
    for (const t of buildToolSurface(merchant)) {
      expect(t.type).toBe('function');
      expect(t.function.parameters).toMatchObject({
        type: 'object',
        properties: expect.any(Object),
      });
    }
  });

  it('products.search requires query', () => {
    const t = buildToolSurface(merchant).find((x) => x.function.name === 'products.search');
    expect(t?.function.parameters).toMatchObject({
      properties: { query: { type: 'string' } },
      required: ['query'],
    });
  });

  it('cart.add requires sku and qty (variantId nullable)', () => {
    const t = buildToolSurface(merchant).find((x) => x.function.name === 'cart.add');
    expect(t?.function.parameters).toMatchObject({
      required: ['sku', 'qty'],
    });
  });

  it('Shopify storefront merchant gets host-action cart tools (variantId), native checkout, NO adapter cart or Calmosis-bespoke tools', () => {
    const shop = {
      id: 'SM-SHOP01',
      platform: 'shopify',
      adapterType: 'shopify',
      siteGraphEnabled: true,
    } as unknown as Merchant;
    const tools = buildToolSurface(shop);
    const names = tools.map((t) => t.function.name);
    // Host-action cart tools present + native checkout + nav + product search.
    expect(names).toEqual(
      expect.arrayContaining(['products.search', 'products.get', 'checkout.url', 'site.navigate', 'cart.add', 'cart.update', 'cart.clear', 'coupon.apply']),
    );
    // cart.add is the host-action variant (keyed by variantId, not the adapter sku/lineId one).
    const cartAdd = tools.find((t) => t.function.name === 'cart.add');
    expect(cartAdd?.function.parameters).toMatchObject({ required: ['variantId'] });
    // Calmosis-bespoke tools must NOT leak to other brands.
    expect(names).not.toContain('checkout.fill');
    expect(names).not.toContain('checkout.place');
    expect(names).not.toContain('checkout.state');
    expect(names).not.toContain('consultation.request');
    expect(names).not.toContain('page.fill');
    // Only one cart.add (no duplicate adapter + host-action versions).
    expect(names.filter((n) => n === 'cart.add')).toHaveLength(1);
  });

  it('omits cart-mutation tools for dom adapters (cart.add there fakes success)', () => {
    // Regression for 2026-06-08 Calmosis report: dom cart.add ran through a
    // no-op transport and lied ("added to cart"). Drop the cart tools so the
    // model navigates to the PDP instead of claiming a fake add.
    const dom = { adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;
    const names = buildToolSurface(dom).map((t) => t.function.name);
    expect(names).not.toContain('cart.add');
    expect(names).not.toContain('cart.update');
    expect(names).not.toContain('cart.get');
    expect(names).not.toContain('coupons.apply');
    // products + checkout + navigation survive.
    expect(names).toEqual(['products.search', 'products.get', 'checkout.url', 'site.navigate']);
  });

  it('omits cart-mutation tools for suggest adapters too', () => {
    const sug = { adapterType: 'suggest' } as unknown as Merchant;
    const names = buildToolSurface(sug).map((t) => t.function.name);
    expect(names).not.toContain('cart.add');
    expect(names).toEqual(['products.search', 'products.get', 'checkout.url']);
  });

  it('Calmosis (SM-2SCCLZ) gets cart.add/update + coupon.apply (host actions) + site.navigate', () => {
    const calmosis = { id: 'SM-2SCCLZ', adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;
    const names = buildToolSurface(calmosis).map((t) => t.function.name);
    expect(names).toContain('cart.add'); // host action → __shoppingmateCartAdd__
    expect(names).toContain('cart.update'); // host action → __shoppingmateCartSetQty__ (qty 0 = remove)
    expect(names).toContain('coupon.apply'); // host action → __shoppingmateApplyCoupon__
    expect(names).toContain('site.navigate');
    expect(names).not.toContain('coupons.apply'); // the faked adapter coupon tool stays off
  });

  it('keeps cart tools for API-backed adapters (shopify)', () => {
    const names = buildToolSurface(merchant).map((t) => t.function.name);
    expect(names).toContain('cart.add');
    expect(names).toContain('coupons.apply');
  });

  it('exposes consultation.request only on the Calmosis surface', () => {
    const calmosis = { id: 'SM-2SCCLZ', adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;
    expect(buildToolSurface(calmosis).map((t) => t.function.name)).toContain('consultation.request');

    const otherSiteGraph = { id: 'M-OTHER', adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;
    expect(buildToolSurface(otherSiteGraph).map((t) => t.function.name)).not.toContain('consultation.request');
  });

  it('Calmosis surface includes page.fill / page.read / page.click', () => {
    const calmosis = { id: 'SM-2SCCLZ', adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;
    const names = buildToolSurface(calmosis).map((t) => t.function.name);
    expect(names).toContain('page.fill');
    expect(names).toContain('page.read');
    expect(names).toContain('page.click');
  });

  it('exposes checkout.fill + checkout.place only on the Calmosis surface', () => {
    const calmosis = { id: 'SM-2SCCLZ', adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;
    const names = buildToolSurface(calmosis).map((t) => t.function.name);
    expect(names).toContain('checkout.state');
    expect(names).toContain('checkout.fill');
    expect(names).toContain('checkout.place');

    const otherSiteGraph = { id: 'M-OTHER', adapterType: 'dom', siteGraphEnabled: true } as unknown as Merchant;
    const otherNames = buildToolSurface(otherSiteGraph).map((t) => t.function.name);
    expect(otherNames).not.toContain('checkout.fill');
    expect(otherNames).not.toContain('checkout.place');
  });
});

function makeAdapter(overrides: Partial<Adapter> = {}): Adapter {
  const ok = <T>(v: T): AdapterResult<T> => ({ kind: 'ok', value: v });
  const stub: Adapter = {
    kind: 'shopify',
    searchProducts: async () => ok([]),
    getProduct: async () => ok(null),
    cartAdd: async () => ok({} as CartState),
    cartUpdate: async () => ok({} as CartState),
    cartGet: async () => ok({} as CartState),
    couponApply: async () => ok({} as CartState),
    checkoutUrl: async () => ok('https://x.test/checkout'),
    ...overrides,
  };
  return stub;
}

const ctx: AdapterContext = {
  merchant: { id: 'm', adapterType: 'shopify' } as never,
  cartToken: null,
  sessionId: 's',
};

describe('dispatchTool()', () => {
  it('routes products.search to adapter.searchProducts and wraps ok result', async () => {
    const products = [{ sku: 'A', title: 'A', merchantId: 'm', productUrl: '/a' }] as Product[];
    const adapter = makeAdapter({ searchProducts: async () => ({ kind: 'ok', value: products }) });
    const r = await dispatchTool(adapter, ctx, 'products.search', { query: 'foo' });
    expect(r).toEqual({ ok: true, value: products });
  });

  it('routes cart.add and converts platform_error to envelope', async () => {
    const adapter = makeAdapter({
      cartAdd: async () => ({ kind: 'platform_error', status: 503, body: 'oops' }),
    });
    const r = await dispatchTool(adapter, ctx, 'cart.add', { sku: 'A', variantId: null, qty: 1 });
    expect(r).toEqual({ ok: false, kind: 'platform_error', status: 503, body: 'oops' });
  });

  it('converts unsupported into envelope', async () => {
    const adapter = makeAdapter({
      cartAdd: async () => ({ kind: 'unsupported', reason: 'product_not_in_catalog' }),
    });
    const r = await dispatchTool(adapter, ctx, 'cart.add', { sku: 'A', qty: 1 });
    expect(r).toEqual({ ok: false, kind: 'unsupported', reason: 'product_not_in_catalog' });
  });

  it('rejects unknown tool names', async () => {
    const r = await dispatchTool(makeAdapter(), ctx, 'fake.tool', {});
    expect(r).toEqual({ ok: false, kind: 'unsupported', reason: 'unknown_tool' });
  });

  it('treats empty search result as not_found envelope', async () => {
    const adapter = makeAdapter({ searchProducts: async () => ({ kind: 'ok', value: [] }) });
    const r = await dispatchTool(adapter, ctx, 'products.search', { query: 'nonexistent' });
    expect(r).toEqual({ ok: false, kind: 'not_found', query: 'nonexistent' });
  });
});

describe('buildToolSurface (demo-merchant gate)', () => {
  it('exposes site.* + pricing.quote tools only when merchant.id === SHOPPINGMATE_DEMO_MERCHANT_ID', () => {
    const demo = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as unknown as Merchant;
    const tools = buildToolSurface(demo);
    const names = tools.map((t) => t.function.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'site.navigate',
        'site.scroll_to',
        'site.highlight',
        'site.click',
        'pricing.quote',
      ]),
    );
  });

  it('hides site.* + pricing.quote from non-demo merchants', () => {
    const real = { id: 'M-FOO123', name: 'Real Brand', domain: 'real.example' } as unknown as Merchant;
    const tools = buildToolSurface(real);
    const names = tools.map((t) => t.function.name);
    expect(names).not.toEqual(expect.arrayContaining(['site.navigate']));
    expect(names).not.toEqual(expect.arrayContaining(['pricing.quote']));
  });
});

describe('dispatchTool (Bucket B tools)', () => {
  it('pricing.quote returns the canonical speech string for Starter', async () => {
    const fakeAdapter = {} as unknown as Adapter;
    const fakeCtx = {} as unknown as AdapterContext;
    const r = await dispatchTool(fakeAdapter, fakeCtx, 'pricing.quote', { plan_id: 'starter' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v = r.value as { speech: string; planId: string; card: { name: string } };
      expect(v.speech).toBe(
        'Starter is thirty dollars per month for one hundred conversations.',
      );
      expect(v.planId).toBe('starter');
      expect(v.card.name).toBe('Starter');
    }
  });

  it('pricing.quote returns not_found for an unknown plan', async () => {
    const r = await dispatchTool(
      {} as unknown as Adapter,
      {} as unknown as AdapterContext,
      'pricing.quote',
      { plan_id: 'mystery' },
    );
    expect(r.ok).toBe(false);
  });
});
