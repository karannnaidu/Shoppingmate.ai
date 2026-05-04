'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

const Schema = z.object({
  enabled: z.coerce.boolean(),
  threshold: z.coerce.number().int().min(1).max(1000),
  pack_size: z.union([z.literal(50), z.literal(200), z.literal(1000), z.literal(5000)]),
});

export async function saveAutoRecharge(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');

  const enabled = formData.get('enabled') === 'on';
  const threshold = Number(formData.get('threshold'));
  const packSize = Number(formData.get('pack_size'));
  Schema.parse({ enabled, threshold, pack_size: packSize });

  await db.update(merchants).set({
    autoRechargeEnabled: enabled,
    autoRechargeThreshold: threshold,
    autoRechargePackSize: packSize,
  }).where(eq(merchants.id, session.merchant.id));

  revalidatePath('/app/billing');
}
