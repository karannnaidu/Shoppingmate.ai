import { index, integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';
import { merchants } from './merchants.js';

export const consultationRequests = pgTable(
  'consultation_requests',
  {
    id: serial('id').primaryKey(),
    merchantId: text('merchant_id')
      .notNull()
      .references(() => merchants.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'), // nullable: pointer to conversation transcript
    name: text('name').notNull(),
    age: integer('age').notNull(),
    condition: text('condition'), // nullable: visitor may share directly with the doctor
    phoneCountryCode: text('phone_country_code').notNull().default('+91'),
    phone: text('phone').notNull(),
    status: text('status').notNull().default('new'), // new | contacted | closed
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    merchantCreatedIdx: index('consultation_requests_merchant_created_idx').on(
      t.merchantId,
      t.createdAt.desc(),
    ),
  }),
);

export type ConsultationRequestRow = typeof consultationRequests.$inferSelect;
export type NewConsultationRequest = typeof consultationRequests.$inferInsert;
