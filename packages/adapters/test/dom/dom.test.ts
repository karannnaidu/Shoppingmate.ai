import type { Merchant, Product, SelectorCacheRow, SelectorSource } from '@shoppingmate/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// In-memory selector_cache + getProduct/searchProducts stubs.
type Row = {
  merchantId: string;
  pageTemplateHash: string;
  selectorKey: string;
  resolvedSelector: string;
  source: SelectorSource;
  locked: boolean;
  lastTestedAt: Date | null;
  lastTestPassed: boolean | null;
  overrideLockedAt: Date | null;
  suggestedReplacement: string | null;
  alertSentAt: Date | null;
};

const cacheStore = new Map<string, Row>();
const ck = (m: string, h: string, sk: string): string => `${m}|${h}|${sk}`;

const productByMerchantSku = new Map<string, Product>();
const productKey = (m: string, sku: string): string => `${m}|${sku}`;

const getProductMock = vi.fn(async (m: string, sku: string): Promise<Product | null> => {
  return productByMerchantSku.get(productKey(m, sku)) ?? null;
});

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => []),
  getProduct: getProductMock,
  selectorCacheRepo: {
    async get(m: string, h: string, sk: string): Promise<SelectorCacheRow | null> {
      return (cacheStore.get(ck(m, h, sk)) as unknown as SelectorCacheRow) ?? null;
    },
    async put(
      m: string,
      h: string,
      sk: string,
      sel: string,
      source: SelectorSource,
    ): Promise<void> {
      const now = new Date();
      cacheStore.set(ck(m, h, sk), {
        merchantId: m,
        pageTemplateHash: h,
        selectorKey: sk,
        resolvedSelector: sel,
        source,
        locked: source === 'merchant_override',
        lastTestedAt: now,
        lastTestPassed: null,
        overrideLockedAt: source === 'merchant_override' ? now : null,
        suggestedReplacement: null,
        alertSentAt: null,
      });
    },
    async upsertHealed(m: string, h: string, sk: string, sel: string): Promise<void> {
      const existing = cacheStore.get(ck(m, h, sk));
      if (existing?.source === 'merchant_override') return;
      const now = new Date();
      cacheStore.set(ck(m, h, sk), {
        merchantId: m,
        pageTemplateHash: h,
        selectorKey: sk,
        resolvedSelector: sel,
        source: 'llm_resolved',
        locked: false,
        lastTestedAt: now,
        lastTestPassed: true,
        overrideLockedAt: null,
        suggestedReplacement: null,
        alertSentAt: null,
      });
    },
    async markOverrideFailing(
      m: string,
      h: string,
      sk: string,
      suggestion: string | null,
    ): Promise<void> {
      const existing = cacheStore.get(ck(m, h, sk));
      if (!existing) return;
      existing.lastTestPassed = false;
      existing.lastTestedAt = new Date();
      existing.suggestedReplacement = suggestion;
    },
    async markPassed(m: string, h: string, sk: string): Promise<void> {
      const existing = cacheStore.get(ck(m, h, sk));
      if (!existing) return;
      existing.lastTestPassed = true;
      existing.lastTestedAt = new Date();
    },
  },
}));

const merchant = {
  id: 'SM-DOM',
  domain: 'custom.example.com',
  adapterType: 'dom',
  adapterConfig: {
    selectors: {
      add_to_cart_button: '#add',
      qty_input: '[name=qty]',
      cart_url: '/cart',
      cart_page_total: '.cart-total',
      checkout_button: '#checkout',
      coupon_field: '#coupon',
      coupon_apply_button: '#apply-coupon',
      line_item_remove_button: '.remove',
    },
    page_templates: { product: 'p1', cart: 'c1' },
  },
  status: 'live',
  installedAt: new Date(),
  personaId: 'concierge',
  allowedDomains: [],
} as unknown as Merchant;

const fakeProduct: Product = {
  merchantId: 'SM-DOM',
  sku: 'TEE',
  title: 'Tee',
  description: null,
  imageUrl: null,
  productUrl: 'https://custom.example.com/products/tee',
  variants: [],
  priceCents: 1999,
  currency: 'USD',
  inStock: true,
  indexedAt: new Date(),
  source: 'manual',
  sourceMeta: null,
  searchVector: '',
} as unknown as Product;

beforeEach(() => {
  cacheStore.clear();
  productByMerchantSku.clear();
  productByMerchantSku.set(productKey('SM-DOM', 'TEE'), fakeProduct);
});

describe('DOMAdapter — cartAdd', () => {
  it('runs nav→fill→click→wait_for→read sequence', async () => {
    const { DOMAdapter } = await import('../../src/dom/index.js');
    const { FakeWSTransport } = await import('../../src/dom/transport.js');
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');

    const t = new FakeWSTransport();
    t.scriptMany([
      { ok: true }, // 1. navigate
      { ok: true }, // 2. fill qty
      { ok: true }, // 3. click add
      { ok: true }, // 4. wait_for
      { ok: true, value: '$19.99' }, // 5. read total
    ]);
    const a = new DOMAdapter(t, new InMemorySessionState());
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's1' }, 'TEE', null, 1);
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.value.totalCents).toBe(1999);
      expect(r.value.lines[0]?.sku).toBe('TEE');
    }
  });

  it('returns unsupported when product not in catalog', async () => {
    const { DOMAdapter } = await import('../../src/dom/index.js');
    const { FakeWSTransport } = await import('../../src/dom/transport.js');
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const a = new DOMAdapter(new FakeWSTransport(), new InMemorySessionState());
    const r = await a.cartAdd(
      { merchant, cartToken: null, sessionId: 's-na' },
      'UNKNOWN-SKU',
      null,
      1,
    );
    expect(r).toEqual({ kind: 'unsupported', reason: 'product_not_in_catalog' });
  });

  it('heals when add_to_cart_button selector returns selector_not_found', async () => {
    const { DOMAdapter } = await import('../../src/dom/index.js');
    const { FakeWSTransport } = await import('../../src/dom/transport.js');
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const { selectorCacheRepo } = await import('@shoppingmate/db');

    const t = new FakeWSTransport();
    t.scriptMany([
      { ok: true }, // 1. navigate
      { ok: true }, // 2. fill qty
      { ok: false, reason: 'selector_not_found', html: '<button id="real-buy">Buy</button>' }, // 3. click fails
      { ok: true }, // 4. retry click after heal
      { ok: true }, // 5. wait_for
      { ok: true, value: '$19.99' }, // 6. read total
    ]);
    const llm = vi.fn(async () => '#real-buy');
    const a = new DOMAdapter(t, new InMemorySessionState(), llm);
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's2' }, 'TEE', null, 1);
    expect(r.kind).toBe('ok');
    expect(llm).toHaveBeenCalledTimes(1);
    const cached = await selectorCacheRepo.get('SM-DOM', 'p1', 'add_to_cart_button');
    expect(cached?.source).toBe('llm_resolved');
    expect(cached?.resolvedSelector).toBe('#real-buy');
  });

  it('returns unsupported when thisTurn cap reached', async () => {
    const { DOMAdapter } = await import('../../src/dom/index.js');
    const { FakeWSTransport } = await import('../../src/dom/transport.js');
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const state = new InMemorySessionState();
    for (let i = 0; i < 50; i++) await state.incrAction('s3', 'session');
    const a = new DOMAdapter(new FakeWSTransport(), state);
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's3' }, 'TEE', null, 1);
    expect(r).toEqual({ kind: 'unsupported', reason: 'action_cap' });
  });

  it('returns platform_error when navigate ack fails', async () => {
    const { DOMAdapter } = await import('../../src/dom/index.js');
    const { FakeWSTransport } = await import('../../src/dom/transport.js');
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const t = new FakeWSTransport();
    t.scriptOnce({ ok: false, reason: 'navigate_blocked' });
    const a = new DOMAdapter(t, new InMemorySessionState());
    const r = await a.cartAdd({ merchant, cartToken: null, sessionId: 's-nav' }, 'TEE', null, 1);
    expect(r.kind).toBe('platform_error');
  });
});

describe('DOMAdapter — reads', () => {
  it('searchProducts delegates to repo', async () => {
    const { DOMAdapter } = await import('../../src/dom/index.js');
    const { FakeWSTransport } = await import('../../src/dom/transport.js');
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const a = new DOMAdapter(new FakeWSTransport(), new InMemorySessionState());
    const r = await a.searchProducts({ merchant, cartToken: null, sessionId: 's' }, 'tee');
    expect(r.kind).toBe('ok');
  });

  it('getProduct delegates to repo', async () => {
    const { DOMAdapter } = await import('../../src/dom/index.js');
    const { FakeWSTransport } = await import('../../src/dom/transport.js');
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const a = new DOMAdapter(new FakeWSTransport(), new InMemorySessionState());
    const r = await a.getProduct({ merchant, cartToken: null, sessionId: 's' }, 'TEE');
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value?.sku).toBe('TEE');
  });

  it('checkoutUrl returns deterministic url when checkout_button selector is configured', async () => {
    const { DOMAdapter } = await import('../../src/dom/index.js');
    const { FakeWSTransport } = await import('../../src/dom/transport.js');
    const { InMemorySessionState } = await import('../../src/dom/sessionState.js');
    const a = new DOMAdapter(new FakeWSTransport(), new InMemorySessionState());
    const r = await a.checkoutUrl({ merchant, cartToken: null, sessionId: 's' });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect(r.value).toBe('https://custom.example.com/cart');
  });
});
