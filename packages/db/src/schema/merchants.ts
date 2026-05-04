import { boolean, integer, jsonb, numeric, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const merchantStatus = [
  'pending',
  'onboarding',
  'live',
  'degraded',
  'suspended',
  'failed',
  'rejected',
] as const;
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

export const platformValues = ['shopify', 'woocommerce', 'custom'] as const;
export type PlatformValue = (typeof platformValues)[number];

export const merchants = pgTable('merchants', {
  id: text('id').primaryKey(),
  domain: text('domain').notNull().unique(),
  name: text('name'),
  allowedDomains: text('allowed_domains').array().notNull().default([]),
  platform: text('platform').$type<PlatformValue>(),
  platformConfidence: numeric('platform_confidence'),
  status: text('status').$type<MerchantStatus>().notNull(),
  adapterType: text('adapter_type').$type<AdapterType>(),
  adapterConfig: jsonb('adapter_config').notNull().default({}),
  cartUrlTemplate: text('cart_url_template'),
  checkoutUrl: text('checkout_url'),
  couponFieldSelector: text('coupon_field_selector'),
  policyUrls: jsonb('policy_urls'),
  personaId: text('persona_id').default('concierge').notNull(),
  installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  lastInstallAt: timestamp('last_install_at', { withTimezone: true }),
  lastFingerprintedAt: timestamp('last_fingerprinted_at', { withTimezone: true }),
  safetyCheckedAt: timestamp('safety_checked_at', { withTimezone: true }),
  lastError: text('last_error'),
  lastIndexedAt: timestamp('last_indexed_at', { withTimezone: true }),
  catalogSyncedAt: timestamp('catalog_synced_at', { withTimezone: true }),
  smokePassedAt: timestamp('smoke_passed_at', { withTimezone: true }),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  plan: text('plan').notNull().default('starter'),
  billingStatus: text('billing_status').notNull().default('pending'),
  persona: jsonb('persona').$type<{ voiceDescriptorId: string; brandVoiceNotes: string; toneValue: number } | null>(),
  leadWebhookUrl: text('lead_webhook_url'),
  knowledgeBaseStatus: text('knowledge_base_status').notNull().default('empty'),
  lastWidgetPing: timestamp('last_widget_ping', { withTimezone: true }),
  topupBalance: integer('topup_balance').notNull().default(0),
  autoRechargeEnabled: boolean('auto_recharge_enabled').notNull().default(false),
  autoRechargeThreshold: integer('auto_recharge_threshold'),
  autoRechargePackSize: integer('auto_recharge_pack_size'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export type Merchant = typeof merchants.$inferSelect;
export type NewMerchant = typeof merchants.$inferInsert;
