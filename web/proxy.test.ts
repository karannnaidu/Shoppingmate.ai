import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: { getSession: vi.fn().mockResolvedValue(null) },
  },
}));

describe('proxy', () => {
  it('redirects unauthenticated /app requests to /login', async () => {
    const req = new NextRequest('https://app.shoppingmate.ai/app');
    const res = await proxy(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toContain('/login');
  });

  it('rewrites app subdomain to /app prefix', async () => {
    const req = new NextRequest('https://app.shoppingmate.ai/');
    const res = await proxy(req);
    expect(res?.headers.get('x-proxy-rewrite') || res?.headers.get('location')).toBeTruthy();
  });
});
