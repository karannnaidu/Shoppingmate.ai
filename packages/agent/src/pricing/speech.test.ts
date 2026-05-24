import { describe, expect, it } from 'vitest';
import { formatPlanSpeech, numberToWords } from './speech.js';
import { findPlan } from './plans.js';

describe('numberToWords()', () => {
  it.each([
    [0, 'zero'],
    [1, 'one'],
    [12, 'twelve'],
    [30, 'thirty'],
    [99, 'ninety-nine'],
    [100, 'one hundred'],
    [299, 'two hundred ninety-nine'],
    [500, 'five hundred'],
    [799, 'seven hundred ninety-nine'],
    [2000, 'two thousand'],
    [9999, 'nine thousand nine hundred ninety-nine'],
  ])('%d → %s', (n, expected) => {
    expect(numberToWords(n)).toBe(expected);
  });

  it('throws for out-of-range', () => {
    expect(() => numberToWords(-1)).toThrow();
    expect(() => numberToWords(10000)).toThrow();
  });
});

describe('formatPlanSpeech()', () => {
  it('renders the Starter plan with words, never digits', () => {
    const starter = findPlan('starter')!;
    const speech = formatPlanSpeech(starter);
    expect(speech).toBe('Starter is thirty dollars per month for one hundred conversations.');
    expect(speech).not.toMatch(/\d/);
    expect(speech).not.toMatch(/[\$€£¥₹]/);
  });

  it('renders the Growth plan', () => {
    expect(formatPlanSpeech(findPlan('growth')!)).toBe(
      'Growth is sixty dollars per month for five hundred conversations.',
    );
  });

  it('handles plans with no price (Enterprise) by speaking "custom pricing"', () => {
    expect(formatPlanSpeech(findPlan('enterprise')!)).toBe(
      'Enterprise is custom pricing — talk to our team for a quote.',
    );
  });
});
