import { describe, expect, it, vi } from 'vitest';
import { computeKpis } from './kpi-repo';

const metricRows = [
  { name: 'conversationCompleted', count: 100 },
  { name: 'voiceConversation', count: 22 },
];

const conversionRows = [
  { kind: 'assisted', totalCents: 1500, orderId: 'o1' },
  { kind: 'assisted', totalCents: 1500, orderId: 'o2' },
  { kind: 'influenced', totalCents: 5000, orderId: 'o3' },
];

vi.mock('./db', async () => {
  const { metricEvents, conversionEvents } = await import('@shoppingmate/db/schema');
  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn((table: unknown) => {
          if (table === metricEvents) {
            return {
              where: vi.fn(() => ({
                groupBy: vi.fn(() => Promise.resolve(metricRows)),
              })),
            };
          }
          if (table === conversionEvents) {
            return {
              where: vi.fn(() => Promise.resolve(conversionRows)),
            };
          }
          throw new Error('unexpected table in test mock');
        }),
      })),
    },
  };
});

describe('computeKpis', () => {
  it('computes conversations + voice ratio from metric_events and revenue split from conversion_events', async () => {
    const kpis = await computeKpis({ merchantId: 'SM-TEST01', days: 7 });
    expect(kpis.conversations).toBe(100);
    expect(kpis.voiceConversations).toBe(22);
    expect(kpis.voiceRatio).toBeCloseTo(0.22);
    expect(kpis.assistedRevenueCents).toBe(3000);
    expect(kpis.assistedOrderCount).toBe(2);
    expect(kpis.influencedRevenueCents).toBe(5000);
    expect(kpis.influencedOrderCount).toBe(1);
  });
});
