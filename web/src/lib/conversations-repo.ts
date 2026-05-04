import { db } from './db';
import { metricEvents } from '@shoppingmate/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

export type ConversationRow = {
  id: string;
  startedAt: Date;
  durationSec: number;
  turns: number;
  mode: 'voice' | 'text';
  outcome: 'purchased' | 'abandoned' | 'in_progress';
  attributedCents: number | null;
};

export async function recentConversations(args: { merchantId: string; limit?: number }): Promise<ConversationRow[]> {
  const limit = args.limit ?? 20;
  const rows = await db
    .select({
      id: sql<string>`(${metricEvents.tags}->>'session_id')`,
      startedAt: metricEvents.ts,
      durationSec: sql<number>`coalesce((${metricEvents.tags}->>'duration_sec')::int, 0)`,
      turns: sql<number>`coalesce((${metricEvents.tags}->>'turns')::int, 0)`,
      mode: sql<'voice' | 'text'>`coalesce(${metricEvents.tags}->>'mode', 'text')`,
      outcome: sql<'purchased' | 'abandoned' | 'in_progress'>`coalesce(${metricEvents.tags}->>'outcome', 'in_progress')`,
      attributedCents: sql<number | null>`nullif((${metricEvents.tags}->>'attributed_cents'), '')::int`,
    })
    .from(metricEvents)
    .where(and(eq(metricEvents.merchantId, args.merchantId), eq(metricEvents.metricName, 'conversationCompleted')))
    .orderBy(desc(metricEvents.ts))
    .limit(limit);

  return rows;
}
