import { boolean, index, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

// Nav PRD Phase 4 — every customer need beyond buying (order tracking,
// complaints, returns, bad experiences, unanswered questions, consultations)
// captured as one flexible "case" the merchant can act on.

export const caseTypes = [
  'order_tracking',
  'complaint',
  'return_refund',
  'bad_review',
  'product_question',
  'consult',
  'booking',
  'quote',
  // Customer Care PRD 2026-10-28: praise / suggestions, and a shopper asking to
  // cancel (a person at the brand approves and reaches out).
  'feedback',
  'cancellation_request',
  'other',
] as const;
export type CaseType = (typeof caseTypes)[number];

export const caseUrgencies = ['low', 'normal', 'high'] as const;
export type CaseUrgency = (typeof caseUrgencies)[number];

export const caseSentiments = ['positive', 'neutral', 'negative', 'angry'] as const;
export type CaseSentiment = (typeof caseSentiments)[number];

export const caseStatuses = ['open', 'in_progress', 'resolved'] as const;
export type CaseStatus = (typeof caseStatuses)[number];

export const supportCases = pgTable(
  'support_cases',
  {
    id: serial('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    visitorId: text('visitor_id'),
    type: text('type').$type<CaseType>().notNull(),
    summary: text('summary').notNull(),
    details: jsonb('details').$type<Record<string, string>>().notNull().default({}),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    consent: boolean('consent').notNull().default(false),
    urgency: text('urgency').$type<CaseUrgency>().notNull().default('normal'),
    sentiment: text('sentiment').$type<CaseSentiment>().notNull().default('neutral'),
    status: text('status').$type<CaseStatus>().notNull().default('open'),
    // The order this request is about, and what we knew of it when it was
    // raised (status, items) so the brand needn't look it up.
    orderId: text('order_id'),
    orderSnapshot: jsonb('order_snapshot').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    byMerchantCreated: index('support_cases_merchant_created_idx').on(
      t.merchantId,
      t.createdAt.desc(),
    ),
    byMerchantStatus: index('support_cases_merchant_status_idx').on(t.merchantId, t.status),
  }),
);

export type SupportCaseRow = typeof supportCases.$inferSelect;
export type NewSupportCase = typeof supportCases.$inferInsert;
