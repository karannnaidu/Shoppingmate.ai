import { describe, expect, it, vi } from 'vitest';
import { getDashboardSession } from './session';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn().mockResolvedValue(null),
    },
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: { merchantOwners: { findFirst: vi.fn() } },
  },
}));

describe('getDashboardSession', () => {
  it('returns null when no session', async () => {
    const result = await getDashboardSession({ headers: new Headers() });
    expect(result).toBeNull();
  });
});
