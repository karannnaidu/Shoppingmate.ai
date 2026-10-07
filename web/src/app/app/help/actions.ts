'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { brandTickets, ticketStatuses, type TicketStatus } from '@shoppingmate/db/schema';
import { db } from '@/lib/db';
import { getDashboardSession } from '@/lib/session';
import { createTicket, isOpsAdmin, validateTicket } from '@/lib/support-tools';

/** Manual request form (works even if the assistant is unavailable). */
export async function submitTicket(form: FormData): Promise<void> {
  const session = await getDashboardSession({ headers: await headers() });
  if (!session?.merchant) return;
  const v = validateTicket({
    kind: form.get('kind'),
    title: form.get('title'),
    details: form.get('details'),
  });
  if (!v.ok) return;
  await createTicket({ merchantId: session.merchant.id, userEmail: session.user.email, ticket: v.value, transcript: [] });
  revalidatePath('/app/help');
}

/** Our team: change status / leave a note the brand sees. */
export async function updateTicket(form: FormData): Promise<void> {
  const session = await getDashboardSession({ headers: await headers() });
  if (!isOpsAdmin(session?.user.email)) return;
  const id = Number(form.get('id'));
  const status = String(form.get('status')) as TicketStatus;
  if (!Number.isFinite(id) || !(ticketStatuses as readonly string[]).includes(status)) return;
  const note = String(form.get('note') ?? '').trim().slice(0, 1000);
  await db
    .update(brandTickets)
    .set({ status, opsNote: note || null, updatedAt: new Date() })
    .where(eq(brandTickets.id, id));
  revalidatePath('/app/ops/tickets');
  revalidatePath('/app/help');
}
