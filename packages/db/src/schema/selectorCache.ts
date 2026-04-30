import { boolean, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const selectorSources = ['auto', 'llm_resolved', 'merchant_override'] as const;
export type SelectorSource = (typeof selectorSources)[number];

export const selectorCache = pgTable(
  'selector_cache',
  {
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    pageTemplateHash: text('page_template_hash').notNull(),
    selectorKey: text('selector_key').notNull(),
    resolvedSelector: text('resolved_selector').notNull(),
    source: text('source').$type<SelectorSource>().notNull(),
    locked: boolean('locked').notNull().default(false),
    lastTestedAt: timestamp('last_tested_at', { withTimezone: true }),
    lastTestPassed: boolean('last_test_passed'),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.merchantId, t.pageTemplateHash, t.selectorKey] }),
  }),
);

export type SelectorCacheRow = typeof selectorCache.$inferSelect;
