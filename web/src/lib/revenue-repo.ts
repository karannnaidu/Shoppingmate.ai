import { db } from './db';
import { conversionEvents, type ConversionLineItem } from '@shoppingmate/db/schema';
import { and, eq, gte, desc } from 'drizzle-orm';

export type RevenueRow = {
  orderId: string;
  kind: 'assisted' | 'influenced';
  totalCents: number;
  currency: string;
  occurredAt: Date;
  lineItems: ConversionLineItem[];
};

export async function listRevenueRows(args: {
  merchantId: string;
  days: number;
  queryRows?: typeof defaultQuery;
}): Promise<RevenueRow[]> {
  const query = args.queryRows ?? defaultQuery;
  return query({ merchantId: args.merchantId, days: args.days });
}

async function defaultQuery(args: { merchantId: string; days: number }): Promise<RevenueRow[]> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
  const rows = await db
    .select({
      orderId: conversionEvents.orderId,
      kind: conversionEvents.attributionKind,
      totalCents: conversionEvents.totalCents,
      currency: conversionEvents.currency,
      occurredAt: conversionEvents.occurredAt,
      lineItems: conversionEvents.lineItems,
    })
    .from(conversionEvents)
    .where(and(eq(conversionEvents.merchantId, args.merchantId), gte(conversionEvents.occurredAt, since)))
    .orderBy(desc(conversionEvents.occurredAt));
  return rows.map((r) => ({ ...r, kind: r.kind as 'assisted' | 'influenced' }));
}
