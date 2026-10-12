import { createHmac, timingSafeEqual } from 'node:crypto';

// Short-lived token for the WebSocket voice transport (our LiveKit
// replacement). The api signs it in /v1/voice-token; the voice-agent verifies
// it before opening a call. Shared secret: VOICE_WS_SECRET.

const sign = (payload: string, secret: string) => createHmac('sha256', secret).update(payload).digest('base64url');

export function signVoiceToken(
  claims: { sessionId: string; merchantId: string },
  secret: string,
  ttlSeconds = 15 * 60,
  nowMs = Date.now(),
): string {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ s: claims.sessionId, m: claims.merchantId, exp })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyVoiceToken(
  token: string,
  secret: string,
  nowMs = Date.now(),
): { sessionId: string; merchantId: string } | null {
  if (!secret) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = Buffer.from(sign(payload, secret));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const c = JSON.parse(Buffer.from(payload, 'base64url').toString()) as { s?: unknown; m?: unknown; exp?: unknown };
    if (typeof c.s !== 'string' || typeof c.m !== 'string' || typeof c.exp !== 'number') return null;
    if (c.exp * 1000 < nowMs) return null;
    return { sessionId: c.s, merchantId: c.m };
  } catch {
    return null;
  }
}

/** Is the WebSocket voice transport on for this merchant? VOICE_WS_MERCHANTS = '*' or a comma list. */
export function voiceWsEnabled(merchantId: string, list = process.env.VOICE_WS_MERCHANTS ?? ''): boolean {
  const ids = list.split(',').map((s) => s.trim()).filter(Boolean);
  return ids.includes('*') || ids.includes(merchantId);
}
