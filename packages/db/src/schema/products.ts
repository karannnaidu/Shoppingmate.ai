import { boolean, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

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
    indexedAt: timestamp('indexed_at', { withTimezone: true }),
    source: text('source'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.merchantId, t.sku] }) }),
);

export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
