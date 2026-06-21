import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { brandPlaybooks } from '../schema/brandPlaybooks.js';

export async function loadBrandPlaybook(merchantId: string): Promise<{ playbook: string; basedOnCount: number } | null> {
  const rows = await db.select().from(brandPlaybooks).where(eq(brandPlaybooks.merchantId, merchantId)).limit(1);
  const r = rows[0];
  return r ? { playbook: r.playbook, basedOnCount: r.basedOnCount } : null;
}

export async function upsertBrandPlaybook(merchantId: string, playbook: string, basedOnCount: number): Promise<void> {
  await db.insert(brandPlaybooks).values({ merchantId, playbook, basedOnCount, generatedAt: new Date() })
    .onConflictDoUpdate({ target: brandPlaybooks.merchantId, set: { playbook, basedOnCount, generatedAt: new Date() } });
}
