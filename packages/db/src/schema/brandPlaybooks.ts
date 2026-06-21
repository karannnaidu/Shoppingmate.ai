import { integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const brandPlaybooks = pgTable('brand_playbooks', {
  merchantId: text('merchant_id').primaryKey().references(() => merchants.id),
  playbook: text('playbook').notNull(),
  basedOnCount: integer('based_on_count').notNull().default(0),
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
});
