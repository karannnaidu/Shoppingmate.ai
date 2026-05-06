// Idempotent seeder: ensure merchant SM-XPK2EN exists and shoppingmate.ai is
// in its allowedDomains so the dogfood widget on the landing page can boot.
// Run via: railway run --service api tsx apps/api/scripts/seed-shoppingmate-merchant.ts
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';

const ID = 'SM-XPK2EN';
const DOMAIN = 'shoppingmate.ai';

async function main() {
  const [existing] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, ID))
    .limit(1);

  if (!existing) {
    await db.insert(schema.merchants).values({
      id: ID,
      domain: DOMAIN,
      name: 'shoppingmate (dogfood)',
      allowedDomains: [DOMAIN, 'www.shoppingmate.ai', 'shoppingmate-web.vercel.app'],
      status: 'live',
      personaId: 'sage',
      adapterType: 'suggest',
      plan: 'starter',
      billingStatus: 'active',
    });
    console.log(`inserted ${ID} with allowedDomains=[${DOMAIN}], adapterType=suggest`);
    return;
  }

  const wanted = new Set([DOMAIN, 'www.shoppingmate.ai', 'shoppingmate-web.vercel.app']);
  const merged = Array.from(new Set([...(existing.allowedDomains ?? []), ...wanted]));
  await db
    .update(schema.merchants)
    .set({
      allowedDomains: merged,
      status: 'live',
      domain: DOMAIN,
      name: 'shoppingmate (dogfood)',
      personaId: 'sage',
      adapterType: 'suggest',
    })
    .where(eq(schema.merchants.id, ID));
  console.log(`updated ${ID} allowedDomains=${JSON.stringify(merged)}, adapterType=suggest`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
