import { describe, expect, it, vi } from 'vitest';
import type { IntentTagRow } from './intent-insights';

const MOCK_ROWS: IntentTagRow[] = [
  {
    intent: 'ready_to_buy',
    outcome: 'purchased',
    needs: ['sleep'],
    objections: ['price'],
    dropStage: null,
  },
  {
    intent: 'ready_to_buy',
    outcome: 'abandoned',
    needs: ['sleep', 'stress'],
    objections: ['price', 'shipping'],
    dropStage: 'checkout',
  },
  {
    intent: 'researching',
    outcome: 'abandoned',
    needs: ['stress'],
    objections: [],
    dropStage: 'cart',
  },
];

vi.mock('./db', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => Promise.resolve(MOCK_ROWS)),
      })),
    })),
  },
}));

import { getIntentInsights } from './intent-repo';

describe('getIntentInsights', () => {
  it('aggregates the queried rows into insights', async () => {
    const insights = await getIntentInsights({ merchantId: 'SM-TEST01', days: 30 });
    expect(insights.total).toBe(3);
    expect(insights.distribution[0]).toEqual({ key: 'ready_to_buy', count: 2 });
    expect(insights.topNeeds[0]).toEqual({ key: 'sleep', count: 2 });
    expect(insights.topObjections[0]).toEqual({ key: 'price', count: 2 });
    expect(insights.dropStages).toContainEqual({ key: 'checkout', count: 1 });
    expect(insights.dropStages).toContainEqual({ key: 'cart', count: 1 });
  });
});
