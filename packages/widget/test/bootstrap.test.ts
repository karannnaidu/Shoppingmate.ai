import { afterEach, describe, expect, it, vi } from 'vitest';
import { bootstrap, type BootstrapResult } from '../src/bootstrap.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('bootstrap', () => {
  it('POSTs install + session and returns wsUrl', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/install')) return new Response(JSON.stringify({ status: 'live' }));
      if (url.endsWith('/v1/session'))
        return new Response(
          JSON.stringify({
            sessionId: 'ws_a',
            wsToken: 'tok',
            wsUrl: 'wss://api/v1/widget/ws_a/agent?token=tok',
          }),
        );
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res: BootstrapResult = await bootstrap({
      apiBase: 'https://api',
      merchantId: 'SM-TST001',
      domain: 'merchant.example.com',
    });
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.sessionId).toBe('ws_a');
      expect(res.wsUrl).toContain('/v1/widget/ws_a/agent');
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns err when install fails', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('rejected', { status: 403 }));
    vi.stubGlobal('fetch', fetchMock);
    const res = await bootstrap({
      apiBase: 'https://api',
      merchantId: 'SM-TST001',
      domain: 'merchant.example.com',
    });
    expect(res.kind).toBe('err');
  });
});
