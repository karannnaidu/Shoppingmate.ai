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

  // Tier 2 — ANY meaningful word, prefix-matched. plainto_tsquery ANDs every
  // word and the 'simple' config doesn't stem, so natural shopper phrasing
  // ("sofa for small apartment", "wool sneakers for wide feet", "sofas")
  // returned nothing on non-Calmosis stores (segment audit 2026-10-07).
  const orQuery = buildOrTsQuery(normalized);
  if (orQuery) {
    const orTsq = sql`to_tsquery('simple', ${orQuery})`;
    const orRows = await db
      .select()
      .from(products)
      .where(and(eq(products.merchantId, merchantId), sql`${products.searchVector} @@ ${orTsq}`))
      .orderBy(desc(sql<number>`ts_rank(${products.searchVector}, ${orTsq})`))
      .limit(limit);
    if (orRows.length > 0) return orRows;
  }

  // Fallback: the model often passes the exact sku. Match it directly so a
  // valid product always yields a card even if FTS misses.
  return db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.sku, query.trim().toLowerCase())))
    .limit(limit);
}

const STOPWORDS = new Set(
  'a an and are as at be best buy can do does for from get good have help i in is it its looking me my need of on or show some something that the this to want what which with you your'.split(' '),
);

/**
 * "sofa for small apartment" → "sofa:* | small:* | apartment:*". Words are
 * lower-cased, stripped to [a-z0-9], stop-words dropped, and simple plurals
 * reduced ("sofas" → "sofa", "boxes" → "box") so the prefix matches both forms.
 * Returns null when nothing meaningful is left.
 */
export function buildOrTsQuery(query: string): string | null {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    .map((w) => (w.length > 4 && w.endsWith('es') && /(s|x|z|ch|sh)es$/.test(w) ? w.slice(0, -2) : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  const unique = [...new Set(words)].slice(0, 8);
  return unique.length ? unique.map((w) => `${w}:*`).join(' | ') : null;
}

export async function getProduct(merchantId: string, sku: string): Promise<Product | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.sku, sku)));
  return rows[0] ?? null;
}
