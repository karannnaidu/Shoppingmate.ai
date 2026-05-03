import { type DispatchDeps, InMemorySessionState, getAdapter } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { runWithHarness } from '@shoppingmate/dom-harness';
import { childLogger } from '@shoppingmate/shared';
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
  /**
   * Optional Haiku-equivalent LLM call used by the DOM resolver for selector
   * healing. Wired through to the DOMAdapter when adapterType==='dom'.
   * Production worker passes its OpenRouter caller; tests omit it.
   */
  llmCall?: (prompt: string) => Promise<string>;
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

/**
 * DOM smoke: stand up the same WS+harness pipe used by `pnpm shoppingmate
 * adapter-smoke` and call DOMAdapter.cartAdd through it. This way the
 * onboarding gate exercises selector resolution and Haiku-healing — i.e. the
 * exact code path the live widget will hit.
 */
async function smokeDom(input: SmokeInput): Promise<SmokeResult> {
  if (!input.selectors) return { kind: 'failed', reason: 'selectors_missing' };
  if (!input.merchant) return { kind: 'failed', reason: 'merchant_missing' };
  const start = Date.now();
  const sessionId = `smoke-${Date.now()}`;
  let stop: (() => Promise<void>) | undefined;
  try {
    const setup = await runWithHarness({
      sessionId,
      merchantId: input.merchant.id,
      initialUrl: input.productUrl,
    });
    stop = setup.stop;
    const deps: DispatchDeps = {
      transport: setup.transport,
      state: new InMemorySessionState(),
      llmCall: input.llmCall,
    };
    const adapter = getAdapter(input.merchant, deps);
    const r = await adapter.cartAdd(
      { merchant: input.merchant, cartToken: null, sessionId },
      input.sku ?? input.firstVariantId,
      input.firstVariantId,
      1,
    );
    if (r.kind === 'ok') return { kind: 'passed', latencyMs: Date.now() - start };
    if (r.kind === 'platform_error') return { kind: 'failed', reason: `http_${r.status}` };
    return { kind: 'failed', reason: r.reason };
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'dom smoke failed');
    return { kind: 'failed', reason: `error_${(err as Error).message.slice(0, 40)}` };
  } finally {
    if (stop) {
      try {
        await stop();
      } catch {
        // teardown best-effort
      }
    }
  }
}

export async function smokeTest(input: SmokeInput): Promise<SmokeResult> {
  if (input.adapterType === 'dom') return smokeDom(input);
  return smokeViaAdapter(input);
}
