import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

export const siteGraphRoute = new Hono();

siteGraphRoute.get('/:merchantId/intents', async (c) => {
  const merchantId = c.req.param('merchantId');
  const rows = await db
    .select({
      url: schema.sitePages.url,
      intentKey: schema.pageIntents.intentKey,
      selectorHint: schema.pageIntents.selectorHint,
    })
    .from(schema.pageIntents)
    .innerJoin(schema.sitePages, eq(schema.pageIntents.pageId, schema.sitePages.id))
    .where(eq(schema.pageIntents.merchantId, merchantId));

  const byUrl: Record<string, Array<{ intentKey: string; selectorHint: string | null }>> = {};
  for (const r of rows) {
    const list = byUrl[r.url] ?? [];
    list.push({ intentKey: r.intentKey, selectorHint: r.selectorHint });
    byUrl[r.url] = list;
  }
  return c.json({ merchantId, intentsByUrl: byUrl });
});
