import { describe, expect, it } from 'vitest';
import { stripe, PRICE_IDS } from './stripe';

describe('stripe wrapper', () => {
  it('exports a Stripe client', () => {
    expect(stripe).toBeDefined();
    expect(typeof stripe.checkout.sessions.create).toBe('function');
  });

  it('exports PRICE_IDS map for plans + topup packs', () => {
    expect(PRICE_IDS.starter_monthly).toBeDefined();
    expect(PRICE_IDS.topup_50).toBeDefined();
    expect(PRICE_IDS.topup_200).toBeDefined();
    expect(PRICE_IDS.topup_1000).toBeDefined();
    expect(PRICE_IDS.topup_5000).toBeDefined();
  });
});
