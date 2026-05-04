// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: () => Promise.resolve(new Headers()) }));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({ merchant: { id: 'SM-X' } }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: {
      merchants: {
        findFirst: vi.fn().mockResolvedValue({ id: 'SM-X', stripeCustomerId: 'cus_x' }),
      },
    },
  },
}));

vi.mock('@/lib/stripe', () => ({
  stripe: {
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({ url: 'https://billing.stripe.com/p/session_xyz' }),
      },
    },
  },
}));

import { POST } from './route';

describe('POST /api/billing/portal-session', () => {
  it('returns portal url', async () => {
    const res = await POST();
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.url).toBe('https://billing.stripe.com/p/session_xyz');
  });

  it('returns 401 when no session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    const res = await POST();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe('unauthorized');
  });

  it('returns 400 when no stripeCustomerId', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.query.merchants.findFirst).mockResolvedValueOnce({ id: 'SM-X', stripeCustomerId: null } as never);
    const res = await POST();
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('no stripe customer');
  });
});
