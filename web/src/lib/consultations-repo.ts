import { db } from './db';
import { consultationRequests } from '@shoppingmate/db/schema';
import { and, desc, eq, gte } from 'drizzle-orm';

export type ConsultationRow = {
  id: number;
  name: string;
  age: number;
  condition: string | null;
  phoneCountryCode: string;
  phone: string;
  status: string;
  sessionId: string | null;
  createdAt: Date;
};

export async function listConsultations(args: {
  merchantId: string;
  days: number;
}): Promise<ConsultationRow[]> {
  const since = new Date(Date.now() - args.days * 24 * 3600 * 1000);
  const rows = await db
    .select({
      id: consultationRequests.id,
      name: consultationRequests.name,
      age: consultationRequests.age,
      condition: consultationRequests.condition,
      phoneCountryCode: consultationRequests.phoneCountryCode,
      phone: consultationRequests.phone,
      status: consultationRequests.status,
      sessionId: consultationRequests.sessionId,
      createdAt: consultationRequests.createdAt,
    })
    .from(consultationRequests)
    .where(
      and(
        eq(consultationRequests.merchantId, args.merchantId),
        gte(consultationRequests.createdAt, since),
      ),
    )
    .orderBy(desc(consultationRequests.createdAt))
    .limit(500);
  return rows as ConsultationRow[];
}
