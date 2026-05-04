import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'pending', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: { update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })) },
}));

import { POST } from './route';

describe('POST /api/install/start-url', () => {
  it('rejects invalid URL', async () => {
    const req = new Request('http://localhost/api/install/start-url', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'not-a-url' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts valid URL and updates merchant', async () => {
    const req = new Request('http://localhost/api/install/start-url', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});
