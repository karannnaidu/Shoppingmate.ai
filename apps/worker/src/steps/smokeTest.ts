import { getAdapter } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';
import { withContext } from '../lib/playwright.js';
import type { SelectorMap } from './selectorExtract.js';

const log = childLogger({ step: 'smokeTest' });

export type SmokeResult =
  | { kind: 'passed'; latencyMs: number }
  | { kind: 'failed'; reason: string };

export type SmokeAdapterType =
  | 'shopify'
  | 'woo'
  | 'magento'
  | 'bigcommerce'
  | 'wix'
  | 'squarespace'
  | 'dom';

export type SmokeInput = {
  adapterType: SmokeAdapterType;
  domain: string;
  firstVariantId: string;
  productUrl: string;
  selectors: SelectorMap | null;
  /**
   * Required for non-`dom` adapter types in Plan 3c+. Routed through
   * `getAdapter(merchant).cartAdd(...)`. Optional only so legacy callers /
   * tests that pre-date the refactor keep working until callers adopt it.
   */
  merchant?: Merchant;
  /** Product SKU for adapter cartAdd. Falls back to firstVariantId when absent. */
  sku?: string;
};

async function smokeViaAdapter(input: SmokeInput): Promise<SmokeResult> {
  const start = Date.now();
  if (!input.merchant) return { kind: 'failed', reason: 'merchant_missing' };
  try {
    const adapter = getAdapter(input.merchant);
    const r = await adapter.cartAdd(
      { merchant: input.merchant, cartToken: null, sessionId: `smoke-${Date.now()}` },
      input.sku ?? input.firstVariantId,
      input.firstVariantId,
      1,
    );
    if (r.kind === 'ok') return { kind: 'passed', latencyMs: Date.now() - start };
    if (r.kind === 'platform_error') return { kind: 'failed', reason: `http_${r.status}` };
    return { kind: 'failed', reason: r.reason };
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
            // biome-ignore lint/suspicious/noExplicitAny: Playwright evaluates this in browser context
            const doc = (globalThis as any).document;
            const el = doc?.querySelector(sel) as { innerText?: string } | null;
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
  if (input.adapterType === 'dom') return smokeDom(input);
  return smokeViaAdapter(input);
}
