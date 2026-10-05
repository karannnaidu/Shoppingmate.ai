import {
  bigint,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

// Nav PRD Phase 8 — Store Insights. The widget aggregates in the browser and
// sends ONE summary per pageview; the API fans it out into fixed-size COUNTERS
// (never raw click streams). Detail rows exist only for qualifying pageviews
// and expire after 7–14 days.

export const insightCounters = pgTable(
  'insight_counters',
  {
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),
    metric: text('metric').notNull(),
    dimKey: text('dim_key').notNull(),
    count: bigint('count', { mode: 'number' }).notNull().default(0),
    total: doublePrecision('total').notNull().default(0),
  },
  (t) => ({
    uniq: uniqueIndex('insight_counters_uniq').on(t.merchantId, t.day, t.metric, t.dimKey),
    byMerchantMetricDay: index('insight_counters_merchant_metric_day').on(
      t.merchantId,
      t.metric,
      t.day,
    ),
  }),
);

export const insightPageviews = pgTable(
  'insight_pageviews',
  {
    id: serial('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sessionId: text('session_id').notNull(),
    pageType: text('page_type').notNull(),
    path: text('path').notNull(),
    device: text('device').notNull(),
    summary: jsonb('summary').$type<Record<string, unknown>>().notNull(),
    reason: text('reason').notNull(), // bot | friction | converted
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byMerchantCreated: index('insight_pageviews_merchant_created').on(t.merchantId, t.createdAt),
    bySession: index('insight_pageviews_session').on(t.merchantId, t.sessionId),
  }),
);

export type InsightFix = {
  id: string;
  title: string; // what's happening (one line)
  impact: string; // why it matters (₹ / shoppers)
  impactValue: number; // ₹ (or store currency) at risk per week, for sorting
  proof: string; // the numbers / quotes behind it
  action: string; // what to do
  pageType?: string; // for linking to the page view
  metric?: { name: string; before: number }; // tracked for "did it work?"
  status: 'open' | 'done';
  doneAt?: string;
  after?: number;
};

export const insightReports = pgTable(
  'insight_reports',
  {
    id: serial('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    weekStart: date('week_start').notNull(),
    summary: text('summary').notNull(),
    atRisk: integer('at_risk').notNull().default(0),
    currency: text('currency').notNull().default('INR'),
    fixes: jsonb('fixes').$type<InsightFix[]>().notNull().default([]),
    facts: jsonb('facts').$type<Record<string, unknown>>().notNull().default({}),
    emailedAt: timestamp('emailed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqWeek: uniqueIndex('insight_reports_merchant_week').on(t.merchantId, t.weekStart),
  }),
);

export type InsightCounterRow = typeof insightCounters.$inferSelect;
export type InsightReportRow = typeof insightReports.$inferSelect;
