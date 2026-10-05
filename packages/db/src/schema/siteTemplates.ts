import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

// Nav PRD Phase 2 — per-TEMPLATE site map (all product pages share one).
// `skeleton` = normalized "role|name" keys present on EVERY sampled page of the
// template (product-specific text drops out of the intersection), used by the
// widget to recognise the template and detect drift. `screenshots` holds
// storage keys for full-page captures (reused as heatmap backgrounds, Phase 8).

export const templateStatuses = ['fresh', 'stale', 'scanning'] as const;
export type TemplateStatus = (typeof templateStatuses)[number];

export type TemplateRecipe = {
  /** e.g. "add_to_cart", "buy_now", "variant", "quantity", "checkout" */
  action: string;
  role: string;
  name: string;
  /** What changed after the action during the scan (success signal), if probed. */
  signal?: string;
};

export const siteTemplates = pgTable(
  'site_templates',
  {
    id: text('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    pageType: text('page_type').notNull(),
    urlPattern: text('url_pattern').notNull(),
    skeleton: jsonb('skeleton').$type<string[]>().notNull().default([]),
    recipes: jsonb('recipes').$type<TemplateRecipe[]>().notNull().default([]),
    sampleUrls: jsonb('sample_urls').$type<string[]>().notNull().default([]),
    screenshots: jsonb('screenshots').$type<Record<string, string>>().notNull().default({}),
    status: text('status').$type<TemplateStatus>().notNull().default('fresh'),
    driftReports: integer('drift_reports').notNull().default(0),
    verifyFailures: integer('verify_failures').notNull().default(0),
    lastDriftAt: timestamp('last_drift_at', { withTimezone: true }),
    scanTrigger: text('scan_trigger'),
    scannedAt: timestamp('scanned_at', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqByMerchantType: uniqueIndex('site_templates_merchant_type_idx').on(
      t.merchantId,
      t.pageType,
    ),
    byMerchant: index('site_templates_merchant_idx').on(t.merchantId),
  }),
);

export type SiteTemplateRow = typeof siteTemplates.$inferSelect;
