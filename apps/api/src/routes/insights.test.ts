import { describe, expect, it } from 'vitest';
import { countersFor, detailReason, mergeCounters, parseSummary, stepsFor } from './insights.js';

const base = {
  v: 1,
  merchantId: 'M1',
  sessionId: 's1',
  path: '/shop/sleep-mantra',
  pageType: 'pdp',
  device: 'mobile',
  source: 'instagram',
  newVisitor: true,
  dwellMs: 42000,
  maxScroll: 80,
  attention: [5, 3, 0, 0, 0, 0, 0, 0, 0, 0],
  cells: { '4,2': 3, '1,1': 1 },
  elements: { 'button|add to cart': 2 },
  rage: 1,
  dead: 2,
  errorClicks: 0,
  deadTargets: ['button|size guide'],
  rageTargets: ['button|add to cart'],
  abandonedFields: ['pincode'],
  lcp: 2400,
  cls: 0.05,
  inp: 180,
  jsErrors: 0,
  botEngaged: false,
  cartIncreased: true,
  qa: false,
};

describe('insights ingest', () => {
  it('rejects junk and clamps untrusted values', () => {
    expect(parseSummary(null)).toBeNull();
    expect(parseSummary({ sessionId: 'x' })).toBeNull();
    const x = parseSummary({
      ...base,
      dwellMs: 1e12,
      device: 'fridge',
      pageType: 'p|dp',
      cells: { 'a|b': 5000 },
    });
    expect(x).toMatchObject({ dwellMs: 3_600_000, device: 'desktop', pageType: 'p/dp' });
    expect(x?.cells).toEqual({ 'a/b': 1000 });
  });

  it('fans a pageview out into counters (no raw events)', () => {
    const x = parseSummary(base);
    if (!x) throw new Error('parse');
    const c = countersFor(x);
    const find = (metric: string, dimKey: string) =>
      c.find((k) => k.metric === metric && k.dimKey === dimKey);
    expect(find('pv', 'pdp|mobile|instagram')).toMatchObject({ count: 1, total: 42000 });
    expect(find('heat', 'pdp|mobile|4,2')).toMatchObject({ count: 3 });
    expect(find('el', 'pdp|mobile|button/add to cart')).toMatchObject({ count: 2 });
    expect(find('friction', 'pdp|mobile|rage|button/add to cart')).toMatchObject({ count: 1 });
    expect(find('friction', 'pdp|mobile|dead|button/size guide')).toMatchObject({ count: 1 });
    expect(find('field_abandon', 'pdp|pincode')).toBeTruthy();
    expect(find('product', '/shop/sleep-mantra|atc')).toBeTruthy();
    expect(stepsFor(x)).toEqual(['visit', 'product', 'add_to_cart']);
    expect(detailReason(x)).toBe('friction');
  });

  it('QA traffic is kept apart under a qa: prefix', () => {
    const x = parseSummary({ ...base, qa: true });
    if (!x) throw new Error('parse');
    expect(countersFor(x).every((k) => k.metric.startsWith('qa:'))).toBe(true);
  });

  it('merges duplicate rows before the upsert', () => {
    const merged = mergeCounters([
      { metric: 'friction', dimKey: 'pdp|mobile|dead|-', count: 1, total: 0 },
      { metric: 'friction', dimKey: 'pdp|mobile|dead|-', count: 1, total: 0 },
      { metric: 'pv', dimKey: 'x', count: 1, total: 5 },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0]).toMatchObject({ count: 2 });
  });
});
