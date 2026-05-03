import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runFixture } from './_fixture-runner.js';

describe('fixture: 15-turn cap graceful close', () => {
  it('emits say + session_closed (reason=cap), no cards or tool_result, and never calls Sonnet', async () => {
    const { events, chatToolsMock } = await runFixture(
      resolve(import.meta.dirname, 'fixtures', 'cap-15-turns.json'),
    );

    expect(events).toHaveLength(1);
    const turnEvents = events[0];
    if (!turnEvents) throw new Error('expected at least one turn');
    const types = turnEvents.map((e) => e.type);

    expect(types).toContain('say');
    expect(types).toContain('session_closed');
    expect(types).not.toContain('cards');
    expect(types).not.toContain('tool_result');

    const closed = turnEvents.find((e) => e.type === 'session_closed');
    expect(closed).toMatchObject({ type: 'session_closed', reason: 'cap' });

    expect(chatToolsMock).not.toHaveBeenCalled();
  });
});
