import { db as defaultDb, schema } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { eq } from 'drizzle-orm';
import { type BrandProfile, generateBrandProfile } from './generateBrandProfile.js';

const log = childLogger({ step: 'syncMerchantBrand' });

// Pages we try for brand context. Best-effort: missing pages are skipped.
const BRAND_PAGES = ['', 'pages/about', 'pages/about-us', 'policies/shipping-policy', 'pages/faq'];
const MAX_PER_PAGE = 4_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPageText(url: string, fetchFn: typeof fetch): Promise<string> {
  try {
    const res = await fetchFn(url, { headers: { accept: 'text/html' } });
    if (!res.ok) return '';
    return stripHtml(await res.text()).slice(0, MAX_PER_PAGE);
  } catch {
    return '';
  }
}

export type SyncMerchantBrandArgs = {
  merchantId: string;
  domain: string;
  brandName: string;
  db?: typeof defaultDb;
  fetchFn?: typeof fetch;
  generate?: (
    input: Parameters<typeof generateBrandProfile>[0],
  ) => Promise<BrandProfile>;
};

/**
 * Generate and persist a brand profile (summary + categories) for a merchant
 * from its own public pages, so the bot can open warmly and stay on-topic for
 * ANY store — no manual setup. Best-effort: any failure is logged and swallowed
 * so it never blocks onboarding.
 */
export async function syncMerchantBrand(
  args: SyncMerchantBrandArgs,
): Promise<{ ok: boolean; brandSummary?: string }> {
  const db = args.db ?? defaultDb;
  const fetchFn = args.fetchFn ?? fetch;
  try {
    const texts = await Promise.all(
      BRAND_PAGES.map((p) => fetchPageText(`https://${args.domain}/${p}`, fetchFn)),
    );
    const crawledText = texts.filter(Boolean).join('\n\n');
    const profile = await (args.generate ?? generateBrandProfile)({
      brandName: args.brandName,
      domain: args.domain,
      crawledText,
    });
    await db
      .update(schema.merchants)
      .set({ brandSummary: profile.brandSummary, brandCategories: profile.brandCategories })
      .where(eq(schema.merchants.id, args.merchantId));
    log.info(
      { merchantId: args.merchantId, categories: profile.brandCategories.length },
      'brand profile generated + persisted',
    );
    return { ok: true, brandSummary: profile.brandSummary };
  } catch (err) {
    log.warn(
      { merchantId: args.merchantId, err: (err as Error).message },
      'brand profile generation failed (non-fatal)',
    );
    return { ok: false };
  }
}
