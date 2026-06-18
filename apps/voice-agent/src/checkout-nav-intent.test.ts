import { describe, expect, it } from 'vitest';
import { hasCheckoutSignal, wantsCheckoutNavigation, wantsOrderConfirmation } from './agentWorker.js';

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

describe('wantsOrderConfirmation', () => {
  it('fires on confirmations / place-order intents (English + Hinglish)', () => {
    for (const t of [
      'yes please',
      'yes',
      'yeah',
      'sure',
      'go ahead',
      'place the order',
      'confirm the order',
      'place it',
      "that's correct",
      'looks good',
      'haan',
      'bilkul',
      'theek hai',
      'haan kar do',
      'yes please go ahead',
      'ok',
    ]) {
      expect(wantsOrderConfirmation(t)).toBe(true);
    }
  });

  it('does NOT fire on questions or non-confirmations', () => {
    for (const t of [
      'what is the total?',
      'can you fill my address?',
      'my name is Karan',
      'no not yet',
      'wait',
      'how much is it?',
    ]) {
      expect(wantsOrderConfirmation(t)).toBe(false);
    }
  });

  it('handles empty / whitespace safely', () => {
    expect(wantsOrderConfirmation('')).toBe(false);
    expect(wantsOrderConfirmation('   ')).toBe(false);
  });
});

describe('hasCheckoutSignal', () => {
  it('fires when the visitor is giving checkout details', () => {
    for (const t of [
      'add my delivery details',
      '8105791728',
      '810579 1728',
      'my pincode is 560037',
      '560037',
      'karan at gmail dot com',
      'thorin1435@gmail.com',
      'deliver to 21 Sandeep Square',
      'place my order',
      'my address is 21 Sandeep Square',
    ]) {
      expect(hasCheckoutSignal(t)).toBe(true);
    }
  });

  it('does NOT fire on ordinary browsing chat', () => {
    for (const t of [
      'tell me about peace mantra',
      'which one helps with sleep',
      'yes',
      'add peace mantra to cart',
      'what is the price',
    ]) {
      expect(hasCheckoutSignal(t)).toBe(false);
    }
  });
});
