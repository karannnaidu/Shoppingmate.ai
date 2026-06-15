import { db } from './db';
import { conversionEvents } from '@shoppingmate/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';

export type LedgerLineItem = {
  sku: string;
  quantity: number;
  priceCents: number;
  wasRecommended: boolean;
};

export type LedgerRow = {
  id: number;
  orderId: string;
  totalCents: number;
  currency: string;
  attributionKind: string;
  matchSource: string;
  occurredAt: Date;
  sessionId: string | null;
  lineItems: LedgerLineItem[];
};

/**
 * Conversions / order ledger for the Audit page — every order the assistant
 * influenced or placed (assisted/influenced; Shopify/gtag/COD) in the window.
 */
export async function listConversions(args: {
  merchantId: string;
  days: number;
}): Promise<LedgerRow[]> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: conversionEvents.id,
      orderId: conversionEvents.orderId,
      totalCents: conversionEvents.totalCents,
      currency: conversionEvents.currency,
      attributionKind: conversionEvents.attributionKind,
      matchSource: conversionEvents.matchSource,
      occurredAt: conversionEvents.occurredAt,
      sessionId: conversionEvents.sessionId,
      lineItems: conversionEvents.lineItems,
    })
    .from(conversionEvents)
    .where(and(eq(conversionEvents.merchantId, args.merchantId), gte(conversionEvents.occurredAt, since)))
    .orderBy(desc(conversionEvents.occurredAt))
    .limit(500);
  return rows as LedgerRow[];
}
