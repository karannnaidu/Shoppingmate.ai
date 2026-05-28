import { Hono } from 'hono';
import { db, schema } from '@shoppingmate/db';
import { and, eq, gte } from 'drizzle-orm';

export type AttributionSummary = {
  assisted: { revenueCents: number; orderCount: number };
  influenced: { revenueCents: number; orderCount: number };
  windowDays: number;
};

export type ConversionRow = {
  kind: 'assisted' | 'influenced';
  totalCents: number;
  orderId: string;
};

export async function computeAttributionSummary(args: {
  merchantId: string;
  days: number;
  queryConversions: (args: { merchantId: string; since: Date }) => Promise<ConversionRow[]>;
}): Promise<AttributionSummary> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
  const rows = await args.queryConversions({ merchantId: args.merchantId, since });

  const assisted = rows.filter((r) => r.kind === 'assisted');
  const influenced = rows.filter((r) => r.kind === 'influenced');

  return {
    assisted: {
      revenueCents: assisted.reduce((s, r) => s + r.totalCents, 0),
      orderCount: new Set(assisted.map((r) => r.orderId)).size,
    },
    influenced: {
      revenueCents: influenced.reduce((s, r) => s + r.totalCents, 0),
      orderCount: new Set(influenced.map((r) => r.orderId)).size,
    },
    windowDays: args.days,
  };
}

export async function defaultQueryConversions(args: { merchantId: string; since: Date }): Promise<ConversionRow[]> {
  const rows = await db
    .select({
      kind: schema.conversionEvents.attributionKind,
      totalCents: schema.conversionEvents.totalCents,
      orderId: schema.conversionEvents.orderId,
    })
    .from(schema.conversionEvents)
    .where(
      and(
        eq(schema.conversionEvents.merchantId, args.merchantId),
        gte(schema.conversionEvents.occurredAt, args.since),
      ),
    );
  return rows.flatMap((r) =>
    r.kind === 'assisted' || r.kind === 'influenced'
      ? [{ kind: r.kind, totalCents: r.totalCents, orderId: r.orderId }]
      : [],
  );
}

export const dashboardAttributionRoute = new Hono();
dashboardAttributionRoute.get('/:merchantId', async (c) => {
  const merchantId = c.req.param('merchantId');
  const raw = Number(c.req.query('days') ?? '7');
  const days = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 90) : 7;
  const out = await computeAttributionSummary({
    merchantId,
    days,
    queryConversions: defaultQueryConversions,
  });
  return c.json(out);
});
