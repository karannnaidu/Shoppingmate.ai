import { FakeWSTransport, InMemorySessionState, getAdapter } from '@shoppingmate/adapters';
import type { AdapterType, Merchant } from '@shoppingmate/db';
import { describe, expect, it, vi } from 'vitest';
import { dispatchTool } from '../../apps/api/src/agent/tools.js';

vi.mock('@shoppingmate/db', async (orig) => {
  const actual = await orig<typeof import('@shoppingmate/db')>();
  return {
    ...actual,
    searchProducts: vi.fn(async () => []),
    getProduct: vi.fn(async () => null),
    selectorCacheRepo: {
      get: vi.fn(async () => null),
      put: vi.fn(),
      upsertHealed: vi.fn(),
      markOverrideFailing: vi.fn(),
      markPassed: vi.fn(),
    },
  };
});

const types: AdapterType[] = [
  'shopify',
  'woo',
  'magento',
  'bigcommerce',
  'wix',
  'squarespace',
  'dom',
  'suggest',
];

const validErrorKinds = new Set(['unsupported', 'platform_error', 'not_found', 'retry_exhausted']);

describe('contract: tool envelope round-trip across all 8 adapter types', () => {
  for (const t of types) {
    it(`${t} returns a valid envelope for products.search`, async () => {
      const merchant = {
        id: 'm',
        adapterType: t,
        domain: 'x.test',
        adapterConfig: {},
        allowedDomains: [],
        status: 'live',
        personaId: 'concierge',
      } as unknown as Merchant;

      const deps =
        t === 'dom' || t === 'suggest'
          ? { transport: new FakeWSTransport(), state: new InMemorySessionState() }
          : undefined;
      const adapter = getAdapter(merchant, deps);

      const r = await dispatchTool(
        adapter,
        { merchant, cartToken: null, sessionId: 's-1' },
        'products.search',
        { query: 'anything' },
      );

      expect(typeof r.ok).toBe('boolean');
      if (!r.ok) {
        expect(validErrorKinds.has(r.kind)).toBe(true);
      }
    });
  }
});
