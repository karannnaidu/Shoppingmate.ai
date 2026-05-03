import { describe, expect, it } from 'vitest';
import { stripPrices } from './postprocess.js';

describe('stripPrices()', () => {
  it.each([
    ['₹1,499',                              'the price on the card'],
    ['costs ₹1,499 only',                   'costs the price on the card only'],
    ['$2,200.00',                           'the price on the card'],
    ['Rs. 350',                             'the price on the card'],
    ['Rs350',                               'the price on the card'],
    ['saves you 1,499 rupees',              'saves you the price on the card'],
    ['that is 99 USD',                      'that is the price on the card'],
    ['size 10',                             'size 10'],         // non-price untouched
    ['12 reviews',                          '12 reviews'],
    ['M, L, XL',                            'M, L, XL'],
    ['I have 3 in cart',                    'I have 3 in cart'],
  ])('strips %s', (input, expected) => {
    const { text, hits } = stripPrices(input);
    expect(text).toBe(expected);
    if (input !== expected) expect(hits.length).toBeGreaterThan(0);
  });

  it('reports the matched pattern in hits[]', () => {
    const r = stripPrices('₹1,499 and $20 too');
    expect(r.hits).toEqual(expect.arrayContaining([
      expect.objectContaining({ pattern: 'rupee' }),
      expect.objectContaining({ pattern: 'dollar' }),
    ]));
  });
});
