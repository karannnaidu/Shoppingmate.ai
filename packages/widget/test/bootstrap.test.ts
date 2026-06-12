import { afterEach, describe, expect, it, vi } from 'vitest';
import { type BootstrapResult, bootstrap } from '../src/bootstrap.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('bootstrap', () => {
  it('POSTs install + session + voice and returns wsUrl + voice handle', async () => {
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
      if (url.endsWith('/v1/voice/token'))
        return new Response(
          JSON.stringify({
            wsUrl: 'wss://livekit.cloud',
            roomName: 'sm_ws_a',
            token: 'lk-jwt',
            personaId: 'concierge',
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
      expect(res.voice).not.toBeNull();
      expect(res.voice?.roomName).toBe('sm_ws_a');
      expect(res.voice?.token).toBe('lk-jwt');
      expect(res.voice?.personaId).toBe('concierge');
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
    // 4xx is a permanent rejection — do NOT retry it.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries install on a transient 5xx and then succeeds', async () => {
    // Reproduces the production bug: a transient API error (unlogged 500 with no
    // CORS header → browser reports a CORS failure) on a bootstrap call used to
    // abort the whole bootstrap, leaving voice unconfigured. Bootstrap must now
    // retry the transient failure instead of giving up.
    let installCalls = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/install')) {
        installCalls += 1;
        if (installCalls === 1) return new Response('boom', { status: 500 });
        return new Response(JSON.stringify({ status: 'live' }));
      }
      if (url.endsWith('/v1/session'))
        return new Response(
          JSON.stringify({ sessionId: 'ws_a', wsUrl: 'wss://api/v1/widget/ws_a/agent?token=tok' }),
        );
      if (url.endsWith('/v1/voice/token'))
        return new Response(
          JSON.stringify({ wsUrl: 'wss://livekit.cloud', roomName: 'sm_ws_a', token: 'lk', personaId: 'concierge' }),
        );
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await bootstrap({
      apiBase: 'https://api',
      merchantId: 'SM-TST001',
      domain: 'merchant.example.com',
    });
    expect(res.kind).toBe('ok');
    expect(installCalls).toBe(2);
  });

  it('retries session on a transient network throw and then succeeds', async () => {
    let sessionCalls = 0;
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/install')) return new Response(JSON.stringify({ status: 'live' }));
      if (url.endsWith('/v1/session')) {
        sessionCalls += 1;
        if (sessionCalls === 1) throw new TypeError('Failed to fetch');
        return new Response(
          JSON.stringify({ sessionId: 'ws_a', wsUrl: 'wss://api/v1/widget/ws_a/agent?token=tok' }),
        );
      }
      if (url.endsWith('/v1/voice/token'))
        return new Response(
          JSON.stringify({ wsUrl: 'wss://livekit.cloud', roomName: 'sm_ws_a', token: 'lk', personaId: 'concierge' }),
        );
      return new Response('not found', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await bootstrap({
      apiBase: 'https://api',
      merchantId: 'SM-TST001',
      domain: 'merchant.example.com',
    });
    expect(res.kind).toBe('ok');
    expect(sessionCalls).toBe(2);
  });

  it('still bootstraps successfully when /v1/voice/token returns 503', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/install')) return new Response(JSON.stringify({ status: 'live' }));
      if (url.endsWith('/v1/session'))
        return new Response(
          JSON.stringify({
            sessionId: 'ws_a',
            wsUrl: 'wss://api/v1/widget/ws_a/agent?token=tok',
          }),
        );
      if (url.endsWith('/v1/voice/token'))
        return new Response('voice unavailable', { status: 503 });
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
      expect(res.voice).toBeNull();
    }
  });

  it('still bootstraps successfully when /v1/voice/token throws', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/v1/install')) return new Response(JSON.stringify({ status: 'live' }));
      if (url.endsWith('/v1/session'))
        return new Response(
          JSON.stringify({
            sessionId: 'ws_a',
            wsUrl: 'wss://api/v1/widget/ws_a/agent?token=tok',
          }),
        );
      if (url.endsWith('/v1/voice/token')) throw new Error('network down');
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
      expect(res.voice).toBeNull();
    }
  });
});
