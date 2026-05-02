import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../client.js';
import { products, type Product } from '../schema/products.js';

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
  const tsq = sql`plainto_tsquery('simple', ${query})`;
  const rank = sql<number>`ts_rank(${products.searchVector}, ${tsq})`;
  return db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), sql`${products.searchVector} @@ ${tsq}`))
    .orderBy(desc(rank))
    .limit(limit);
}

export async function getProduct(merchantId: string, sku: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.sku, sku)));
  return rows[0] ?? null;
}
