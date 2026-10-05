import type { InsightFacts } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { money, parseReport, weekStartOf } from './insightsReport.js';

const facts = {
  leaks: [
    { from: 'visit', to: 'product', reached: 100, continued: 40, lost: 60, valueAtRisk: 30000 },
    {
      from: 'product',
      to: 'add_to_cart',
      reached: 40,
      continued: 10,
      lost: 30,
      valueAtRisk: 20000,
    },
  ],
} as unknown as InsightFacts;

describe('weekly report', () => {
  it('parses the LLM JSON and clamps impossible money values', () => {
    const r = parseReport(
      JSON.stringify({
        summary: 'You lost about ₹50,000 this week between your product pages and the cart.',
        fixes: [
          {
            title: 'Shoppers tap the size guide and nothing happens',
            impact: '₹20,000 a week',
            impactValue: 20000,
            proof: '30 taps did nothing',
            action: 'Fix the size guide button',
            pageType: 'pdp',
          },
          {
            title: 'Made-up huge number',
            impact: 'x',
            impactValue: 9_999_999,
            proof: 'p',
            action: 'a',
          },
          { title: '', action: 'missing title is dropped' },
        ],
      }),
      facts,
    );
    expect(r?.summary).toMatch(/₹50,000/);
    expect(r?.fixes).toHaveLength(2);
    expect(r?.fixes[1]?.impactValue).toBe(50000); // clamped to total at risk
    expect(r?.fixes[0]?.status).toBe('open');
  });

  it('rejects non-JSON', () => {
    expect(parseReport('sorry I cannot', facts)).toBeNull();
  });

  it('formats money for owners and finds the week start (Monday)', () => {
    expect(money(42000, 'INR')).toBe('₹42,000');
    expect(money(1234.6, 'USD')).toBe('$1,235');
    expect(weekStartOf(new Date('2026-10-08T10:00:00Z'))).toBe('2026-10-05');
    expect(weekStartOf(new Date('2026-10-05T00:00:00Z'))).toBe('2026-10-05');
  });
});
