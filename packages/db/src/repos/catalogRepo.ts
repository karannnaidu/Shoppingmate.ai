import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { type Product, products } from '../schema/products.js';

export async function searchProducts(
  merchantId: string,
  query: string,
  limit = 20,
): Promise<Product[]> {
  if (!query.trim()) {
    return db
      .select()
      .from(products)
      .where(eq(products.merchantId, merchantId))
      .orderBy(desc(products.indexedAt))
      .limit(limit);
  }
  // Normalize hyphens/underscores to spaces. A hyphenated query like
  // "peace-mantra" otherwise becomes a single compound lexeme that won't match
  // the title's separate "peace"/"mantra" tokens, so the card never surfaces
  // (2026-06-15 report: Peace/Dog Mantra had no card when the bot searched the
  // raw sku). "peace mantra" matches fine.
  const normalized = query.replace(/[-_]+/g, ' ').trim();
  const tsq = sql`plainto_tsquery('simple', ${normalized})`;
  const rank = sql<number>`ts_rank(${products.searchVector}, ${tsq})`;
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), sql`${products.searchVector} @@ ${tsq}`))
    .orderBy(desc(rank))
    .limit(limit);
  if (rows.length > 0) return rows;
  // Fallback: the model often passes the exact sku. Match it directly so a
  // valid product always yields a card even if FTS misses.
  return db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.sku, query.trim().toLowerCase())))
    .limit(limit);
}

export async function getProduct(merchantId: string, sku: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.sku, sku)));
  return rows[0] ?? null;
}
