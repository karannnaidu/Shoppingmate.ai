import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@shoppingmate/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [
            {
              id: 'SM-ABC123',
              allowedDomains: ['example.com'],
              personaId: 'coach',
            },
          ],
        }),
      }),
    }),
  },
  schema: { merchants: { id: 'id' } },
}));

vi.mock('@shoppingmate/agent', () => ({
  lookupPersona: (id: string | null | undefined) => ({ id: id ?? 'concierge' }),
}));

const { voiceTokenRoute } = await import('./voice-token.js');

describe('POST /v1/voice/token', () => {
  beforeEach(() => {
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'API_test';
    process.env.LIVEKIT_API_SECRET = 'secret_test_at_least_32_chars_long';
  });

  it('400 on invalid body', async () => {
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ wrong: 'body' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(400);
  });

  it('200 with token + roomName + personaId on valid request', async () => {
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      roomName: string;
      token: string;
      wsUrl: string;
      personaId: string;
    };
    expect(body.roomName).toBe('sm_ws_abc');
    expect(body.token).toBeTruthy();
    expect(body.wsUrl).toBe('wss://test.livekit.cloud');
    expect(body.personaId).toBe('coach');
  });

  it('403 on origin mismatch', async () => {
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://evil.com' },
    });
    expect(res.status).toBe(403);
  });

  it('503 when LiveKit env not configured', async () => {
    delete process.env.LIVEKIT_URL;
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(503);
  });
});
