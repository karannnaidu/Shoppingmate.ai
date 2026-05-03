import { createHmac, timingSafeEqual } from 'node:crypto';

const SECRET = process.env.INSTALL_TOKEN_SECRET ?? 'dev-secret-change-me';

export type WsTokenPayload = {
  sessionId: string;
  merchantId: string;
  /** unix epoch seconds */
  exp: number;
};

/**
 * Produce a base64url-encoded `<body>.<sig>` token signed with HS256-equivalent
 * HMAC-SHA256. Compact stand-in for jose/jsonwebtoken so we avoid a fresh dep
 * for a single signed payload — full JWT comes in Plan 4 with Auth0/Composio.
 */
export function signWsToken(p: WsTokenPayload): string {
  const body = Buffer.from(JSON.stringify(p)).toString('base64url');
  const sig = createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyWsToken(token: string): WsTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(body).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length) return null;
  if (!timingSafeEqual(sigBuf, expBuf)) return null;
  let p: WsTokenPayload;
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString()) as WsTokenPayload;
  } catch {
    return null;
  }
  if (typeof p.exp !== 'number' || p.exp < Date.now() / 1000) return null;
  if (typeof p.sessionId !== 'string' || typeof p.merchantId !== 'string') return null;
  return p;
}
