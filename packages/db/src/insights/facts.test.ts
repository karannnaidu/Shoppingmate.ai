import { describe, expect, it } from 'vitest';
import { productPathKey } from './facts.js';

describe('productPathKey', () => {
  it('counts each product page once (Calmosis showed Green Mantra twice)', () => {
    expect(productPathKey('/shop/green-mantra/')).toBe('/shop/green-mantra');
    expect(productPathKey('/shop/green-mantra')).toBe('/shop/green-mantra');
    expect(productPathKey('/Shop/Green-Mantra?ref=ig#reviews')).toBe('/shop/green-mantra');
    expect(productPathKey('/')).toBe('/');
  });
});
