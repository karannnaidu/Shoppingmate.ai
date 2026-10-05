'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { supportCases } from '@shoppingmate/db/schema';
import { getDashboardSession } from '@/lib/session';

// Mark a customer request handled (or re-open it). Scoped to the owner's merchant.
export async function setCaseStatus(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');
  const id = Number(formData.get('id'));
  const status = formData.get('status') === 'open' ? 'open' : 'resolved';
  if (!Number.isInteger(id) || id <= 0) return;
  await db
    .update(supportCases)
    .set({ status, updatedAt: new Date(), resolvedAt: status === 'resolved' ? new Date() : null })
    .where(and(eq(supportCases.id, id), eq(supportCases.merchantId, session.merchant.id)));
  revalidatePath('/app/cases');
}
