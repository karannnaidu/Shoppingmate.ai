import { describe, expect, it, vi } from 'vitest';
import {
  aggregateBrandStats,
  distilBrandPlaybook,
  type BrandRecord,
  type BrandStats,
} from './brand-playbook.js';

const r = (over: Partial<BrandRecord>): BrandRecord => ({
  intent: null,
  needs: [],
  objections: [],
  outcome: 'abandoned',
  couponUsed: false,
  attributedCents: 0,
  ...over,
});

const RECORDS: BrandRecord[] = [
  r({ intent: 'buy', needs: ['sleep'], objections: ['price'], outcome: 'purchased', couponUsed: true, attributedCents: 5000 }),
  r({ intent: 'buy', needs: ['sleep', 'stress'], objections: [], outcome: 'purchased', couponUsed: false, attributedCents: 4000 }),
  r({ intent: 'compare', needs: ['stress'], objections: ['price', 'trust'], outcome: 'abandoned', couponUsed: false }),
  r({ intent: 'buy', needs: ['sleep'], objections: ['trust'], outcome: 'abandoned', couponUsed: true }),
  r({ intent: 'support', needs: [], objections: ['price'], outcome: 'purchased', couponUsed: false, attributedCents: 3000 }),
];

describe('aggregateBrandStats', () => {
  it('computes total and overall purchasedRate', () => {
    const s = aggregateBrandStats(RECORDS);
    expect(s.total).toBe(5);
    expect(s.purchasedRate).toBe(0.6); // 3 of 5
  });

  it('byIntent rows carry per-intent purchasedRate, sorted by count', () => {
    const s = aggregateBrandStats(RECORDS);
    const buy = s.byIntent.find((x) => x.key === 'buy');
    expect(buy).toBeDefined();
    expect(buy!.count).toBe(3);
    expect(buy!.purchasedRate).toBe(0.67); // 2 of 3
    const compare = s.byIntent.find((x) => x.key === 'compare');
    expect(compare!.purchasedRate).toBe(0); // 0 of 1
    // sorted desc by count
    expect(s.byIntent[0].count).toBeGreaterThanOrEqual(s.byIntent[s.byIntent.length - 1].count);
  });

  it('maps a null intent to "unknown"', () => {
    const s = aggregateBrandStats([r({ intent: null, outcome: 'purchased' })]);
    expect(s.byIntent[0].key).toBe('unknown');
  });

  it('byNeed counts each need across convos with its own purchasedRate', () => {
    const s = aggregateBrandStats(RECORDS);
    const sleep = s.byNeed.find((x) => x.key === 'sleep');
    expect(sleep!.count).toBe(3); // records 1,2,4
    expect(sleep!.purchasedRate).toBe(0.67); // 2 of 3 purchased
    const stress = s.byNeed.find((x) => x.key === 'stress');
    expect(stress!.count).toBe(2); // records 2,3
    expect(stress!.purchasedRate).toBe(0.5); // 1 of 2
  });

  it('objections carry overcomeRate = purchase rate among convos with that objection', () => {
    const s = aggregateBrandStats(RECORDS);
    const price = s.objections.find((x) => x.key === 'price');
    // price in records 1,3,5 -> purchased 1,5 -> 2 of 3
    expect(price!.count).toBe(3);
    expect(price!.overcomeRate).toBe(0.67);
    const trust = s.objections.find((x) => x.key === 'trust');
    // trust in records 3,4 -> none purchased -> 0 of 2
    expect(trust!.count).toBe(2);
    expect(trust!.overcomeRate).toBe(0);
  });

  it('coupon vs no-coupon purchase rates differ as expected', () => {
    const s = aggregateBrandStats(RECORDS);
    // coupon used: records 1 (purchased), 4 (abandoned) -> 1 of 2 = 0.5
    expect(s.couponPurchasedRate).toBe(0.5);
    // no coupon: records 2,3,5 -> purchased 2,5 -> 2 of 3 = 0.67
    expect(s.noCouponPurchasedRate).toBe(0.67);
    expect(s.couponPurchasedRate).not.toBe(s.noCouponPurchasedRate);
  });

  it('returns null coupon rates when no records in a bucket', () => {
    const s = aggregateBrandStats([r({ couponUsed: false, outcome: 'purchased' })]);
    expect(s.couponPurchasedRate).toBeNull();
    expect(s.noCouponPurchasedRate).toBe(1);
  });

  it('tallies dropStages, ignoring blanks, sorted by count', () => {
    const s = aggregateBrandStats(RECORDS, ['checkout', 'checkout', 'cart', '', '  ']);
    expect(s.dropStages[0]).toEqual({ key: 'checkout', count: 2 });
    expect(s.dropStages.find((d) => d.key === 'cart')!.count).toBe(1);
    expect(s.dropStages.find((d) => d.key === '')).toBeUndefined();
  });

  it('handles an empty record set without dividing by zero', () => {
    const s = aggregateBrandStats([]);
    expect(s.total).toBe(0);
    expect(s.purchasedRate).toBe(0);
    expect(s.byIntent).toEqual([]);
    expect(s.couponPurchasedRate).toBeNull();
    expect(s.noCouponPurchasedRate).toBeNull();
  });
});

describe('distilBrandPlaybook', () => {
  const STATS: BrandStats = aggregateBrandStats(RECORDS);

  it('returns trimmed text from the chat', async () => {
    const chat = vi.fn().mockResolvedValue({ text: '  LEAD WITH sleep. PRE-EMPT price.  \n' });
    const out = await distilBrandPlaybook(STATS, chat);
    expect(out).toBe('LEAD WITH sleep. PRE-EMPT price.');
    expect(chat).toHaveBeenCalledOnce();
    const messages = chat.mock.calls[0][0];
    expect(messages[0].role).toBe('system');
    expect(messages[1].content).toContain('Stats');
  });

  it('returns empty string when the chat throws', async () => {
    const chat = vi.fn().mockRejectedValue(new Error('model down'));
    const out = await distilBrandPlaybook(STATS, chat);
    expect(out).toBe('');
  });
});
