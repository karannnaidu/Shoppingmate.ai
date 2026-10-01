import { describe, expect, it } from 'vitest';
import { razorpay, PLAN_IDS, TOPUP_AMOUNTS, TOPUP_QTYS } from './razorpay';

describe('razorpay wrapper', () => {
  it('exports a Razorpay client with subscriptions + paymentLink', () => {
    expect(razorpay).toBeDefined();
    expect(typeof razorpay.subscriptions.create).toBe('function');
    expect(typeof razorpay.paymentLink.create).toBe('function');
  });

  it('exports PLAN_IDS for the three plans', () => {
    expect(PLAN_IDS.starter).toBeDefined();
    expect(PLAN_IDS.growth).toBeDefined();
    expect(PLAN_IDS.scale).toBeDefined();
  });

  it('exports TOPUP_AMOUNTS + TOPUP_QTYS for all packs', () => {
    expect(TOPUP_AMOUNTS.topup_50.amount).toBe(1900);
    expect(TOPUP_AMOUNTS.topup_5000.label).toBe('5,000');
    expect(TOPUP_QTYS.topup_200).toBe(200);
    expect(TOPUP_QTYS.topup_1000).toBe(1000);
  });
});
