import type { Adapter, AdapterResult } from '@shoppingmate/adapters';
import type { Merchant, Product } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { type RunTurnDeps, resolveShopifyVariantId } from './runtime.js';

const ok = <T>(v: T): AdapterResult<T> => ({ kind: 'ok', value: v });

function prod(variants: unknown, sku = 'the-handle'): Product {
  return { merchantId: 'm', sku, title: 'T', productUrl: '/p', variants } as unknown as Product;
}

function deps(adapter: Partial<Adapter>): RunTurnDeps {
  return {
    loadAdapter: () =>
      ({
        kind: 'shopify',
        searchProducts: async () => ok([]),
        getProduct: async () => ok(null),
        cartAdd: async () => ok({} as never),
        cartUpdate: async () => ok({} as never),
        cartGet: async () => ok({} as never),
        couponApply: async () => ok({} as never),
        checkoutUrl: async () => ok('x'),
        ...adapter,
      }) as unknown as Adapter,
  } as unknown as RunTurnDeps;
}

const merchant = { id: 'm', platform: 'shopify' } as unknown as Merchant;
const session = { sessionId: 's', cartToken: null } as never;

describe('resolveShopifyVariantId — the Shopify cart.add safety net', () => {
  it('passes a numeric variant id straight through without a catalog lookup', async () => {
    let looked = false;
    const d = deps({
      getProduct: async () => {
        looked = true;
        return ok(null);
      },
    });
    expect(await resolveShopifyVariantId(d, merchant, session, '44551122')).toBe('44551122');
    expect(looked).toBe(false);
  });

  it('resolves a handle/sku via getProduct to a numeric variant id', async () => {
    const d = deps({
      getProduct: async () => ok(prod([{ id: '999', sku: 'A-1', options: {} }])),
    });
    expect(await resolveShopifyVariantId(d, merchant, session, 'the-handle')).toBe('999');
  });

  it('picks the right multi-variant by option value via search when getProduct misses', async () => {
    const d = deps({
      getProduct: async () => ok(null),
      searchProducts: async () =>
        ok([
          prod(
            [
              { id: '201', sku: 'TEE-S', options: { option1: 'Small' } },
              { id: '202', sku: 'TEE-L', options: { option1: 'Large' } },
            ],
            'tee',
          ),
        ]),
    });
    expect(await resolveShopifyVariantId(d, merchant, session, 'Large')).toBe('202');
  });

  it('returns null when nothing resolves (leaves the original ref)', async () => {
    const d = deps({ getProduct: async () => ok(null), searchProducts: async () => ok([]) });
    expect(await resolveShopifyVariantId(d, merchant, session, 'nope')).toBeNull();
  });
});
