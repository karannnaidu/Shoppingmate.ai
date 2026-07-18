import { db, schema } from '@shoppingmate/db';
import { onboardingQueue } from '@shoppingmate/jobs';
import { childLogger, generateMerchantId } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

const log = childLogger({ route: 'shopify-provision' });

// Called server-to-server by the Shopify embedded admin app after OAuth install.
// Provisions a shoppingmate merchant for the shop and enqueues the existing
// onboarding pipeline (fingerprint -> catalog sync -> brand auto-gen). The admin
// app then reads back the merchant id and exposes it to the storefront widget
// via an app metafield. Idempotent so reinstalls reuse the same merchant.
export type ProvisionDeps = {
  findMerchantByDomain: (domain: string) => Promise<{ id: string; status: string } | null>;
  createMerchant: (m: { id: string; domain: string; allowedDomains: string[] }) => Promise<void>;
  enqueueOnboarding: (args: { merchantId: string; domain: string }) => Promise<void>;
  generateId: () => string;
};

export type ProvisionInput = { shop: string; domains?: string[] };

export async function provisionShopifyMerchant(
  deps: ProvisionDeps,
  input: ProvisionInput,
): Promise<{ merchantId: string; created: boolean }> {
  const shop = input.shop.trim().toLowerCase();
  const existing = await deps.findMerchantByDomain(shop);
  if (existing) return { merchantId: existing.id, created: false };

  const merchantId = deps.generateId();
  const extra = (input.domains ?? []).map((d) => d.trim().toLowerCase()).filter(Boolean);
  const allowedDomains = Array.from(new Set([shop, ...extra]));
  await deps.createMerchant({ id: merchantId, domain: shop, allowedDomains });
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

  const deps: ProvisionDeps = {
    findMerchantByDomain: async (domain) => {
      const [m] = await db
        .select({ id: schema.merchants.id, status: schema.merchants.status })
        .from(schema.merchants)
        .where(eq(schema.merchants.domain, domain))
        .limit(1);
      return m ?? null;
    },
    createMerchant: async ({ id, domain, allowedDomains }) => {
      await db.insert(schema.merchants).values({
        id,
        domain,
        name: domain,
        allowedDomains,
        platform: 'shopify',
        adapterType: 'shopify',
        status: 'onboarding',
      });
    },
    enqueueOnboarding: async (args) => {
      await onboardingQueue.add('onboarding', args);
    },
    generateId: generateMerchantId,
  };

  const result = await provisionShopifyMerchant(deps, { shop, domains });
  log.info({ shop, merchantId: result.merchantId, created: result.created }, 'shopify provision');
  return c.json(result, 200);
});
