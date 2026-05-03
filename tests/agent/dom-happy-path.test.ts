import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runFixture } from './_fixture-runner.js';

describe('fixture: DOM happy path', () => {
  it('runs both turns and emits the expected events', async () => {
    const { events, fixture } = await runFixture(
      resolve(import.meta.dirname, 'fixtures', 'dom-happy-path.json'),
    );
    expect(events).toHaveLength(2);
    for (let i = 0; i < events.length; i += 1) {
      const turnEvents = events[i] ?? [];
      const turnFixture = fixture.turns[i];
      if (!turnFixture) throw new Error(`fixture missing turn ${i}`);
      const types = turnEvents.map((e) => e.type);
      for (const expected of turnFixture.expectEvents) {
        expect(types).toContain(expected);
      }
      if (turnFixture.expectNoNumericPriceInSay) {
        const says = turnEvents
          .filter((e) => e.type === 'say')
          .map((e) => (e as { text: string }).text)
          .join(' ');
        expect(says).not.toMatch(/[\u20B9$]\d|\bRs\.?\s*\d|\b\d+\s*(rupees|dollars|INR|USD)/i);
      }
    }
  });
});
