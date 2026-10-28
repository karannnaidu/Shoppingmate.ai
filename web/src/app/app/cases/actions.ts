'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { supportCases } from '@shoppingmate/db/schema';
import { recordCaseEvent, sendCaseReply } from '@shoppingmate/db';
import { getDashboardSession } from '@/lib/session';

const STATUSES = ['open', 'in_progress', 'resolved'] as const;
type Status = (typeof STATUSES)[number];
const STATUS_LABEL: Record<Status, string> = { open: 'To do', in_progress: 'In progress', resolved: 'Handled' };

// Move a customer request between To do / In progress / Handled. Scoped to the owner's merchant.
export async function setCaseStatus(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');
  const id = Number(formData.get('id'));
  const raw = String(formData.get('status'));
  const status: Status = (STATUSES as readonly string[]).includes(raw) ? (raw as Status) : 'resolved';
  if (!Number.isInteger(id) || id <= 0) return;
  const updated = await db
    .update(supportCases)
    .set({ status, updatedAt: new Date(), resolvedAt: status === 'resolved' ? new Date() : null })
    .where(and(eq(supportCases.id, id), eq(supportCases.merchantId, session.merchant.id)))
    .returning({ id: supportCases.id });
  if (updated.length) await recordCaseEvent(id, 'status_change', STATUS_LABEL[status], session.user.email);
  revalidatePath('/app/cases');
}

export type ReplyState = { ok: boolean; message: string } | null;

// Reply to the shopper by email (from "<Brand> Care", replies come back to you).
export async function replyToCustomer(_prev: ReplyState, formData: FormData): Promise<ReplyState> {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) return { ok: false, message: 'Please sign in again.' };
  const id = Number(formData.get('id'));
  const message = String(formData.get('message') ?? '').trim();
  if (!Number.isInteger(id) || id <= 0 || !message) return { ok: false, message: 'Write a message first.' };
  const res = await sendCaseReply({ merchantId: session.merchant.id, caseId: id, message, actor: session.user.email });
  revalidatePath('/app/cases');
  if (res === 'sent') return { ok: true, message: 'Sent to the customer.' };
  if (res === 'no_email') return { ok: true, message: 'Saved as a note — this customer left no email, so call them on their number.' };
  return { ok: false, message: 'Couldn’t send that. Please try again.' };
}
