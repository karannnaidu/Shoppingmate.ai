import { describe, expect, it, vi } from 'vitest';
import { computeKpis } from './kpi-repo';

vi.mock('./db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          groupBy: vi.fn(() => Promise.resolve([
            { name: 'conversationCompleted', count: 100, sumCents: 0 },
            { name: 'conversionAttributed', count: 18, sumCents: 540000 },
            { name: 'voiceConversation', count: 22, sumCents: 0 },
          ])),
        })),
      })),
    })),
  },
}));

describe('computeKpis', () => {
  it('computes conversations, conversion rate, revenue, voice ratio', async () => {
    const kpis = await computeKpis({ merchantId: 'SM-TEST01', days: 7 });
    expect(kpis.conversations).toBe(100);
    expect(kpis.conversionRate).toBeCloseTo(0.18);
    expect(kpis.revenueCents).toBe(540000);
    expect(kpis.voiceRatio).toBeCloseTo(0.22);
  });
});
