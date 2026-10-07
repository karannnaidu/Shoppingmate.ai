import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InsightFacts } from '@shoppingmate/db/insights';
import { describe, expect, it } from 'vitest';
import { BANNED_JARGON, FRICTION_LABEL, PAGE_LABEL, STEP_LABEL, elementWords, money, outOf100, trendWords } from './insights-copy';
import { deterministicFixes } from './insights-fixes';

const jargon = (text: string) => BANNED_JARGON.filter((re) => re.test(text)).map(String);

describe('owner language (PRD 8.13a)', () => {
  it('visible text on the Insights page has no analyst jargon', () => {
    const src = readFileSync(join(__dirname, '../app/app/insights/page.tsx'), 'utf8');
    const visible = [...src.matchAll(/>([^<>{}]+)</g)].map((m) => (m[1] ?? '').trim()).filter(Boolean);
    const quoted = [...src.matchAll(/'([^'\n]{12,})'/g)]
      .map((m) => m[1] ?? '')
      .filter((s) => !/^[@./]/.test(s)); // import paths aren't shown to owners
    for (const t of [...visible, ...quoted]) expect(jargon(t), t).toEqual([]);
  });

  it('labels and generated fix cards are jargon-free', () => {
    for (const t of [...Object.values(STEP_LABEL), ...Object.values(PAGE_LABEL), ...Object.values(FRICTION_LABEL)]) {
      expect(jargon(t), t).toEqual([]);
    }
    const facts = {
      currency: 'INR',
      sessions: 120,
      conversionRate: 0.02,
      steps: { visit: 120, collection: 40, product: 70, add_to_cart: 12, cart: 10, checkout: 6, purchase: 3 },
      leaks: [{ from: 'product', to: 'add_to_cart', reached: 70, continued: 12, lost: 58, valueAtRisk: 48000 }],
      friction: [{ pageType: 'pdp', device: 'mobile', kind: 'dead', target: 'button/size guide', count: 14 }],
      abandonedFields: [{ pageType: 'checkout', field: 'pincode', count: 5 }],
    } as unknown as InsightFacts;
    const cards = deterministicFixes(facts);
    expect(cards[0]?.impact).toBe('about ₹48,000 a week if 1 in 10 of them carry on');
    for (const c of cards) for (const t of [c.title, c.impact, c.proof, c.action]) expect(jargon(t), t).toEqual([]);
  });

  it('formats numbers the way owners read them', () => {
    expect(money(48000, 'INR')).toBe('₹48,000');
    expect(outOf100(0.02)).toBe('2 in 100');
    expect(outOf100(0.025)).toBe('2.5 in 100');
    expect(elementWords('button/size guide')).toBe('the “size guide” button');
    expect(trendWords(130, 100).text).toBe('↑ 30% more than usual');
  });
});
