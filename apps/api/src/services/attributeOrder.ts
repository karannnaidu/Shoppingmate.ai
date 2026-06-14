import type { ConversionLineItem, NewConversionEvent } from '@shoppingmate/db';

export type OrderPayload = {
  merchantId: string;
  orderId: string;
  totalCents: number;
  currency: string;
  visitorId: string;
  occurredAt: Date;
  lineItems: Array<Pick<ConversionLineItem, 'sku' | 'quantity' | 'priceCents'>>;
  matchSource: 'shopify_webhook' | 'gtag' | 'cod';
};

export type SessionRow = { id: string; endedAt: Date | null };
export type RecommendationRow = { sessionId: string; sku: string };

export type AttributeOrderDeps = {
  findRecentSessionsForVisitor: (args: {
    merchantId: string;
    visitorId: string;
    windowEnd: Date;
    windowStart: Date;
  }) => Promise<SessionRow[]>;
  findRecommendationsForSessionAndSkus: (args: {
    sessionIds: string[];
    skus: string[];
  }) => Promise<RecommendationRow[]>;
  insertConversion: (row: NewConversionEvent) => Promise<{ inserted: boolean }>;
  attributionWindowDays: number;
};

export type AttributeResult = {
  wrote: Array<'assisted' | 'influenced'>;
  skipped: Array<'assisted' | 'influenced'>;
  missReason: 'no_visitor_in_window' | 'no_recommendation_match' | null;
};

export async function attributeOrder(
  order: OrderPayload,
  deps: AttributeOrderDeps,
): Promise<AttributeResult> {
  const windowMs = deps.attributionWindowDays * 24 * 3600 * 1000;
  const windowEnd = order.occurredAt;
  const windowStart = new Date(windowEnd.getTime() - windowMs);

  const sessions = await deps.findRecentSessionsForVisitor({
    merchantId: order.merchantId,
    visitorId: order.visitorId,
    windowEnd,
    windowStart,
  });

  if (sessions.length === 0) {
    return { wrote: [], skipped: [], missReason: 'no_visitor_in_window' };
  }

  // Most recent first: treat null endedAt as "still active" → ranks ahead of any ended session.
  const sorted = [...sessions].sort((a, b) => {
    const ae = a.endedAt === null ? Number.POSITIVE_INFINITY : a.endedAt.getTime();
    const be = b.endedAt === null ? Number.POSITIVE_INFINITY : b.endedAt.getTime();
    return be - ae;
  });
  const mostRecent = sorted[0]!;

  const skus = order.lineItems.map((li) => li.sku);
  const recs = await deps.findRecommendationsForSessionAndSkus({
    sessionIds: sorted.map((s) => s.id),
    skus,
  });
  const recommendedSkus = new Set(recs.map((r) => r.sku));
  const hasAssistedMatch = recs.length > 0;

  const wrote: Array<'assisted' | 'influenced'> = [];
  const skipped: Array<'assisted' | 'influenced'> = [];

  const baseRow = {
    merchantId: order.merchantId,
    orderId: order.orderId,
    totalCents: order.totalCents,
    currency: order.currency,
    visitorId: order.visitorId,
    occurredAt: order.occurredAt,
    matchSource: order.matchSource,
    attributionWindowDays: deps.attributionWindowDays,
    sessionId: mostRecent.id,
  } as const;

  // Influenced row (always when a session matches)
  {
    const lineItems: ConversionLineItem[] = order.lineItems.map((li) => ({
      ...li,
      wasRecommended: false,
    }));
    const out = await deps.insertConversion({
      ...baseRow,
      attributionKind: 'influenced',
      lineItems,
    });
    if (out.inserted) wrote.push('influenced');
    else skipped.push('influenced');
  }

  // Assisted row (only when at least one line item was recommended)
  if (hasAssistedMatch) {
    const lineItems: ConversionLineItem[] = order.lineItems.map((li) => ({
      ...li,
      wasRecommended: recommendedSkus.has(li.sku),
    }));
    const out = await deps.insertConversion({
      ...baseRow,
      attributionKind: 'assisted',
      lineItems,
    });
    if (out.inserted) wrote.push('assisted');
    else skipped.push('assisted');
  }

  const missReason = hasAssistedMatch ? null : ('no_recommendation_match' as const);
  return { wrote, skipped, missReason };
}
