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

  it('exports TOPUP_AMOUNTS + TOPUP_QTYS at $0.30/credit for all packs', () => {
    expect(TOPUP_AMOUNTS.topup_100.amount).toBe(3000); // $30 for 100 credits
    expect(TOPUP_AMOUNTS.topup_1000.label).toBe('1,000');
    expect(TOPUP_QTYS.topup_500).toBe(500);
    expect(TOPUP_QTYS.topup_1000).toBe(1000);
  });
});
