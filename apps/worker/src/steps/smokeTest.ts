import { childLogger } from '@shoppingmate/shared';
import { withContext } from '../lib/playwright.js';
import type { SelectorMap } from './selectorExtract.js';

const log = childLogger({ step: 'smokeTest' });
const USER_AGENT = 'Mozilla/5.0 (compatible; ShoppingmateBot/0.1; +https://shoppingmate.ai/bot)';

export type SmokeResult =
  | { kind: 'passed'; latencyMs: number }
  | { kind: 'failed'; reason: string };

export type SmokeInput = {
  adapterType: 'shopify' | 'woo' | 'dom';
  domain: string;
  firstVariantId: string;
  productUrl: string;
  selectors: SelectorMap | null;
};

async function smokeShopify(domain: string, variantId: string): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const res = await fetch(`https://${domain}/cart/add.js`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
      body: JSON.stringify({ id: Number(variantId), quantity: 1 }),
    });
    if (!res.ok) return { kind: 'failed', reason: `http_${res.status}` };
    return { kind: 'passed', latencyMs: Date.now() - start };
  } catch (err) {
    return { kind: 'failed', reason: `error_${(err as Error).message.slice(0, 40)}` };
  }
}

async function smokeWoo(domain: string, productId: string): Promise<SmokeResult> {
  const start = Date.now();
  try {
    const res = await fetch(`https://${domain}/wp-json/wc/store/v1/cart/add-item`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
      body: JSON.stringify({ id: Number(productId), quantity: 1 }),
    });
    if (!res.ok) return { kind: 'failed', reason: `http_${res.status}` };
    return { kind: 'passed', latencyMs: Date.now() - start };
  } catch (err) {
    return { kind: 'failed', reason: `error_${(err as Error).message.slice(0, 40)}` };
  }
}

async function smokeDom(input: SmokeInput): Promise<SmokeResult> {
  if (!input.selectors) return { kind: 'failed', reason: 'selectors_missing' };
  const selectors = input.selectors;
  const start = Date.now();
  try {
    return await withContext(async (ctx) => {
      const page = await ctx.newPage();
      try {
        await page.goto(input.productUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        const before = await page
          .locator(selectors.cart_page_total)
          .innerText()
          .catch(() => '');
        await page.locator(selectors.add_to_cart_button).click({ timeout: 5_000 });
        await page.waitForFunction(
          ([sel, prev]: [string, string]) => {
            const el = document.querySelector(sel) as HTMLElement | null;
            return !!el && (el.innerText ?? '') !== prev;
          },
          [selectors.cart_page_total, before] as [string, string],
          { timeout: 5_000 },
        );
        return { kind: 'passed', latencyMs: Date.now() - start } as const;
      } finally {
        await page.close();
      }
    });
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'dom smoke failed');
    return { kind: 'failed', reason: 'no_cart_mutation' };
  }
}

export async function smokeTest(input: SmokeInput): Promise<SmokeResult> {
  if (input.adapterType === 'shopify') return smokeShopify(input.domain, input.firstVariantId);
  if (input.adapterType === 'woo') return smokeWoo(input.domain, input.firstVariantId);
  return smokeDom(input);
}
