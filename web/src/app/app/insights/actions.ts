'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { getDashboardSession } from '@/lib/session';
import { setFixStatus } from '@/lib/insights-repo';

export async function markFix(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');
  const reportId = Number(formData.get('reportId'));
  const fixId = String(formData.get('fixId') ?? '');
  const status = formData.get('status') === 'open' ? 'open' : 'done';
  if (!Number.isInteger(reportId) || !fixId) return;
  await setFixStatus(session.merchant.id, reportId, fixId, status);
  revalidatePath('/app/insights');
}
