import { Hono } from 'hono';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { db, schema } from '@shoppingmate/db';
import { and, eq, gte, inArray, isNull, lte, or } from 'drizzle-orm';
import { attributeOrder, type OrderPayload, type AttributeResult } from '../services/attributeOrder.js';

export function computeHmac(rawBody: string, secret: string): string {
  return createHmac('sha256', secret).update(rawBody).digest('base64');
}

function safeEqual(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ab.length !== bb.length) return false;
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

export type RecordMetricFn = (args: {
  merchantId: string;
  metricName: string;
  tags?: Record<string, string | number | boolean>;
}) => Promise<void>;

export type ConversionIngestArgs = {
  rawBody: string;
  hmacHeader: string;
  lookupMerchantSecret: (merchantId: string) => Promise<string | null>;
  attribute: (order: OrderPayload) => Promise<AttributeResult>;
  recordMetric: RecordMetricFn;
};

export type ConversionIngestResponse = {
  status: number;
  body: { ok?: true; error?: string; wrote?: AttributeResult['wrote']; missReason?: string | null };
};

export async function handleConversionIngest(
  args: ConversionIngestArgs,
): Promise<ConversionIngestResponse> {
  if (!args.hmacHeader) return { status: 401, body: { error: 'auth_failed' } };

  let payload: any;
  try {
    payload = JSON.parse(args.rawBody);
  } catch {
    return { status: 400, body: { error: 'invalid_json' } };
  }
  if (!payload?.merchantId || !payload?.orderId || !payload?.visitorId) {
    return { status: 400, body: { error: 'missing_fields' } };
  }

  const totalCents = Number(payload.totalCents);
  if (!Number.isFinite(totalCents) || totalCents < 0) {
    return { status: 400, body: { error: 'invalid_amount' } };
  }

  const occurredAtRaw = payload.occurredAt ?? Date.now();
  const occurredAt = new Date(occurredAtRaw);
  if (Number.isNaN(occurredAt.getTime())) {
    return { status: 400, body: { error: 'invalid_occurred_at' } };
  }

  let secret: string | null;
  try {
    secret = await args.lookupMerchantSecret(payload.merchantId);
  } catch (err) {
    console.error('[conversion] lookupMerchantSecret failed', { merchantId: payload.merchantId, err });
    return { status: 500, body: { error: 'internal' } };
  }
  if (!secret) return { status: 404, body: { error: 'merchant_unknown' } };

  const expected = computeHmac(args.rawBody, secret);
  if (!safeEqual(expected, args.hmacHeader)) {
    return { status: 401, body: { error: 'auth_failed' } };
  }

  const order: OrderPayload = {
    merchantId: payload.merchantId,
    orderId: String(payload.orderId),
    totalCents,
    currency: String(payload.currency ?? 'USD'),
    visitorId: payload.visitorId,
    occurredAt,
    lineItems: Array.isArray(payload.lineItems)
      ? payload.lineItems.map((li: any) => ({
          sku: String(li.sku),
          quantity: Number(li.quantity ?? 1),
          priceCents: Number(li.priceCents ?? 0),
        }))
      : [],
    matchSource: 'gtag',
  };

  let result: AttributeResult;
  try {
    result = await args.attribute(order);
  } catch (err) {
    console.error('[conversion] attribute failed', { merchantId: payload.merchantId, err });
    return { status: 500, body: { error: 'internal' } };
  }

  // Emit telemetry counters. Auth-failed / merchant-unknown branches don't emit
  // because the DB FK on metric_events requires a valid merchantId we don't have there.
  for (const kind of result.wrote) {
    await args.recordMetric({
      merchantId: payload.merchantId,
      metricName: schema.metricNames.conversionIngested,
      tags: { source: 'gtag', kind },
    });
  }
  for (const kind of result.skipped) {
    await args.recordMetric({
      merchantId: payload.merchantId,
      metricName: schema.metricNames.conversionMissDuplicate,
      tags: { source: 'gtag', kind },
    });
  }

  return { status: 200, body: { ok: true, wrote: result.wrote, missReason: result.missReason } };
}

// Default repo wiring for production use; the handler above stays pure for tests.
export async function defaultRecordMetric(args: {
  merchantId: string;
  metricName: string;
  tags?: Record<string, string | number | boolean>;
}): Promise<void> {
  await db.insert(schema.metricEvents).values({
    merchantId: args.merchantId,
    metricName: args.metricName,
    value: '1',
    tags: args.tags,
  });
}

export async function defaultLookupMerchantSecret(merchantId: string): Promise<string | null> {
  const row = await db.query.merchants.findFirst({
    where: eq(schema.merchants.id, merchantId),
  });
  return row?.scriptSecret ?? null;
}

export async function defaultAttribute(order: OrderPayload): Promise<AttributeResult> {
  return attributeOrder(order, {
    attributionWindowDays: 7,
    findRecentSessionsForVisitor: async ({ merchantId, visitorId, windowStart, windowEnd }) => {
      const rows = await db
        .select({ id: schema.conversationSessions.id, endedAt: schema.conversationSessions.endedAt })
        .from(schema.conversationSessions)
        .where(
          and(
            eq(schema.conversationSessions.merchantId, merchantId),
            eq(schema.conversationSessions.visitorId, visitorId),
            lte(schema.conversationSessions.startedAt, windowEnd),
            or(
              isNull(schema.conversationSessions.endedAt),
              gte(schema.conversationSessions.endedAt, windowStart),
            ),
          ),
        );
      return rows;
    },
    findRecommendationsForSessionAndSkus: async ({ sessionIds, skus }) => {
      if (sessionIds.length === 0 || skus.length === 0) return [];
      const rows = await db
        .select({
          sessionId: schema.recommendationEvents.sessionId,
          sku: schema.recommendationEvents.sku,
        })
        .from(schema.recommendationEvents)
        .where(
          and(
            inArray(schema.recommendationEvents.sessionId, sessionIds),
            inArray(schema.recommendationEvents.sku, skus),
          ),
        );
      return rows;
    },
    insertConversion: async (row) => {
      const inserted = await db
        .insert(schema.conversionEvents)
        .values(row)
        .onConflictDoNothing({
          target: [
            schema.conversionEvents.merchantId,
            schema.conversionEvents.orderId,
            schema.conversionEvents.attributionKind,
          ],
        })
        .returning({ id: schema.conversionEvents.id });
      return { inserted: inserted.length > 0 };
    },
  });
}

export const conversionRoute = new Hono();

conversionRoute.post('/', async (c) => {
  const rawBody = await c.req.text();
  const hmacHeader = c.req.header('X-SM-Signature') ?? '';
  const out = await handleConversionIngest({
    rawBody,
    hmacHeader,
    lookupMerchantSecret: defaultLookupMerchantSecret,
    attribute: defaultAttribute,
    recordMetric: defaultRecordMetric,
  });
  return c.json(out.body, out.status as 200 | 400 | 401 | 404 | 500);
});
