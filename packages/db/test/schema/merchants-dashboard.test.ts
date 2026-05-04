import { describe, expect, it } from 'vitest';
import { merchants } from '../../src/schema/merchants';

describe('merchants dashboard columns', () => {
  it('has Stripe billing columns', () => {
    expect(merchants.stripeCustomerId).toBeDefined();
    expect(merchants.stripeSubscriptionId).toBeDefined();
    expect(merchants.plan).toBeDefined();
    expect(merchants.billingStatus).toBeDefined();
  });

  it('has persona + webhook columns', () => {
    expect(merchants.persona).toBeDefined();
    expect(merchants.leadWebhookUrl).toBeDefined();
  });

  it('has KB + install columns', () => {
    expect(merchants.knowledgeBaseStatus).toBeDefined();
    expect(merchants.lastWidgetPing).toBeDefined();
  });

  it('has top-up + auto-recharge columns', () => {
    expect(merchants.topupBalance).toBeDefined();
    expect(merchants.autoRechargeEnabled).toBeDefined();
    expect(merchants.autoRechargeThreshold).toBeDefined();
    expect(merchants.autoRechargePackSize).toBeDefined();
  });

  it('has soft-delete column', () => {
    expect(merchants.deletedAt).toBeDefined();
  });
});
