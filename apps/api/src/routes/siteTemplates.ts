import { db, schema } from '@shoppingmate/db';
import { siteTemplateScanQueue } from '@shoppingmate/jobs';
import { logger } from '@shoppingmate/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Redis } from 'ioredis';

// Nav PRD Phase 2 — template site map for the widget + drift self-healing.
//
// GET  /v1/site-templates/:merchantId          → the merchant's templates (skeleton,
//      recipes, URL pattern) — page STRUCTURE only, nothing per-visitor.
// POST /v1/site-templates/:merchantId/signal   → widget reports drift (page no
//      longer matches its template) or an unverified click on a template page.
//      DRIFT_SESSIONS distinct sessions (or VERIFY_SESSIONS for clicks) mark the
//      template stale and enqueue a re-scan of just that page type, rate-limited.

export const DRIFT_SESSIONS = 3;
export const VERIFY_SESSIONS = 2;
const RESCAN_COOLDOWN_S = 6 * 60 * 60;
const SIGNAL_WINDOW_S = 24 * 60 * 60;

export function templateCacheEnabled(): boolean {
  return (
    (process.env.NAV_TEMPLATE_CACHE ?? '').trim() !== '' && process.env.NAV_TEMPLATE_CACHE !== '0'
  );
}

export type SignalDeps = {
  redis: Pick<Redis, 'sadd' | 'scard' | 'expire' | 'set'>;
  enqueue: (data: { merchantId: string; pageType: string; trigger: string }) => Promise<void>;
};

/** Pure-ish core so it can be unit-tested without HTTP. Returns what happened. */
export async function handleTemplateSignal(
  deps: SignalDeps,
  input: {
    merchantId: string;
    templateId: string;
    pageType: string;
    kind: 'drift' | 'verify';
    sessionId: string;
  },
): Promise<{ sessions: number; rescanQueued: boolean }> {
  const setKey = `sm:tpl:${input.kind}:${input.templateId}`;
  await deps.redis.sadd(setKey, input.sessionId);
  await deps.redis.expire(setKey, SIGNAL_WINDOW_S);
  const sessions = await deps.redis.scard(setKey);
  const threshold = input.kind === 'drift' ? DRIFT_SESSIONS : VERIFY_SESSIONS;
  if (sessions < threshold) return { sessions, rescanQueued: false };
  // Cooldown: at most one re-scan per template per window.
  const ok = await deps.redis.set(
    `sm:tpl:rescan:${input.templateId}`,
    '1',
    'EX',
    RESCAN_COOLDOWN_S,
    'NX',
  );
  if (ok !== 'OK') return { sessions, rescanQueued: false };
  await deps.enqueue({
    merchantId: input.merchantId,
    pageType: input.pageType,
    trigger: input.kind,
  });
  return { sessions, rescanQueued: true };
}

export function createSiteTemplatesRoute(redis: Redis): Hono {
  const route = new Hono();

  route.get('/:merchantId', async (c) => {
    if (!templateCacheEnabled()) return c.json({ templates: [] });
    const merchantId = c.req.param('merchantId');
    const rows = await db
      .select({
        id: schema.siteTemplates.id,
        pageType: schema.siteTemplates.pageType,
        urlPattern: schema.siteTemplates.urlPattern,
        skeleton: schema.siteTemplates.skeleton,
        recipes: schema.siteTemplates.recipes,
      })
      .from(schema.siteTemplates)
      .where(
        and(
          eq(schema.siteTemplates.merchantId, merchantId),
          inArray(schema.siteTemplates.status, ['fresh', 'stale', 'scanning']),
        ),
      );
    c.header('Cache-Control', 'public, max-age=300');
    return c.json({ templates: rows });
  });

  route.post('/:merchantId/signal', async (c) => {
    if (!templateCacheEnabled()) return c.json({ ok: true, ignored: true });
    const merchantId = c.req.param('merchantId');
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ ok: false }, 400);
    }
    const kind = body.kind === 'verify' ? 'verify' : body.kind === 'drift' ? 'drift' : null;
    const templateId = typeof body.templateId === 'string' ? body.templateId : '';
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId.slice(0, 80) : '';
    if (!kind || !templateId || !sessionId) return c.json({ ok: false }, 400);
    const tpl = await db.query.siteTemplates.findFirst({
      where: and(
        eq(schema.siteTemplates.id, templateId),
        eq(schema.siteTemplates.merchantId, merchantId),
      ),
    });
    if (!tpl) return c.json({ ok: false }, 404);

    await db
      .update(schema.siteTemplates)
      .set(
        kind === 'drift'
          ? { driftReports: sql`${schema.siteTemplates.driftReports} + 1`, lastDriftAt: new Date() }
          : { verifyFailures: sql`${schema.siteTemplates.verifyFailures} + 1` },
      )
      .where(eq(schema.siteTemplates.id, templateId));

    const res = await handleTemplateSignal(
      {
        redis,
        enqueue: async (data) => {
          await db
            .update(schema.siteTemplates)
            .set({ status: 'stale', scanTrigger: data.trigger, updatedAt: new Date() })
            .where(eq(schema.siteTemplates.id, templateId));
          await siteTemplateScanQueue.add('scan', data);
        },
      },
      { merchantId, templateId, pageType: tpl.pageType, kind, sessionId },
    );
    logger.info(
      {
        merchantId,
        templateId,
        pageType: tpl.pageType,
        kind,
        coverage: body.coverage,
        path: body.path,
        ...res,
      },
      'site-template signal',
    );
    return c.json({ ok: true, ...res });
  });

  return route;
}
