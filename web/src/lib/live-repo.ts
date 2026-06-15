import { db } from './db';
import { conversationSessions, conversionEvents } from '@shoppingmate/db/schema';
import { and, eq, gte, isNull, sql } from 'drizzle-orm';

export type LiveSnapshot = {
  activeConversations: number;
  conversionsToday: number;
  revenueTodayCents: number;
};

/** Near-real-time "happening now" counts for the dashboard live panel. */
export async function liveSnapshot(merchantId: string): Promise<LiveSnapshot> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [active, conv] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(conversationSessions)
      .where(and(eq(conversationSessions.merchantId, merchantId), isNull(conversationSessions.endedAt))),
    db
      .select({
        n: sql<number>`count(*)::int`,
        cents: sql<number>`coalesce(sum(${conversionEvents.totalCents}),0)::int`,
      })
      .from(conversionEvents)
      .where(and(eq(conversionEvents.merchantId, merchantId), gte(conversionEvents.occurredAt, startOfDay))),
  ]);

  return {
    activeConversations: active[0]?.n ?? 0,
    conversionsToday: conv[0]?.n ?? 0,
    revenueTodayCents: conv[0]?.cents ?? 0,
  };
}
