import { describe, expect, it, vi } from 'vitest';
import { listRevenueRows } from './revenue-repo';

describe('listRevenueRows', () => {
  it('returns rows ordered by occurredAt desc with recommended SKUs marked', async () => {
    const queryRows = vi.fn().mockResolvedValue([
      { orderId: 'o2', kind: 'influenced', totalCents: 5000, currency: 'USD', occurredAt: new Date('2026-05-27T11:00Z'), lineItems: [{ sku: 'A', quantity: 1, priceCents: 5000, wasRecommended: false }] },
      { orderId: 'o1', kind: 'assisted', totalCents: 3000, currency: 'USD', occurredAt: new Date('2026-05-27T10:00Z'), lineItems: [{ sku: 'A', quantity: 1, priceCents: 3000, wasRecommended: true }] },
    ]);
    const out = await listRevenueRows({ merchantId: 'm1', days: 7, queryRows });
    expect(out[0]!.orderId).toBe('o2');
    expect(out[1]!.lineItems[0]!.wasRecommended).toBe(true);
  });
});
