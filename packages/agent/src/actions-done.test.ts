import { describe, expect, it } from 'vitest';
import { describeDoneAction } from './runtime.js';

// Regression for live 2026-10-06 (text): "take me to checkout" re-ran cart.add
// because saved history keeps only words, not the tool calls.
describe('describeDoneAction', () => {
  it('records page-changing actions', () => {
    expect(describeDoneAction('cart.add', '{"sku":"sleep-mantra","qty":1}')).toBe(
      'added 1 × sleep-mantra to the cart',
    );
    expect(describeDoneAction('cart.update', '{"variantId":"123","qty":0}')).toBe(
      'removed 123 from the cart',
    );
    expect(describeDoneAction('coupon.apply', '{"code":"CALM10"}')).toBe('applied coupon CALM10');
    expect(describeDoneAction('site.navigate', '{"path":"/checkout"}')).toBe('opened /checkout');
  });

  it('ignores reads and bad JSON safely', () => {
    expect(describeDoneAction('products.search', '{"query":"sleep"}')).toBeNull();
    expect(describeDoneAction('cart.get', '{}')).toBeNull();
    expect(describeDoneAction('cart.add', 'not json')).toBe('added 1 × item to the cart');
  });
});
