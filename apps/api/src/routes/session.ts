import { db, schema } from '@shoppingmate/db';
import { signWsToken } from '@shoppingmate/dom-harness';
import { childLogger, env } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { originMatches } from '../lib/originCheck.js';

const log = childLogger({ route: 'session' });

const SessionBody = z.object({
  merchantId: z.string().regex(/^SM-[A-Z0-9]{6}$/),
  domain: z.string().min(1),
});

const SESSION_TTL_SECONDS = 24 * 60 * 60;

function newSessionId(): string {
  const rand = Math.random().toString(36).slice(2, 12);
  const ts = Date.now().toString(36);
  return `ws_${ts}${rand}`;
}

function wsBaseUrl(): string {
  const apiBase = env.PUBLIC_API_BASE_URL || `http://localhost:${env.API_PORT}`;
  return apiBase.replace(/^http/, 'ws');
}

export const sessionRoute = new Hono();

sessionRoute.post('/', async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const parsed = SessionBody.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const body = parsed.data;

  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  if (!originMatches(origin, referer, body.domain)) {
    log.info({ merchantId: body.merchantId, origin, referer }, 'session rejected_origin');
    return c.json(
      { error: 'origin_mismatch', message: 'origin/referer must match domain' },
      403,
    );
  }

  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, body.merchantId))
    .limit(1);

  if (!merchant) {
    return c.json({ error: 'merchant_not_found', message: 'unknown merchantId' }, 404);
  }

  if (!merchant.allowedDomains.includes(body.domain)) {
    log.warn({ merchantId: body.merchantId, domain: body.domain }, 'session rejected_domain');
    return c.json({ error: 'domain_not_allowed', message: 'domain not in allowlist' }, 403);
  }

  const sessionId = newSessionId();
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const wsToken = signWsToken({ sessionId, merchantId: body.merchantId, exp });
  const wsUrl = `${wsBaseUrl()}/v1/widget/${sessionId}/agent?token=${wsToken}`;

  return c.json({ sessionId, wsToken, wsUrl }, 200);
});
