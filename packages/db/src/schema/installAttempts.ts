import { bigserial, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const installOutcomes = [
  'enqueued',
  'noop',
  'rejected_origin',
  'rejected_domain',
  'rate_limited',
  'invalid_body',
  'merchant_not_found',
] as const;
export type InstallOutcome = (typeof installOutcomes)[number];

export const installAttempts = pgTable(
  'install_attempts',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    merchantId: text('merchant_id').references(() => merchants.id, { onDelete: 'cascade' }),
    domain: text('domain').notNull(),
    sourceIp: text('source_ip').notNull(),
    userAgent: text('user_agent').notNull(),
    referer: text('referer'),
    outcome: text('outcome').$type<InstallOutcome>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantCreatedIdx: index('install_attempts_merchant_created_idx').on(
      t.merchantId,
      t.createdAt.desc(),
    ),
    sourceIpCreatedIdx: index('install_attempts_source_ip_created_idx').on(
      t.sourceIp,
      t.createdAt.desc(),
    ),
  }),
);

export type InstallAttempt = typeof installAttempts.$inferSelect;
export type NewInstallAttempt = typeof installAttempts.$inferInsert;
