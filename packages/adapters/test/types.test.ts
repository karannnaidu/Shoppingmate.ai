import { describe, expect, it } from 'vitest';
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from '../src/types.js';

describe('Adapter types', () => {
  it('AdapterResult has the three tagged variants', () => {
    const ok: AdapterResult<number> = { kind: 'ok', value: 1 };
    const err: AdapterResult<number> = { kind: 'platform_error', status: 500, body: 'x' };
    const un: AdapterResult<number> = { kind: 'unsupported', reason: 'r' };
    expect([ok.kind, err.kind, un.kind]).toEqual(['ok', 'platform_error', 'unsupported']);
  });

  it('CartState has expected fields', () => {
    const c: CartState = {
      cartToken: 't',
      lines: [],
      subtotalCents: 0,
      totalCents: 0,
      currency: 'USD',
      appliedCoupons: [],
    };
    expect(c.cartToken).toBe('t');
  });

  it('AdapterContext + CartLine + Adapter shapes are exported', () => {
    const line: CartLine = {
      lineId: 'l1',
      sku: 'sku',
      variantId: null,
      title: 't',
      qty: 1,
      unitPriceCents: 100,
      lineTotalCents: 100,
      currency: 'USD',
      imageUrl: null,
    };
    expect(line.qty).toBe(1);
    // Compile-only checks for AdapterContext + Adapter:
    const _ctxType: AdapterContext | undefined = undefined;
    const _adapterType: Adapter | undefined = undefined;
    expect(_ctxType).toBeUndefined();
    expect(_adapterType).toBeUndefined();
  });
});
