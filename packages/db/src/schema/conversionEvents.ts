import { bigserial, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const conversionEvents = pgTable('conversion_events', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  merchantId: text('merchant_id')
    .notNull()
    .references(() => merchants.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull(),
  orderId: text('order_id'),
  totalCents: integer('total_cents'),
  currency: text('currency'),
  ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
});

export type ConversionEvent = typeof conversionEvents.$inferSelect;
