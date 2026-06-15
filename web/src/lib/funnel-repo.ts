import { db } from './db';
import { metricEvents } from '@shoppingmate/db/schema';
import { and, eq, gte, sql } from 'drizzle-orm';

export type Funnel = {
  conversations: number;
  cartAdds: number;
  checkoutReached: number;
  purchases: number;
  cartRate: number;
  checkoutRate: number;
  purchaseRate: number;
};

/**
 * Bot-driven funnel over the window: conversations → cart adds → checkout
 * reached → purchases. Counts come from metric_events (conversationCompleted,
 * cart.add, checkout.reached); `purchases` is passed in (derived from
 * conversion_events by the caller) since it lives in a different table.
 */
export async function computeFunnel(args: {
  merchantId: string;
  days: number;
  purchases: number;
}): Promise<Funnel> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
  const rows = await db
    .select({ name: metricEvents.metricName, count: sql<number>`count(*)::int` })
    .from(metricEvents)
    .where(and(eq(metricEvents.merchantId, args.merchantId), gte(metricEvents.ts, since)))
    .groupBy(metricEvents.metricName);

  const by = new Map(rows.map((r) => [r.name, r.count]));
  const conversations = by.get('conversationCompleted') ?? 0;
  const cartAdds = by.get('cart.add') ?? 0;
  const checkoutReached = by.get('checkout.reached') ?? 0;
  const purchases = args.purchases;
  const rate = (n: number, d: number) => (d > 0 ? n / d : 0);

  return {
    conversations,
    cartAdds,
    checkoutReached,
    purchases,
    cartRate: rate(cartAdds, conversations),
    checkoutRate: rate(checkoutReached, conversations),
    purchaseRate: rate(purchases, conversations),
  };
}
