import { db, schema } from '@shoppingmate/db';
import { createRedisConnection, onboardingQueue } from '@shoppingmate/jobs';
import { childLogger } from '@shoppingmate/shared';
import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import { nextInstallAction } from '../lib/nextInstallAction.js';
import { originMatches } from '../lib/originCheck.js';
import { isAllowed } from '../lib/rateLimiter.js';

const log = childLogger({ route: 'install' });
const redis = createRedisConnection();

const InstallBody = z.object({
  merchantId: z.string().regex(/^SM-[A-Z0-9]{6}$/),
  domain: z.string().min(1),
  userAgent: z.string().min(1),
  referrer: z.string().optional().nullable(),
});

type Outcome = (typeof schema.installOutcomes)[number];

async function recordAttempt(
  c: { req: { header: (n: string) => string | undefined } },
  body: { merchantId: string | null; domain: string; userAgent: string; referrer?: string | null },
  sourceIp: string,
  outcome: Outcome,
): Promise<void> {
  await db.insert(schema.installAttempts).values({
    merchantId: body.merchantId,
    domain: body.domain,
    sourceIp,
    userAgent: body.userAgent,
    referer: body.referrer ?? null,
    outcome,
  });
}

function clientIp(
  c: { req: { header: (n: string) => string | undefined } },
  fallback: string,
): string {
  return c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ?? fallback;
}

export const installRoute = new Hono();

installRoute.post('/', async (c) => {
  const sourceIp = clientIp(c, c.req.header('x-real-ip') ?? '0.0.0.0');
  const userAgentHeader = c.req.header('user-agent') ?? '';
  const refererHeader = c.req.header('referer') ?? null;

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = null;
  }
  const parsed = InstallBody.safeParse(raw);
  if (!parsed.success) {
    await recordAttempt(
      c,
      { merchantId: null, domain: 'unknown', userAgent: userAgentHeader, referrer: refererHeader },
      sourceIp,
      'invalid_body',
    );
    return c.json({ error: 'invalid_body', message: 'invalid request body' }, 400);
  }
  const body = parsed.data;

  const origin = c.req.header('origin');
  const referer = c.req.header('referer');
  if (!originMatches(origin, referer, body.domain)) {
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'rejected_origin');
    log.info({ merchantId: body.merchantId, origin, referer }, 'rejected_origin');
    return c.json({ error: 'origin_mismatch', message: 'origin/referer must match domain' }, 403);
  }

  const now = Date.now();
  const merchantOk = await isAllowed(redis, `rl:merchant:${body.merchantId}`, 10, 60_000, now);
  const ipOk = await isAllowed(redis, `rl:ip:${sourceIp}`, 100, 60_000, now);
  if (!merchantOk || !ipOk) {
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'rate_limited');
    log.warn({ merchantId: body.merchantId, sourceIp, merchantOk, ipOk }, 'rate_limited');
    return c.json({ error: 'rate_limited', message: 'too many requests' }, 429);
  }

  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, body.merchantId))
    .limit(1);

  if (!merchant) {
    await recordAttempt(
      c,
      { ...body, merchantId: null, referrer: refererHeader },
      sourceIp,
      'merchant_not_found',
    );
    return c.json({ error: 'merchant_not_found', message: 'unknown merchantId' }, 404);
  }

  if (!merchant.allowedDomains.includes(body.domain)) {
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'rejected_domain');
    log.warn({ merchantId: body.merchantId, domain: body.domain }, 'rejected_domain');
    return c.json({ error: 'domain_not_allowed', message: 'domain not in allowlist' }, 403);
  }

  const action = nextInstallAction(
    { status: merchant.status, lastInstallAt: merchant.lastInstallAt },
    new Date(now),
  );

  if (action.kind === 'enqueue') {
    const updated = await db
      .update(schema.merchants)
      .set({
        status: 'onboarding',
        lastError: null,
        lastInstallAt: new Date(now),
      })
      .where(
        sql`${schema.merchants.id} = ${body.merchantId} AND ${schema.merchants.status} = ${merchant.status}`,
      )
      .returning({ id: schema.merchants.id });

    if (updated.length === 1) {
      await onboardingQueue.add('onboarding', {
        merchantId: body.merchantId,
        domain: body.domain,
      });
      await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'enqueued');
      log.info({ merchantId: body.merchantId }, 'enqueued onboarding');
    } else {
      await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'noop');
    }
  } else {
    await db
      .update(schema.merchants)
      .set({ lastInstallAt: new Date(now) })
      .where(eq(schema.merchants.id, body.merchantId));
    await recordAttempt(c, { ...body, referrer: refererHeader }, sourceIp, 'noop');
  }

  const [fresh] = await db
    .select({
      status: schema.merchants.status,
      personaId: schema.merchants.personaId,
      platform: schema.merchants.platform,
      widgetPosition: schema.merchants.widgetPosition,
      widgetSize: schema.merchants.widgetSize,
    })
    .from(schema.merchants)
    .where(eq(schema.merchants.id, body.merchantId))
    .limit(1);

  return c.json(
    {
      status: fresh?.status ?? merchant.status,
      personaId: fresh?.personaId ?? merchant.personaId,
      platform: fresh?.platform ?? merchant.platform ?? null,
      widgetPosition: fresh?.widgetPosition ?? null,
      widgetSize: fresh?.widgetSize ?? null,
    },
    200,
  );
});
