import { describe, expect, it } from 'vitest';
import { buildTimeline } from './action-timeline';

const at = (s: number) => new Date(Date.UTC(2026, 9, 6, 10, 0, s));

describe('buildTimeline', () => {
  it('turns real tool calls into owner-readable steps, folding reads and repeats', () => {
    const steps = buildTimeline([
      { toolName: 'page.snapshot', ok: true, ts: at(1) },
      { toolName: 'cart.add', ok: true, ts: at(2) },
      { toolName: 'cart.add', ok: true, ts: at(3) },
      { toolName: 'cart.add', ok: true, ts: at(4) },
      { toolName: 'site.navigate', ok: true, ts: at(5) },
      { toolName: 'checkout.fill', ok: false, ts: at(6), failReason: 'not_found' },
    ]);
    expect(steps.map((s) => [s.label, s.ok, s.count])).toEqual([
      ['Added a product to the cart', true, 3],
      ['Opened a page for the shopper', true, 1],
      ['Filled in the checkout form', false, 1],
    ]);
    expect(steps[2]?.why).toBe("the page didn't have what was needed");
  });

  it('orders by time even when rows arrive unsorted', () => {
    const steps = buildTimeline([
      { toolName: 'coupon.apply', ok: true, ts: at(9) },
      { toolName: 'cart.add', ok: true, ts: at(1) },
    ]);
    expect(steps[0]?.label).toBe('Added a product to the cart');
  });
});
