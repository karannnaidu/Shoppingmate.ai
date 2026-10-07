import { describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ db: {} }));

import { buildJourneys } from './insights-journeys';
import { insightsCsv } from './insights-export';
import type { InsightFacts } from '@shoppingmate/db/insights';

const t = (m: number) => new Date(Date.UTC(2026, 9, 7, 10, m));

describe('buildJourneys (Scale: shopper journeys)', () => {
  it('groups visits into page paths, collapses repeats, counts orders', () => {
    const rows = [
      { sessionId: 'a', pageType: 'home', reason: 'bot', createdAt: t(0) },
      { sessionId: 'a', pageType: 'product', reason: 'bot', createdAt: t(1) },
      { sessionId: 'a', pageType: 'product', reason: 'bot', createdAt: t(2) },
      { sessionId: 'a', pageType: 'checkout', reason: 'converted', createdAt: t(3) },
      { sessionId: 'b', pageType: 'home', reason: 'friction', createdAt: t(0) },
      { sessionId: 'b', pageType: 'product', reason: 'friction', createdAt: t(1) },
      { sessionId: 'b', pageType: 'checkout', reason: 'friction', createdAt: t(2) },
      { sessionId: 'c', pageType: 'product', reason: 'friction', createdAt: t(0) },
    ];
    const j = buildJourneys(rows);
    expect(j[0]!.visits).toBe(2);
    expect(j[0]!.ordered).toBe(1);
    expect(j[0]!.steps).toHaveLength(3); // product repeat collapsed
    expect(j).toHaveLength(2);
  });

  it('uses the recorded full path when a visit only stored its last page', () => {
    const j = buildJourneys([
      { sessionId: 'z', pageType: 'purchase', reason: 'converted', createdAt: t(9), journey: ['home', 'pdp', 'pdp', 'checkout', 'purchase'] },
    ]);
    expect(j[0]!.steps).toHaveLength(4);
    expect(j[0]!.ordered).toBe(1);
  });
});

describe('insightsCsv (Scale: export)', () => {
  it('produces a CSV with every section and escapes commas/quotes', () => {
    const f = {
      merchantId: 'm', currency: 'INR', aov: 150000, aovSource: 'catalog', days: 7, sessions: 357, sessionsPrev: 0,
      steps: { visit: 357, product: 102 } as InsightFacts['steps'], conversionRate: 0.014, conversionRatePrev: 0,
      leaks: [{ from: 'product', to: 'cart', reached: 102, continued: 10, lost: 92, valueAtRisk: 15547100 }],
      byDevice: [{ device: 'mobile', sessions: 300, purchases: 4 }], bySource: [{ source: 'google', sessions: 200, purchases: 3 }],
      pages: [{ pageType: 'product', views: 300, avgSeconds: 41.2, avgScroll: 55, quickExits: 80, avgLcpMs: 2100 }],
      friction: [{ pageType: 'product', device: 'mobile', kind: 'dead_tap', target: 'x', label: 'Size, "S"', count: 9 }],
      abandonedFields: [], products: [], heat: [], attention: [],
      bot: { engagedSessions: 0, engagedPurchases: 0, otherPurchases: 0 },
      voice: { conversations: 0, objections: [{ text: 'too pricey', count: 2 }], needs: [], unanswered: [], cases: [] }, qa: false,
    } as unknown as InsightFacts;
    const csv = insightsCsv(f);
    for (const s of ['Summary', 'Funnel', 'Where people stop', 'Pages', 'Traffic sources', 'Devices', 'What shoppers asked']) {
      expect(csv).toContain(s);
    }
    expect(csv).toContain('"Size, ""S"""');
    expect(csv).toContain('155471.00');
  });
});
