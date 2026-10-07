import { db } from './db';
import { supportCases } from '@shoppingmate/db/schema';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

// Nav PRD Phase 4 — the merchant's "Customer requests" inbox.

export type CaseRow = typeof supportCases.$inferSelect;
export type CaseFilter = 'open' | 'handled' | 'all';

export async function listCases(args: { merchantId: string; filter: CaseFilter; limit?: number }): Promise<CaseRow[]> {
  const statusCond =
    args.filter === 'open'
      ? inArray(supportCases.status, ['open', 'in_progress'])
      : args.filter === 'handled'
        ? eq(supportCases.status, 'resolved')
        : undefined;
  return db
    .select()
    .from(supportCases)
    .where(statusCond ? and(eq(supportCases.merchantId, args.merchantId), statusCond) : eq(supportCases.merchantId, args.merchantId))
    .orderBy(
      // Urgent + unhappy first, then newest.
      desc(sql`CASE WHEN ${supportCases.urgency} = 'high' THEN 1 ELSE 0 END`),
      desc(supportCases.createdAt),
    )
    .limit(args.limit ?? 100);
}

export async function caseCounts(merchantId: string): Promise<{ open: number; urgentOpen: number }> {
  const [row] = await db
    .select({
      open: sql<number>`count(*) FILTER (WHERE ${supportCases.status} <> 'resolved')`.mapWith(Number),
      urgentOpen: sql<number>`count(*) FILTER (WHERE ${supportCases.status} <> 'resolved' AND ${supportCases.urgency} = 'high')`.mapWith(Number),
    })
    .from(supportCases)
    .where(eq(supportCases.merchantId, merchantId));
  return { open: row?.open ?? 0, urgentOpen: row?.urgentOpen ?? 0 };
}

/** Service businesses (clinics, restaurants, salons, services): booking and
 *  quote requests the assistant captured — their equivalent of orders. */
export async function bookingCounts(
  merchantId: string,
  days = 7,
): Promise<{ requests: number; requestsPrev: number; handled: number }> {
  const [row] = await db
    .select({
      requests: sql<number>`count(*) FILTER (WHERE ${supportCases.createdAt} >= now() - make_interval(days => ${days}))`.mapWith(Number),
      requestsPrev: sql<number>`count(*) FILTER (WHERE ${supportCases.createdAt} < now() - make_interval(days => ${days}) AND ${supportCases.createdAt} >= now() - make_interval(days => ${days * 2}))`.mapWith(Number),
      handled: sql<number>`count(*) FILTER (WHERE ${supportCases.createdAt} >= now() - make_interval(days => ${days}) AND ${supportCases.status} = 'resolved')`.mapWith(Number),
    })
    .from(supportCases)
    .where(and(eq(supportCases.merchantId, merchantId), inArray(supportCases.type, ['booking', 'quote'])));
  return { requests: row?.requests ?? 0, requestsPrev: row?.requestsPrev ?? 0, handled: row?.handled ?? 0 };
}
