'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { brandTickets, ticketStatuses, type TicketStatus } from '@shoppingmate/db/schema';
import { db } from '@/lib/db';
import { clearAdminSession, getAdminSession, setAdminSession, verifyAdminCredentials } from '@/lib/admin-auth';

export async function adminLogin(
  _prev: { error?: string; email?: string } | undefined,
  form: FormData,
): Promise<{ error?: string; email?: string }> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  if (!verifyAdminCredentials(email, password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 800));
    // React resets the form after an action — hand the email back so it isn't wiped.
    return { error: 'Wrong email or password.', email };
  }
  await setAdminSession(email.trim());
  redirect('/admin/tickets');
}

export async function adminLogout(): Promise<void> {
  await clearAdminSession();
  redirect('/admin/login');
}

export async function adminUpdateTicket(form: FormData): Promise<void> {
  if (!(await getAdminSession())) return;
  const id = Number(form.get('id'));
  const status = String(form.get('status')) as TicketStatus;
  if (!Number.isFinite(id) || !(ticketStatuses as readonly string[]).includes(status)) return;
  const note = String(form.get('note') ?? '').trim().slice(0, 1000);
  await db.update(brandTickets).set({ status, opsNote: note || null, updatedAt: new Date() }).where(eq(brandTickets.id, id));
  revalidatePath('/admin/tickets');
  revalidatePath('/app/help');
}
