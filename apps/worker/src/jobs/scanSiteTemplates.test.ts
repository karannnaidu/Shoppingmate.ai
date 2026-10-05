import { describe, expect, it } from 'vitest';
import { intersect, recipesFrom, urlPatternFor } from './scanSiteTemplates.js';

describe('scanSiteTemplates helpers', () => {
  it('urlPatternFor generalises varying segments', () => {
    expect(urlPatternFor(['/'])).toBe('^/?$');
    const p = urlPatternFor(['/shop/sleep-mantra', '/shop/peace-mantra']);
    expect(p).toBe('^/shop/[^/]+/?$');
    expect(new RegExp(p).test('/shop/green-mantra')).toBe(true);
    expect(new RegExp(p).test('/blog/x')).toBe(false);
    expect(urlPatternFor(['/products/a.b'])).toBe('^/products/a\\.b/?$');
  });

  it('intersect keeps only keys on every sample', () => {
    expect(
      intersect([
        ['a', 'b', 'c'],
        ['b', 'c', 'd'],
        ['c', 'b'],
      ]),
    ).toEqual(['b', 'c']);
    expect(intersect([])).toEqual([]);
  });

  it('recipesFrom finds shared add-to-cart / quantity / variant controls', () => {
    const snap = [
      '[page] X · /shop/x',
      '[e1] heading "Sleep Mantra"',
      '[e2] radio "50 ml" (checked)',
      '[e3] spinbutton "Quantity"',
      '[e4] button "Add to cart"',
      '[e5] button "Buy now"',
    ].join('\n');
    const skeleton = ['button|add to cart', 'spinbutton|quantity'];
    const r = recipesFrom([snap], skeleton);
    expect(r.map((x) => x.action)).toEqual(['variant', 'quantity', 'add_to_cart']);
    // buy_now is not in the shared skeleton → excluded
    expect(r.find((x) => x.action === 'buy_now')).toBeUndefined();
  });
});
