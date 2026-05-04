// @vitest-environment node
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));

vi.mock('@/lib/session', () => ({
  getDashboardSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'a@b.co', name: null, image: null },
    session: { id: 's1', expiresAt: new Date() },
    merchant: { id: 'SM-TEST01', plan: 'starter', billingStatus: 'active', status: 'live', persona: null, leadWebhookUrl: null, knowledgeBaseStatus: 'empty', lastWidgetPing: null },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    query: { merchants: { findFirst: vi.fn().mockResolvedValue({ id: 'SM-TEST01', domain: 'example.com' }) } },
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })) })),
  },
}));

const server = setupServer();
server.listen({ onUnhandledRequest: 'error' });

// Keep MSW state scoped to this file so it doesn't bleed into other test files
// in the same vitest process.
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

import { POST } from './route';

describe('POST /api/install/verify', () => {
  it('returns ok=true when script tag found', async () => {
    server.use(
      http.get('https://example.com', () => HttpResponse.html('<html><body><script async src="https://cdn.shoppingmate.ai/widget/v1.js" data-id="SM-TEST01"></script></body></html>')),
    );
    const req = new Request('http://localhost/api/install/verify', { method: 'POST' });
    const res = await POST(req);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });

  it('returns ok=false when script tag missing', async () => {
    server.use(http.get('https://example.com', () => HttpResponse.html('<html><body></body></html>')));
    const req = new Request('http://localhost/api/install/verify', { method: 'POST' });
    const res = await POST(req);
    const json = await res.json();
    expect(json.ok).toBe(false);
  });
});
