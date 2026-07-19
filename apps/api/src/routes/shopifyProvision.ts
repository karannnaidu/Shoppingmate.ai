import { db, schema } from '@shoppingmate/db';
import { onboardingQueue } from '@shoppingmate/jobs';
import { childLogger, encryptSecret, generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

const log = childLogger({ route: 'shopify-provision' });

// Called server-to-server by the Shopify embedded admin app after OAuth install.
// Provisions a shoppingmate merchant for the shop, stores the app's Admin API
// access token (encrypted) so the worker can sync the catalog via the Admin API
// even on locked/dev stores, and enqueues onboarding. Idempotent: reinstalls
// reuse the merchant and refresh its token.
export type ProvisionDeps = {
  findMerchantByDomain: (domain: string) => Promise<{ id: string; status: string } | null>;
  createMerchant: (m: {
    id: string;
    domain: string;
    allowedDomains: string[];
    tokenEnc: string | null;
  }) => Promise<void>;
  updateToken: (id: string, tokenEnc: string) => Promise<void>;
  enqueueOnboarding: (args: { merchantId: string; domain: string }) => Promise<void>;
  encryptToken: (token: string) => string;
  generateId: () => string;
};

export type ProvisionInput = { shop: string; domains?: string[]; accessToken?: string };

export async function provisionShopifyMerchant(
  deps: ProvisionDeps,
  input: ProvisionInput,
): Promise<{ merchantId: string; created: boolean }> {
  const shop = input.shop.trim().toLowerCase();
  const tokenEnc = input.accessToken ? deps.encryptToken(input.accessToken) : null;

  const existing = await deps.findMerchantByDomain(shop);
  if (existing) {
    if (tokenEnc) await deps.updateToken(existing.id, tokenEnc);
    return { merchantId: existing.id, created: false };
  }

  const merchantId = deps.generateId();
  const extra = (input.domains ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean);
  const allowedDomains = Array.from(new Set([shop, ...extra]));
  await deps.createMerchant({ id: merchantId, domain: shop, allowedDomains, tokenEnc });
  await deps.enqueueOnboarding({ merchantId, domain: shop });
  return { merchantId, created: true };
}

export const shopifyProvisionRoute = new Hono();

shopifyProvisionRoute.post('/', async (c) => {
  const secret = process.env.SHOPIFY_PROVISION_SECRET ?? '';
  const auth = c.req.header('authorization') ?? '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return c.json({ error: 'unauthorized' }, 401);
  }

  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    raw = null;
  }
  const shop = (raw as { shop?: unknown } | null)?.shop;
  if (typeof shop !== 'string' || !shop.trim()) {
    return c.json({ error: 'invalid_shop' }, 400);
  }
  const rawDomains = (raw as { domains?: unknown }).domains;
  const domains = Array.isArray(rawDomains)
    ? rawDomains.filter((d): d is string => typeof d === 'string')
    : [];
  const rawToken = (raw as { accessToken?: unknown }).accessToken;
  const accessToken = typeof rawToken === 'string' && rawToken ? rawToken : undefined;

  const deps: ProvisionDeps = {
    findMerchantByDomain: async (domain) => {
      const [m] = await db
        .select({ id: schema.merchants.id, status: schema.merchants.status })
        .from(schema.merchants)
        .where(eq(schema.merchants.domain, domain))
        .limit(1);
      return m ?? null;
    },
    createMerchant: async ({ id, domain, allowedDomains, tokenEnc }) => {
      await db.insert(schema.merchants).values({
        id,
        domain,
        name: domain,
        allowedDomains,
        platform: 'shopify',
        adapterType: 'shopify',
        status: 'onboarding',
        shopifyAdminTokenEnc: tokenEnc,
      });
    },
    updateToken: async (id, tokenEnc) => {
      await db
        .update(schema.merchants)
        .set({ shopifyAdminTokenEnc: tokenEnc })
        .where(eq(schema.merchants.id, id));
    },
    enqueueOnboarding: async (args) => {
      await onboardingQueue.add('onboarding', args);
    },
    encryptToken: encryptSecret,
    generateId: generateMerchantId,
  };

  const result = await provisionShopifyMerchant(deps, { shop, domains, accessToken });
  log.info({ shop, merchantId: result.merchantId, created: result.created }, 'shopify provision');
  return c.json(result, 200);
});
