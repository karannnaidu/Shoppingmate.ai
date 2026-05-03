import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it, vi } from 'vitest';
import { getAdapter } from '../src/dispatch.js';
import { InMemorySessionState } from '../src/dom/sessionState.js';
import { FakeWSTransport } from '../src/dom/transport.js';
import { implementedAdapters } from '../src/implementedAdapters.js';

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

const stubMerchant = (adapterType: string): Merchant =>
  ({
    id: 'SM-T01',
    domain: 'example.com',
    adapterType,
    adapterConfig: {},
    status: 'live',
    installedAt: new Date(),
    personaId: 'concierge',
    allowedDomains: [],
  }) as unknown as Merchant;

describe('getAdapter', () => {
  it.each([
    ['shopify', 'shopify'],
    ['woo', 'woo'],
    ['magento', 'magento'],
    ['bigcommerce', 'bigcommerce'],
    ['wix', 'wix'],
    ['squarespace', 'squarespace'],
  ])('returns kind=%s for adapterType=%s', (kind, type) => {
    expect(getAdapter(stubMerchant(type)).kind).toBe(kind);
  });

  it('returns DOMAdapter when adapterType=dom and deps provided', () => {
    const a = getAdapter(stubMerchant('dom'), {
      transport: new FakeWSTransport(),
      state: new InMemorySessionState(),
    });
    expect(a.kind).toBe('dom');
  });

  it('throws when adapterType=dom but no deps provided', () => {
    expect(() => getAdapter(stubMerchant('dom'))).toThrow(/dom_adapter_requires_transport/);
  });

  it('returns SuggestAdapter when adapterType=suggest and deps provided', () => {
    const a = getAdapter(stubMerchant('suggest'), {
      transport: new FakeWSTransport(),
      state: new InMemorySessionState(),
    });
    expect(a.kind).toBe('suggest');
  });

  it('throws when adapterType=suggest but no deps provided', () => {
    expect(() => getAdapter(stubMerchant('suggest'))).toThrow(/suggest_adapter_requires_transport/);
  });
});

describe('implementedAdapters', () => {
  it('contains all platforms 3e wired', () => {
    expect(implementedAdapters.has('magento')).toBe(true);
    expect(implementedAdapters.has('bigcommerce')).toBe(true);
    expect(implementedAdapters.has('wix')).toBe(true);
    expect(implementedAdapters.has('squarespace')).toBe(true);
    expect(implementedAdapters.has('dom')).toBe(true);
    expect(implementedAdapters.has('suggest')).toBe(true);
  });
});
