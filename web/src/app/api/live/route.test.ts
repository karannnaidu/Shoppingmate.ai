// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));
vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({ merchant: { id: 'SM-X' } }),
}));
vi.mock('@/lib/live-repo', () => ({
  liveSnapshot: vi
    .fn()
    .mockResolvedValue({ activeConversations: 2, conversionsToday: 1, revenueTodayCents: 25000 }),
}));

import { GET } from './route';

describe('GET /api/live', () => {
  it('returns snapshot for an authed merchant', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.activeConversations).toBe(2);
    expect(json.revenueTodayCents).toBe(25000);
  });

  it('returns 401 without a session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
