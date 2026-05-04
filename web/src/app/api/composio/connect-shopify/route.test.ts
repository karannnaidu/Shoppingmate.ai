import { describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'pending', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/composio', () => ({
  startShopifyConnection: vi.fn().mockResolvedValue({ authUrl: 'https://shopify.com/oauth/x', connectionId: 'conn_test' }),
}));

import { POST } from './route';

describe('POST /api/composio/connect-shopify', () => {
  it('returns auth_url when authenticated', async () => {
    const req = new Request('http://localhost/api/composio/connect-shopify', { method: 'POST' });
    const res = await POST(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.auth_url).toContain('shopify.com');
  });

  it('returns 401 when no session', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce(null);
    const req = new Request('http://localhost/api/composio/connect-shopify', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no merchant', async () => {
    const { getDashboardSession } = await import('@/lib/session');
    vi.mocked(getDashboardSession).mockResolvedValueOnce({
      user: { id: 'u1', email: 'a@b.co', name: null, image: null },
      session: { id: 's1', expiresAt: new Date() },
      merchant: null,
    });
    const req = new Request('http://localhost/api/composio/connect-shopify', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
