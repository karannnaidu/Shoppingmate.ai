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
      // "Active" = still open AND started recently. Many sessions never get
      // endedAt set, so `endedAt IS NULL` alone counted every stale session ever
      // (showed 37k). Scope to the last 15 minutes for a real live count.
      .where(
        and(
          eq(conversationSessions.merchantId, merchantId),
          isNull(conversationSessions.endedAt),
          gte(conversationSessions.startedAt, new Date(Date.now() - 15 * 60 * 1000)),
        ),
      ),
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
