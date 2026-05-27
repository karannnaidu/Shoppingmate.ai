import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const conversationSessions = pgTable(
  'conversation_sessions',
  {
    id: text('id').primaryKey(), // LiveKit room id
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    visitorId: text('visitor_id').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
  },
  (t) => ({
    merchantVisitorEndedIdx: index('conversation_sessions_merchant_visitor_ended_idx').on(
      t.merchantId,
      t.visitorId,
      t.endedAt.desc(),
    ),
  }),
);

export type ConversationSession = typeof conversationSessions.$inferSelect;
export type NewConversationSession = typeof conversationSessions.$inferInsert;
