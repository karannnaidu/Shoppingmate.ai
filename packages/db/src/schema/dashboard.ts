import { pgTable, text, timestamp, boolean, integer, uuid, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { users } from './auth.js';
import { merchants } from './merchants.js';

export const merchantOwners = pgTable(
  'merchant_owners',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.merchantId] }),
  }),
);

export const brandKbDocuments = pgTable('brand_kb_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storageUrl: text('storage_url').notNull(),
  status: text('status').notNull().default('uploaded'),
  enabled: boolean('enabled').notNull().default(true),
  errorMessage: text('error_message'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
  readyAt: timestamp('ready_at', { withTimezone: true }),
});

export const brandKbChunks = pgTable('brand_kb_chunks', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => brandKbDocuments.id, { onDelete: 'cascade' }),
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  chunkIndex: integer('chunk_index').notNull(),
  text: text('text').notNull(),
  tokenCount: integer('token_count').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const alerts = pgTable('alerts', {
  id: uuid('id').primaryKey().defaultRandom(),
  merchantId: text('merchant_id').notNull().references(() => merchants.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  severity: text('severity').notNull(),
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
});

export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
  payload: jsonb('payload'),
});

export type MerchantOwner = typeof merchantOwners.$inferSelect;
export type BrandKbDocument = typeof brandKbDocuments.$inferSelect;
export type BrandKbChunk = typeof brandKbChunks.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type AlertKind = 'override_failing' | 'smoke_failing' | 'catalog_drift' | 'margin_breach' | 'payment_failed';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type StripeEvent = typeof stripeEvents.$inferSelect;
