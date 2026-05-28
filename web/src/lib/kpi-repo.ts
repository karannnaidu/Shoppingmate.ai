import { db } from './db';
import { metricEvents, conversionEvents } from '@shoppingmate/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export type Kpis = {
  conversations: number;
  assistedRevenueCents: number;
  assistedOrderCount: number;
  influencedRevenueCents: number;
  influencedOrderCount: number;
  voiceRatio: number;
  voiceConversations: number;
};

export async function computeKpis(args: { merchantId: string; days: number }): Promise<Kpis> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);

  const [metricRows, conversionRows] = await Promise.all([
    db
      .select({
        name: metricEvents.metricName,
        count: sql<number>`count(*)::int`,
      })
      .from(metricEvents)
      .where(and(eq(metricEvents.merchantId, args.merchantId), gte(metricEvents.ts, since)))
      .groupBy(metricEvents.metricName),
    db
      .select({
        kind: conversionEvents.attributionKind,
        totalCents: conversionEvents.totalCents,
        orderId: conversionEvents.orderId,
      })
      .from(conversionEvents)
      .where(and(eq(conversionEvents.merchantId, args.merchantId), gte(conversionEvents.occurredAt, since))),
  ]);

  const byName = new Map(metricRows.map((r) => [r.name, r]));
  const conversations = byName.get('conversationCompleted')?.count ?? 0;
  const voiceConversations = byName.get('voiceConversation')?.count ?? 0;

  const assistedRows = conversionRows.filter((r) => r.kind === 'assisted');
  const influencedRows = conversionRows.filter((r) => r.kind === 'influenced');

  return {
    conversations,
    assistedRevenueCents: assistedRows.reduce((s, r) => s + r.totalCents, 0),
    assistedOrderCount: new Set(assistedRows.map((r) => r.orderId)).size,
    influencedRevenueCents: influencedRows.reduce((s, r) => s + r.totalCents, 0),
    influencedOrderCount: new Set(influencedRows.map((r) => r.orderId)).size,
    voiceConversations,
    voiceRatio: conversations > 0 ? voiceConversations / conversations : 0,
  };
}
