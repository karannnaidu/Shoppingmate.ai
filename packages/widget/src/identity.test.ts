import { describe, expect, it, beforeEach } from 'vitest';
import { getOrCreateVisitorId, VISITOR_ID_KEY, VISITOR_ID_TTL_MS } from './identity.js';

describe('getOrCreateVisitorId', () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `${VISITOR_ID_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
  });

  it('returns a new id when none exists', () => {
    const id = getOrCreateVisitorId();
    expect(id).toMatch(/^v_[a-z0-9]+$/);
    expect(localStorage.getItem(VISITOR_ID_KEY)).toBeTruthy();
  });

  it('returns the existing id from localStorage when fresh', () => {
    localStorage.setItem(
      VISITOR_ID_KEY,
      JSON.stringify({ id: 'v_abc', expiresAt: Date.now() + VISITOR_ID_TTL_MS }),
    );
    expect(getOrCreateVisitorId()).toBe('v_abc');
  });

  it('regenerates when stored id is expired', () => {
    localStorage.setItem(
      VISITOR_ID_KEY,
      JSON.stringify({ id: 'v_old', expiresAt: Date.now() - 1 }),
    );
    const id = getOrCreateVisitorId();
    expect(id).not.toBe('v_old');
  });

  it('refreshes the TTL on every read (rolling)', () => {
    localStorage.setItem(
      VISITOR_ID_KEY,
      JSON.stringify({ id: 'v_x', expiresAt: Date.now() + 1000 }),
    );
    getOrCreateVisitorId();
    const stored = JSON.parse(localStorage.getItem(VISITOR_ID_KEY)!);
    expect(stored.expiresAt).toBeGreaterThan(Date.now() + VISITOR_ID_TTL_MS - 1000);
  });
});
