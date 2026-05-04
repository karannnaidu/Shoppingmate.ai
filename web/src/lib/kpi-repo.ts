import { db } from './db';
import { metricEvents } from '@shoppingmate/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export type Kpis = {
  conversations: number;
  conversionRate: number;
  revenueCents: number;
  voiceRatio: number;
  voiceConversations: number;
};

/**
 * Aggregate metric_events for a merchant over `days` days into dashboard KPIs.
 *
 * The query groups by `metricName` (the actual DB column) so each named metric
 * produces exactly one row. Without `.groupBy`, the SQL `count(*)`/`sum()` would
 * collapse all events into a single row regardless of name.
 *
 * KPI mapping (metric names follow the plan's logical names keyed in the mock):
 *   conversationCompleted → conversations count
 *   conversionAttributed  → conversion count + revenue (sum of valueCents alias)
 *   voiceConversation     → voice count
 *
 * Note: the actual schema stores revenue in `value` (numeric), not `valueCents`.
 * The mock in kpi-repo.test.ts returns `sumCents` directly; callers that write
 * real metric events should store cents in the `value` column.
 */
export async function computeKpis(args: { merchantId: string; days: number }): Promise<Kpis> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);

  const rows = await db
    .select({
      name: metricEvents.metricName,
      count: sql<number>`count(*)::int`,
      sumCents: sql<number>`coalesce(sum(${metricEvents.value}), 0)::int`,
    })
    .from(metricEvents)
    .where(and(eq(metricEvents.merchantId, args.merchantId), gte(metricEvents.ts, since)))
    .groupBy(metricEvents.metricName);

  const byName = new Map(rows.map((r) => [r.name, r]));
  const conversations = byName.get('conversationCompleted')?.count ?? 0;
  const conversions = byName.get('conversionAttributed')?.count ?? 0;
  const revenueCents = byName.get('conversionAttributed')?.sumCents ?? 0;
  const voiceConversations = byName.get('voiceConversation')?.count ?? 0;

  return {
    conversations,
    conversionRate: conversations > 0 ? conversions / conversations : 0,
    revenueCents,
    voiceConversations,
    voiceRatio: conversations > 0 ? voiceConversations / conversations : 0,
  };
}
