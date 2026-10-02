import type { SessionState } from '@shoppingmate/agent';
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

// In-memory stand-in for the redis-backed session repo. The voice-token
// handler reads it (loadSession) and writes a fresh session (saveSession +
// createSession) when none exists. The handler also backfills visitorId on
// an existing session when the caller provides one — assertions below tap
// this map to verify the persisted value.
const savedSessions = new Map<string, SessionState>();

vi.mock('@shoppingmate/agent', async () => {
  const actual = await vi.importActual<typeof import('@shoppingmate/agent')>('@shoppingmate/agent');
  return {
    ...actual,
    lookupPersona: (id: string | null | undefined) => ({ id: id ?? 'concierge' }),
    loadSession: async (_redis: unknown, sessionId: string) => savedSessions.get(sessionId) ?? null,
    saveSession: async (_redis: unknown, session: SessionState) => {
      savedSessions.set(session.sessionId, session);
    },
  };
});

// Controllable stand-in for month-to-date voice usage. The cap gate in the
// handler calls getVoiceMinutesThisMonth; tests set `usage.minutes` to drive it.
const usage = vi.hoisted(() => ({ minutes: 0 }));
vi.mock('../lib/voiceUsage.js', () => ({
  getVoiceMinutesThisMonth: async () => usage.minutes,
}));

const { voiceTokenRoute } = await import('./voice-token.js');

describe('POST /v1/voice/token', () => {
  beforeEach(() => {
    process.env.LIVEKIT_URL = 'wss://test.livekit.cloud';
    process.env.LIVEKIT_API_KEY = 'API_test';
    process.env.LIVEKIT_API_SECRET = 'secret_test_at_least_32_chars_long';
    process.env.VOICE_CAPS_ENABLED = 'false';
    usage.minutes = 0;
    savedSessions.clear();
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

  it('429 voice_cap_exceeded when month-to-date minutes reach the plan cap', async () => {
    process.env.VOICE_CAPS_ENABLED = 'true';
    usage.minutes = 200; // merchant has no plan field → starter cap = 200
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: string; capMinutes: number; usedMinutes: number };
    expect(body.error).toBe('voice_cap_exceeded');
    expect(body.capMinutes).toBe(200);
    expect(body.usedMinutes).toBe(200);
  });

  it('200 when month-to-date minutes are under the plan cap', async () => {
    process.env.VOICE_CAPS_ENABLED = 'true';
    usage.minutes = 199;
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(200);
  });

  it("does not gate when VOICE_CAPS_ENABLED is not 'true', even over the cap", async () => {
    usage.minutes = 10_000;
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({ sessionId: 'ws_abc', merchantId: 'SM-ABC123' }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(200);
  });

  it('persists visitorId on the seeded session when present in body', async () => {
    const app = new Hono().route('/', voiceTokenRoute);
    const res = await app.request('/', {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'ws_visitor',
        merchantId: 'SM-ABC123',
        visitorId: 'v_abc123',
      }),
      headers: { 'content-type': 'application/json', origin: 'https://example.com' },
    });
    expect(res.status).toBe(200);
    const stored = savedSessions.get('ws_visitor');
    expect(stored?.visitorId).toBe('v_abc123');
  });
});
