import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

import { GET } from './route';

describe('GET /api/merchant/status', () => {
  it('returns the current merchant status', async () => {
    const req = new Request('http://localhost/api/merchant/status');
    const res = await GET(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.status).toBe('live');
  });
});
