import { bigserial, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { conversationSessions } from './conversationSessions.js';

export const recommendationEvents = pgTable(
  'recommendation_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => conversationSessions.id, { onDelete: 'cascade' }),
    sku: text('sku').notNull(),
    kind: text('kind').notNull(), // 'mentioned' | 'highlighted' | 'clicked'
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sessionSkuIdx: index('recommendation_events_session_sku_idx').on(t.sessionId, t.sku),
  }),
);

export type RecommendationEvent = typeof recommendationEvents.$inferSelect;
export type NewRecommendationEvent = typeof recommendationEvents.$inferInsert;
