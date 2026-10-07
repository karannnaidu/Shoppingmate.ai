import { insightPageviews } from '@shoppingmate/db/schema';
import { and, asc, eq, gte } from 'drizzle-orm';
import { db } from './db';
import { PAGE_LABEL } from './insights-copy';

// Scale plan: "Shopper journeys in detail" — the most common paths visitors
// take through the store (page type by page type) and how often each path
// ends in an order. Built from the detailed pageviews we keep (visits with a
// chat, a friction moment, or a purchase), so it's a representative sample,
// not every visit — the UI says so.

export type PageviewRow = { sessionId: string; pageType: string; reason: string; createdAt: Date };
export type Journey = { steps: string[]; visits: number; ordered: number };

export function buildJourneys(rows: PageviewRow[], limit = 8): Journey[] {
  const bySession = new Map<string, PageviewRow[]>();
  for (const r of rows) {
    const list = bySession.get(r.sessionId) ?? [];
    list.push(r);
    bySession.set(r.sessionId, list);
  }
  const paths = new Map<string, Journey>();
  for (const list of bySession.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    // Collapse repeats (product → product → product reads as one "Product").
    const steps: string[] = [];
    for (const r of list) {
      const label = PAGE_LABEL[r.pageType] ?? r.pageType;
      if (steps[steps.length - 1] !== label) steps.push(label);
    }
    const capped = steps.length > 6 ? [...steps.slice(0, 5), '…'] : steps;
    const key = capped.join(' → ');
    const j = paths.get(key) ?? { steps: capped, visits: 0, ordered: 0 };
    j.visits += 1;
    if (list.some((r) => r.reason === 'converted')) j.ordered += 1;
    paths.set(key, j);
  }
  return [...paths.values()].sort((a, b) => b.visits - a.visits || b.ordered - a.ordered).slice(0, limit);
}

export async function loadJourneys(merchantId: string, days = 14): Promise<{ journeys: Journey[]; visits: number }> {
  const since = new Date(Date.now() - days * 86400_000);
  const rows = await db
    .select({
      sessionId: insightPageviews.sessionId,
      pageType: insightPageviews.pageType,
      reason: insightPageviews.reason,
      createdAt: insightPageviews.createdAt,
    })
    .from(insightPageviews)
    .where(and(eq(insightPageviews.merchantId, merchantId), gte(insightPageviews.createdAt, since)))
    .orderBy(asc(insightPageviews.createdAt))
    .limit(20000);
  return { journeys: buildJourneys(rows), visits: new Set(rows.map((r) => r.sessionId)).size };
}
