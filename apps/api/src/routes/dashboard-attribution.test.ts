import { describe, expect, it, vi } from 'vitest';
import { computeAttributionSummary } from './dashboard-attribution.js';

describe('computeAttributionSummary', () => {
  it('sums totals split by kind for the given window', async () => {
    const queryConversions = vi.fn().mockResolvedValue([
      { kind: 'assisted', totalCents: 3000, orderId: 'o1' },
      { kind: 'assisted', totalCents: 2000, orderId: 'o2' },
      { kind: 'influenced', totalCents: 5000, orderId: 'o1' },
      { kind: 'influenced', totalCents: 5000, orderId: 'o3' },
    ]);
    const out = await computeAttributionSummary({
      merchantId: 'm1',
      days: 7,
      queryConversions,
    });
    expect(out).toEqual({
      assisted: { revenueCents: 5000, orderCount: 2 },
      influenced: { revenueCents: 10000, orderCount: 2 },
      windowDays: 7,
    });
  });

  it('returns zeros when no conversions', async () => {
    const queryConversions = vi.fn().mockResolvedValue([]);
    const out = await computeAttributionSummary({ merchantId: 'm1', days: 7, queryConversions });
    expect(out.assisted.revenueCents).toBe(0);
    expect(out.influenced.revenueCents).toBe(0);
  });
});
