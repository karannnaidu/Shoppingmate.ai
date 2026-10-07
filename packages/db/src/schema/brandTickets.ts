import { index, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

// Multi-segment PRD 2026-10-07 Phase 3 — brands (our customers) report bugs,
// request features and ask for help from the dashboard support assistant.
// Our team triages them on the internal tickets page; brands see the status.

export const ticketKinds = ['bug', 'feature', 'question', 'billing', 'setup', 'other'] as const;
export type TicketKind = (typeof ticketKinds)[number];
export const ticketStatuses = ['open', 'in_progress', 'done', 'wont_do'] as const;
export type TicketStatus = (typeof ticketStatuses)[number];
export const ticketPriorities = ['low', 'normal', 'high'] as const;
export type TicketPriority = (typeof ticketPriorities)[number];

export const brandTickets = pgTable(
  'brand_tickets',
  {
    id: serial('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    userEmail: text('user_email'),
    kind: text('kind').$type<TicketKind>().notNull(),
    title: text('title').notNull(),
    details: text('details').notNull().default(''),
    /** The assistant conversation that produced the ticket (role + text). */
    transcript: jsonb('transcript').$type<Array<{ role: string; text: string }>>().notNull().default([]),
    status: text('status').$type<TicketStatus>().notNull().default('open'),
    priority: text('priority').$type<TicketPriority>().notNull().default('normal'),
    /** Note from our team, shown to the brand. */
    opsNote: text('ops_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byMerchant: index('brand_tickets_merchant_created').on(t.merchantId, t.createdAt),
    byStatus: index('brand_tickets_status').on(t.status, t.createdAt),
  }),
);

export type BrandTicket = typeof brandTickets.$inferSelect;
