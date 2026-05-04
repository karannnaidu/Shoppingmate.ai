import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue(null) },
  },
}));

describe('middleware', () => {
  it('redirects unauthenticated /app requests to /login', async () => {
    const req = new NextRequest('https://app.shoppingmate.ai/app');
    const res = await middleware(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/login');
  });

  it('rewrites app subdomain to /app prefix', async () => {
    const req = new NextRequest('https://app.shoppingmate.ai/');
    const res = await middleware(req);
    expect(res?.headers.get('x-middleware-rewrite') || res?.headers.get('location')).toBeTruthy();
  });
});
