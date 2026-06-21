import { and, eq, gte, sql } from 'drizzle-orm';
import { metricEvents } from '@shoppingmate/db/schema';
import { db } from './db';
import { aggregateIntents, type IntentInsights, type IntentTagRow } from './intent-insights.js';

export async function getIntentInsights(args: { merchantId: string; days?: number }): Promise<IntentInsights> {
  const days = args.days ?? 30;
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .select({
      intent: sql<string | null>`${metricEvents.tags}->'intent'->>'intent'`,
      outcome: sql<string | null>`${metricEvents.tags}->>'outcome'`,
      needs: sql<string[]>`coalesce(${metricEvents.tags}->'intent'->'needs', '[]'::jsonb)`,
      objections: sql<string[]>`coalesce(${metricEvents.tags}->'intent'->'objections', '[]'::jsonb)`,
      dropStage: sql<string | null>`${metricEvents.tags}->'intent'->>'dropStage'`,
    })
    .from(metricEvents)
    .where(and(
      eq(metricEvents.merchantId, args.merchantId),
      eq(metricEvents.metricName, 'conversationCompleted'),
      gte(metricEvents.ts, since),
      sql`${metricEvents.tags} ? 'intent'`,
    ));
  return aggregateIntents(rows as IntentTagRow[]);
}
