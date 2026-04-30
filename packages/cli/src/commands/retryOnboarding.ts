import { db, schema } from '@shoppingmate/db';
import { onboardingQueue } from '@shoppingmate/jobs';
import { eq } from 'drizzle-orm';

export async function retryOnboarding(merchantId: string): Promise<void> {
  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);

  if (!merchant) {
    console.error(`merchant not found: ${merchantId}`);
    process.exitCode = 1;
    return;
  }

  if (merchant.status === 'rejected') {
    console.error(
      `merchant ${merchantId} is rejected (Safe Browsing flag); will not retry. Investigate before forcing.`,
    );
    process.exitCode = 1;
    return;
  }

  await db
    .update(schema.merchants)
    .set({ status: 'onboarding', lastError: null, lastInstallAt: new Date() })
    .where(eq(schema.merchants.id, merchantId));

  await onboardingQueue.add('onboarding', { merchantId, domain: merchant.domain });
  console.log(`re-enqueued onboarding for ${merchantId} (${merchant.domain})`);
}
