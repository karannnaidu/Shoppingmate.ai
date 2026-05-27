import {
  bigserial,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export type ConversionLineItem = {
  sku: string;
  quantity: number;
  priceCents: number;
  wasRecommended: boolean;
};

export const conversionEvents = pgTable(
  'conversion_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'), // nullable: pointer to conversation_sessions.id; no FK (sessions may roll off)
    orderId: text('order_id').notNull(),
    totalCents: integer('total_cents').notNull(),
    currency: text('currency').notNull(),
    attributionKind: text('attribution_kind').notNull(), // 'assisted' | 'influenced'
    attributionWindowDays: integer('attribution_window_days').notNull(),
    matchSource: text('match_source').notNull(), // 'shopify_webhook' | 'gtag'
    visitorId: text('visitor_id').notNull(),
    lineItems: jsonb('line_items').$type<ConversionLineItem[]>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqAttribution: uniqueIndex('conversion_events_merchant_order_kind_uniq').on(
      t.merchantId,
      t.orderId,
      t.attributionKind,
    ),
    merchantOccurredIdx: index('conversion_events_merchant_occurred_idx').on(
      t.merchantId,
      t.occurredAt.desc(),
    ),
  }),
);

export type ConversionEvent = typeof conversionEvents.$inferSelect;
export type NewConversionEvent = typeof conversionEvents.$inferInsert;
