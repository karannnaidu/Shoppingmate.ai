import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runFixture } from './_fixture-runner.js';

describe('fixture: suggest recommend-only', () => {
  it('emits cards + say but never a checkout_redirect for cart-less merchants', async () => {
    const { events } = await runFixture(
      resolve(import.meta.dirname, 'fixtures', 'suggest-recommend-only.json'),
    );

    expect(events).toHaveLength(1);
    const turnEvents = events[0]!;
    const types = turnEvents.map((e) => e.type);
    expect(types).toContain('cards');
    expect(types).toContain('say');

    // Critical: no auto checkout for cart-less / suggest merchants.
    expect(turnEvents.find((e) => e.type === 'checkout_redirect')).toBeUndefined();

    // Lenient assertion: the "say" hints at manual add (mocked text contains "tap").
    const says = turnEvents
      .filter((e) => e.type === 'say')
      .map((e) => (e as { text: string }).text)
      .join(' ');
    expect(says).toMatch(/tap|add it on the page|click/i);
  });
});
