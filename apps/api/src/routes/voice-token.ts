import { lookupPersona } from '@shoppingmate/agent';
import { db, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { AccessToken } from 'livekit-server-sdk';
import { z } from 'zod';
import { originMatches } from '../lib/originCheck.js';

const log = childLogger({ route: 'voice-token' });

const Body = z.object({
  sessionId: z.string().regex(/^ws_[a-z0-9]+$/),
  merchantId: z.string().regex(/^SM-[A-Z0-9]{6}$/),
});

const TOKEN_TTL_SECONDS = 24 * 60 * 60;

export const voiceTokenRoute = new Hono();

voiceTokenRoute.post('/', async (c) => {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const { sessionId, merchantId } = parsed.data;

  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);
  if (!merchant) {
    return c.json({ error: 'merchant_not_found' }, 404);
  }

  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  const matchesAny = merchant.allowedDomains.some((d: string) =>
    originMatches(origin, referer, d),
  );
  if (!matchesAny) {
    log.info({ merchantId, origin, referer }, 'voice-token rejected_origin');
    return c.json({ error: 'origin_mismatch' }, 403);
  }

  const lkUrl = process.env.LIVEKIT_URL;
  const lkApiKey = process.env.LIVEKIT_API_KEY;
  const lkApiSecret = process.env.LIVEKIT_API_SECRET;
  if (!lkUrl || !lkApiKey || !lkApiSecret) {
    log.error({}, 'LiveKit env not configured');
    return c.json({ error: 'voice_unavailable' }, 503);
  }

  const roomName = `sm_${sessionId}`;
  const at = new AccessToken(lkApiKey, lkApiSecret, {
    identity: `visitor_${sessionId}`,
    ttl: TOKEN_TTL_SECONDS,
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();

  const persona = lookupPersona(merchant.personaId);

  return c.json({ wsUrl: lkUrl, roomName, token, personaId: persona.id }, 200);
});
