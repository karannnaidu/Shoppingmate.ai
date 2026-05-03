import { describe, expect, it } from 'vitest';
import { InMemorySessionState } from '../../src/dom/sessionState.js';

describe('InMemorySessionState', () => {
  it('tracks counters per session', async () => {
    const s = new InMemorySessionState();
    await s.incrAction('sess', 'turn');
    await s.incrAction('sess', 'turn');
    expect(await s.getActions('sess')).toEqual({ thisTurn: 2, thisSession: 2 });
  });

  it('keeps sessions independent', async () => {
    const s = new InMemorySessionState();
    await s.incrAction('a', 'session');
    await s.incrAction('b', 'session');
    await s.incrAction('b', 'session');
    expect(await s.getActions('a')).toEqual({ thisTurn: 1, thisSession: 1 });
    expect(await s.getActions('b')).toEqual({ thisTurn: 2, thisSession: 2 });
  });

  it('newTurn resets thisTurn but not thisSession', async () => {
    const s = new InMemorySessionState();
    await s.incrAction('sess', 'turn');
    await s.newTurn('sess');
    expect(await s.getActions('sess')).toEqual({ thisTurn: 0, thisSession: 1 });
  });

  it('incrResolver returns post-increment count', async () => {
    const s = new InMemorySessionState();
    expect(await s.incrResolver('sess')).toBe(1);
    expect(await s.incrResolver('sess')).toBe(2);
    expect(await s.incrResolver('sess')).toBe(3);
  });
});
