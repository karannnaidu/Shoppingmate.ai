import type { Merchant } from '@shoppingmate/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(),
  getProduct: vi.fn(),
}));

const fixedProduct = {
  sku: 'MUG-RED',
  title: 'Red Mug',
  imageUrl: 'https://example.com/red.jpg',
  priceCents: 1500,
  currency: 'USD',
  productUrl: 'https://example.com/p/red-mug',
  merchantId: 'm-1',
};

const merchant = {
  id: 'm-1',
  domain: 'example.com',
  adapterType: 'suggest',
  adapterConfig: {},
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
  checkoutUrl: 'https://example.com/checkout',
} as unknown as Merchant;

describe('SuggestAdapter', () => {
  beforeEach(async () => {
    const db = await import('@shoppingmate/db');
    (db.searchProducts as unknown as ReturnType<typeof vi.fn>).mockReset();
    (db.getProduct as unknown as ReturnType<typeof vi.fn>).mockReset();
    (db.searchProducts as unknown as ReturnType<typeof vi.fn>).mockResolvedValue([fixedProduct]);
    (db.getProduct as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (_mid: string, sku: string) => (sku === fixedProduct.sku ? fixedProduct : null),
    );
  });

  it('searchProducts returns catalog rows', async () => {
    const { SuggestAdapter } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const a = new SuggestAdapter(new FakeWSTransport());
    const r = await a.searchProducts({ merchant, cartToken: null, sessionId: 's' }, 'mug', 5);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value[0]?.sku).toBe('MUG-RED');
  });

  it('cartAdd emits ui.show_message + ui.show_product_card and returns placeholder', async () => {
    const { SuggestAdapter, SUGGEST_CART_STATE_PLACEHOLDER } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const t = new FakeWSTransport();
    t.ackAll({ ok: true });
    const a = new SuggestAdapter(t);
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 'sess-1' },
      'MUG-RED',
      null,
      1,
    );
    expect(r).toEqual({ kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER });
    const sent = t.sent('sess-1');
    expect(sent).toHaveLength(2);
    expect(sent[0]).toMatchObject({ type: 'ui.show_message' });
    expect(sent[0]?.type === 'ui.show_message' && sent[0].text).toContain('Red Mug');
    expect(sent[1]).toMatchObject({
      type: 'ui.show_product_card',
      product: {
        title: 'Red Mug',
        priceCents: 1500,
        productUrl: 'https://example.com/p/red-mug',
      },
    });
  });

  it('cartAdd returns unsupported when sku missing from catalog', async () => {
    const { SuggestAdapter } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const t = new FakeWSTransport();
    const a = new SuggestAdapter(t);
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 'sess-1' },
      'NOT-A-SKU',
      null,
      1,
    );
    expect(r).toEqual({ kind: 'unsupported', reason: 'product_not_in_catalog' });
    expect(t.sent('sess-1')).toEqual([]);
  });

  it('cartUpdate emits a message and returns placeholder', async () => {
    const { SuggestAdapter, SUGGEST_CART_STATE_PLACEHOLDER } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const t = new FakeWSTransport();
    t.ackAll({ ok: true });
    const a = new SuggestAdapter(t);
    const r = await a.cartUpdate({ merchant, cartToken: null, sessionId: 'sess-1' }, 'line-1', 2);
    expect(r).toEqual({ kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER });
    expect(t.sent('sess-1')[0]).toMatchObject({ type: 'ui.show_message' });
  });

  it('cartGet returns empty placeholder without sending anything', async () => {
    const { SuggestAdapter, SUGGEST_CART_STATE_EMPTY } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const t = new FakeWSTransport();
    const a = new SuggestAdapter(t);
    const r = await a.cartGet({ merchant, cartToken: null, sessionId: 'sess-1' });
    expect(r).toEqual({ kind: 'ok', value: SUGGEST_CART_STATE_EMPTY });
    expect(t.sent('sess-1')).toEqual([]);
  });

  it('couponApply narrates the code', async () => {
    const { SuggestAdapter, SUGGEST_CART_STATE_PLACEHOLDER } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const t = new FakeWSTransport();
    t.ackAll({ ok: true });
    const a = new SuggestAdapter(t);
    const r = await a.couponApply({ merchant, cartToken: null, sessionId: 'sess-1' }, 'SAVE10');
    expect(r).toEqual({ kind: 'ok', value: SUGGEST_CART_STATE_PLACEHOLDER });
    const sent = t.sent('sess-1');
    expect(sent[0]).toMatchObject({ type: 'ui.show_message' });
    expect(sent[0]?.type === 'ui.show_message' && sent[0].text).toContain('SAVE10');
  });

  it('checkoutUrl returns merchant.checkoutUrl when set', async () => {
    const { SuggestAdapter } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const a = new SuggestAdapter(new FakeWSTransport());
    const r = await a.checkoutUrl({ merchant, cartToken: null, sessionId: 's' });
    expect(r).toEqual({ kind: 'ok', value: 'https://example.com/checkout' });
  });

  it('checkoutUrl returns unsupported when merchant has no checkoutUrl', async () => {
    const { SuggestAdapter } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const a = new SuggestAdapter(new FakeWSTransport());
    const noCheckout = { ...merchant, checkoutUrl: null } as unknown as Merchant;
    const r = await a.checkoutUrl({ merchant: noCheckout, cartToken: null, sessionId: 's' });
    expect(r).toEqual({ kind: 'unsupported', reason: 'no_checkout_url' });
  });

  it('SUGGEST_CART_STATE_PLACEHOLDER is frozen and uses sentinel cartToken', async () => {
    const { SUGGEST_CART_STATE_PLACEHOLDER } = await import('../src/suggest.js');
    expect(Object.isFrozen(SUGGEST_CART_STATE_PLACEHOLDER)).toBe(true);
    expect(SUGGEST_CART_STATE_PLACEHOLDER.cartToken).toBe('suggest');
    expect(SUGGEST_CART_STATE_PLACEHOLDER.lines).toEqual([]);
  });

  it('exposes kind = "suggest"', async () => {
    const { SuggestAdapter } = await import('../src/suggest.js');
    const { FakeWSTransport } = await import('../src/dom/transport.js');
    const a = new SuggestAdapter(new FakeWSTransport());
    expect(a.kind).toBe('suggest');
  });
});
