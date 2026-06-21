import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const visitorProfiles = pgTable(
  'visitor_profiles',
  {
    id: text('id').primaryKey(), // `${merchantId}:${visitorId}`
    merchantId: text('merchant_id').notNull().references(() => merchants.id),
    visitorId: text('visitor_id').notNull(),
    identity: jsonb('identity').notNull().default({}),
    topIntents: jsonb('top_intents').notNull().default([]),
    needs: jsonb('needs').notNull().default([]),
    objections: jsonb('objections').notNull().default([]),
    productsOfInterest: jsonb('products_of_interest').notNull().default([]),
    lastOutcome: text('last_outcome'),
    lastDropStage: text('last_drop_stage'),
    sessionCount: integer('session_count').notNull().default(0),
    lifetimeValueCents: integer('lifetime_value_cents').notNull().default(0),
    lastSeen: timestamp('last_seen', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byMerchantVisitor: uniqueIndex('visitor_profiles_merchant_visitor').on(t.merchantId, t.visitorId),
    byMerchant: index('visitor_profiles_merchant').on(t.merchantId),
  }),
);
