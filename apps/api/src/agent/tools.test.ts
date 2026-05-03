import type {
  Adapter,
  AdapterContext,
  AdapterResult,
  CartState,
  Product,
} from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { buildToolSurface, dispatchTool } from './tools.js';

const merchant = { adapterType: 'shopify' } as unknown as Merchant;

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
