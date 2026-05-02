import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector';
  },
});

export const products = pgTable(
  'products',
  {
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    imageUrl: text('image_url'),
    productUrl: text('product_url').notNull(),
    variants: jsonb('variants'),
    priceCents: integer('price_cents'),
    currency: text('currency'),
    inStock: boolean('in_stock'),
    indexedAt: timestamp('indexed_at', { withTimezone: true }).notNull().defaultNow(),
    source: text('source').notNull(),
    sourceMeta: jsonb('source_meta'),
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`setweight(to_tsvector('simple', coalesce(title,'')), 'A') || setweight(to_tsvector('simple', coalesce(description,'')), 'B')`,
    ),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.merchantId, t.sku] }),
    searchIdx: index('products_search_idx').using('gin', t.searchVector),
    merchantIndexedIdx: index('products_merchant_indexed_idx').on(t.merchantId, t.indexedAt.desc()),
  }),
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
