import { describe, expect, it } from 'vitest';
import { createStore } from '../state/store.js';
import { pageLabel, receiptFor } from './receipts.js';

describe('action receipts', () => {
  it('describes real outcomes in shopper words', () => {
    expect(receiptFor({ type: 'cart_add', sku: 'sleep-mantra', qty: 1 }, { ok: true })).toEqual({
      text: 'Added Sleep Mantra to your cart',
      ok: true,
    });
    expect(receiptFor({ type: 'cart_add', sku: '4458123', qty: 2 }, { ok: true })?.text).toBe(
      'Added that to your cart',
    );
    expect(
      receiptFor({ type: 'apply_coupon', code: 'welcome10' }, { ok: false, reason: 'not_found' }),
    ).toEqual({
      text: "Code WELCOME10 didn't apply",
      ok: false,
    });
  });

  it('never claims a fill that did not happen', () => {
    const fields = [{ field: 'name', value: 'A' }];
    expect(receiptFor({ type: 'form_fill', fields }, { ok: false, reason: 'not_found' })?.ok).toBe(
      false,
    );
    expect(receiptFor({ type: 'form_fill', fields }, { ok: true })?.text).toMatch(
      /Filled in your details/,
    );
  });

  it('stays silent for reads', () => {
    expect(receiptFor({ type: 'page_snapshot' }, { ok: true })).toBeNull();
    expect(receiptFor({ type: 'cart_get' }, { ok: true })).toBeNull();
  });

  it('labels pages plainly', () => {
    expect(pageLabel('/checkout?step=1')).toBe('checkout');
    expect(pageLabel('/products/green-mantra')).toBe('the Green Mantra page');
    expect(pageLabel('/')).toBe('the home page');
  });

  it('collapses an identical back-to-back receipt in the transcript', () => {
    const s = createStore({ sessionId: 's' });
    s.dispatch({ type: 'receipt', text: 'Added Sleep Mantra to your cart', ok: true });
    s.dispatch({ type: 'receipt', text: 'Added Sleep Mantra to your cart', ok: true });
    expect(s.get().transcript.filter((t) => t.kind === 'receipt')).toHaveLength(1);
  });
});
