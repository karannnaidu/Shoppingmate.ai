import { db, schema } from '@shoppingmate/db';
import { desc, eq } from 'drizzle-orm';

export async function show(merchantId: string): Promise<void> {
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

  const attempts = await db
    .select()
    .from(schema.installAttempts)
    .where(eq(schema.installAttempts.merchantId, merchantId))
    .orderBy(desc(schema.installAttempts.createdAt))
    .limit(5);

  console.log(JSON.stringify(merchant, null, 2));
  console.log('\nLast 5 install attempts:');
  if (attempts.length === 0) {
    console.log('  (none)');
  } else {
    for (const a of attempts) {
      console.log(
        `  ${a.createdAt.toISOString()}  ${a.outcome.padEnd(20)}  ip=${a.sourceIp}  domain=${a.domain}`,
      );
    }
  }
}
