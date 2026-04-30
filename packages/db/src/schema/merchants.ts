import { jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const merchantStatus = ['onboarding', 'live', 'degraded', 'suspended'] as const;
export type MerchantStatus = (typeof merchantStatus)[number];

export const adapterTypes = [
  'shopify',
  'woo',
  'magento',
  'bigcommerce',
  'wix',
  'squarespace',
  'dom',
  'suggest',
] as const;
export type AdapterType = (typeof adapterTypes)[number];

export const merchants = pgTable('merchants', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  platform: text('platform'),
  platformConfidence: numeric('platform_confidence'),
  status: text('status').$type<MerchantStatus>().notNull(),
  adapterType: text('adapter_type').$type<AdapterType>().notNull(),
  adapterConfig: jsonb('adapter_config').notNull().default({}),
  cartUrlTemplate: text('cart_url_template'),
  checkoutUrl: text('checkout_url'),
  couponFieldSelector: text('coupon_field_selector'),
  policyUrls: jsonb('policy_urls'),
  personaId: text('persona_id').default('concierge').notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
});

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
