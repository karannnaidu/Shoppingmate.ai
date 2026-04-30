import { bigserial, index, jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const metricEvents = pgTable(
  'metric_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    metricName: text('metric_name').notNull(),
    value: numeric('value').notNull().default('1'),
    tags: jsonb('tags').$type<Record<string, string | number | boolean>>(),
    ts: timestamp('ts', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantMetricTsIdx: index('metric_events_merchant_metric_ts_idx').on(
      t.merchantId,
      t.metricName,
      t.ts.desc(),
    ),
  }),
);

export type MetricEvent = typeof metricEvents.$inferSelect;

export const metricNames = {
  selectorFirstTrySuccess: 'selector.first_try.success',
  selectorFirstTryFail: 'selector.first_try.fail',
  selectorHealAttempted: 'selector.heal.attempted',
  selectorHealSucceeded: 'selector.heal.succeeded',
  selectorOverrideSkipped: 'selector.override.skipped',
  selectorOverrideAlerted: 'selector.override.alerted',
  toolCallDurationMs: 'tool.call.duration_ms',
  voiceNumericPriceCorrected: 'voice.numeric_price_corrected',
} as const;
