import { bigint, date, integer, numeric, pgTable, primaryKey, text } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const billingLedger = pgTable(
  'billing_ledger',
  {
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    period: date('period').notNull(),
    conversationsCount: integer('conversations_count').notNull().default(0),
    voiceMinutes: numeric('voice_minutes').notNull().default('0'),
    conversionValueCents: bigint('conversion_value_cents', { mode: 'number' }).notNull().default(0),
    llmCostUsd: numeric('llm_cost_usd').notNull().default('0'),
    sttCostUsd: numeric('stt_cost_usd').notNull().default('0'),
    ttsCostUsd: numeric('tts_cost_usd').notNull().default('0'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.merchantId, t.period] }) }),
);

export type BillingLedgerRow = typeof billingLedger.$inferSelect;
