import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';
import { supportCases } from './supportCases.js';

// Customer Care PRD 2026-10-28.

/** Photos a shopper attached (proof of a damaged item, wrong product…). */
export const caseAttachments = pgTable(
  'case_attachments',
  {
    id: serial('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    // Uploaded before the request exists (voice: "tap the camera"), linked
    // once the bot opens it for the same session.
    caseId: integer('case_id').references(() => supportCases.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    r2Key: text('r2_key').notNull(),
    mime: text('mime').notNull(),
    bytes: integer('bytes').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byCase: index('case_attachments_case_idx').on(t.caseId),
    bySession: index('case_attachments_session_idx').on(t.sessionId, t.createdAt),
    byCreated: index('case_attachments_created_idx').on(t.createdAt),
  }),
);

export const caseEventKinds = ['note', 'reply_to_customer', 'status_change', 'customer_email', 'photos_added'] as const;
export type CaseEventKind = (typeof caseEventKinds)[number];

/** A request's history: brand replies (emailed to the shopper), notes, status changes. */
export const caseEvents = pgTable(
  'case_events',
  {
    id: serial('id').primaryKey(),
    caseId: integer('case_id')
      .notNull()
      .references(() => supportCases.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<CaseEventKind>().notNull(),
    body: text('body'),
    actor: text('actor'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byCase: index('case_events_case_idx').on(t.caseId, t.createdAt) }),
);

/**
 * Orders pushed to us by a brand's own systems (Order Data API) or cached from
 * a lookup. Contact is stored as hashes + last-4 so we can verify a shopper
 * owns an order without keeping their full email/phone.
 */
export const careOrders = pgTable(
  'care_orders',
  {
    id: serial('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    orderNumber: text('order_number').notNull(),
    source: text('source').notNull(), // order_api | shopify | shiprocket | woocommerce
    emailHash: text('email_hash'),
    phoneLast4: text('phone_last4'),
    status: text('status').notNull(),
    order: jsonb('order').$type<Record<string, unknown>>().notNull(),
    placedAt: timestamp('placed_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ byNumber: uniqueIndex('care_orders_merchant_number_uq').on(t.merchantId, t.orderNumber) }),
);

export type CaseAttachmentRow = typeof caseAttachments.$inferSelect;
export type CaseEventRow = typeof caseEvents.$inferSelect;
export type CareOrderRow = typeof careOrders.$inferSelect;
