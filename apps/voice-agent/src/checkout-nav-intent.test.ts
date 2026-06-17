import { describe, expect, it } from 'vitest';
import { wantsCheckoutNavigation } from './agentWorker.js';

describe('wantsCheckoutNavigation', () => {
  it('fires on clear "take me to checkout" intents', () => {
    for (const t of [
      'take me to checkout',
      'go to checkout',
      'proceed to checkout for me',
      'proceed to checkout',
      "let's checkout",
      "let's check out now",
      'can we checkout',
      'I want to checkout',
      'ready to checkout',
      'checkout',
      'checkout now',
      'checkout please',
      'navigate to checkout',
    ]) {
      expect(wantsCheckoutNavigation(t)).toBe(true);
    }
  });

  it('does NOT fire on passing/question mentions', () => {
    for (const t of [
      'what is the checkout process?',
      'how does checkout work?',
      'is there a checkout fee?',
      'do you have express checkout?',
      'tell me about your products',
      'add peace mantra to my cart',
      'what payment methods at checkout do you take?',
    ]) {
      expect(wantsCheckoutNavigation(t)).toBe(false);
    }
  });

  it('handles empty / whitespace safely', () => {
    expect(wantsCheckoutNavigation('')).toBe(false);
    expect(wantsCheckoutNavigation('   ')).toBe(false);
  });
});
