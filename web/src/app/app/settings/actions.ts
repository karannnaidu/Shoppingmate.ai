'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { getDashboardSession } from '@/lib/session';

const PersonaSchema = z.object({
  voiceDescriptorId: z.string().min(1),
  brandVoiceNotes: z.string().max(500),
  toneValue: z.number().int().min(1).max(5),
});

export async function savePersona(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');

  const parsed = PersonaSchema.parse({
    voiceDescriptorId: formData.get('voiceDescriptorId'),
    brandVoiceNotes: formData.get('brandVoiceNotes') ?? '',
    toneValue: Number(formData.get('toneValue')),
  });

  await db.update(merchants).set({ persona: parsed }).where(eq(merchants.id, session.merchant.id));
  revalidatePath('/app/settings');
}

const WebhookSchema = z.object({ leadWebhookUrl: z.string().url().or(z.literal('')) });

export async function saveWebhook(formData: FormData) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) throw new Error('unauthorized');
  const parsed = WebhookSchema.parse({ leadWebhookUrl: formData.get('leadWebhookUrl') ?? '' });
  await db.update(merchants)
    .set({ leadWebhookUrl: parsed.leadWebhookUrl || null })
    .where(eq(merchants.id, session.merchant.id));
  revalidatePath('/app/settings');
}
