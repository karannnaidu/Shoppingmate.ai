import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it, vi } from 'vitest';
import { BigCommerceAdapter } from '../src/bigcommerce.js';
import { getAdapter } from '../src/dispatch.js';
import { DOMAdapter } from '../src/dom/index.js';
import { InMemorySessionState } from '../src/dom/sessionState.js';
import { FakeWSTransport } from '../src/dom/transport.js';
import { implementedAdapters } from '../src/implementedAdapters.js';
import { MagentoAdapter } from '../src/magento.js';
import { ShopifyAdapter } from '../src/shopify.js';
import { SquarespaceAdapter } from '../src/squarespace.js';
import { SuggestAdapter } from '../src/suggest.js';
import type { Adapter } from '../src/types.js';
import { WixAdapter } from '../src/wix.js';
import { WooAdapter } from '../src/woo.js';

vi.mock('@shoppingmate/db', () => ({
  searchProducts: vi.fn(async () => []),
  getProduct: vi.fn(async () => null),
  selectorCacheRepo: {
    get: vi.fn(async () => null),
    put: vi.fn(),
    upsertHealed: vi.fn(),
    markOverrideFailing: vi.fn(),
    markPassed: vi.fn(),
  },
}));

const adapters: Adapter[] = [
  new ShopifyAdapter(),
  new WooAdapter(),
  new MagentoAdapter(),
  new BigCommerceAdapter(),
  new WixAdapter(),
  new SquarespaceAdapter(),
  new DOMAdapter(new FakeWSTransport(), new InMemorySessionState()),
  new SuggestAdapter(new FakeWSTransport()),
];

describe.each(adapters)('Adapter contract — $kind', (a) => {
  it('exposes kind', () => {
    expect(typeof a.kind).toBe('string');
  });
  it('every Adapter method is a function', () => {
    for (const m of [
      'searchProducts',
      'getProduct',
      'cartAdd',
      'cartUpdate',
      'cartGet',
      'couponApply',
      'checkoutUrl',
    ] as const) {
      expect(typeof (a as unknown as Record<string, unknown>)[m]).toBe('function');
    }
  });
});

describe('contract — implementedAdapters in sync with concrete adapters', () => {
  it('every implemented type instantiates via getAdapter', () => {
    for (const t of implementedAdapters) {
      const merchant = {
        id: 'SM-T01',
        domain: 'example.com',
        adapterType: t,
        adapterConfig: {},
        status: 'live',
        installedAt: new Date(),
        personaId: 'concierge',
        allowedDomains: [],
      } as unknown as Merchant;
      const deps =
        t === 'dom' || t === 'suggest'
          ? { transport: new FakeWSTransport(), state: new InMemorySessionState() }
          : undefined;
      expect(getAdapter(merchant, deps).kind).toBe(t);
    }
  });

  it('contract test covers every implemented adapter', () => {
    const covered = new Set(adapters.map((a) => a.kind));
    for (const t of implementedAdapters) {
      expect(covered.has(t)).toBe(true);
    }
  });
});
