import { type DispatchDeps, InMemorySessionState, getAdapter } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { runWithHarness } from '@shoppingmate/dom-harness';
import { childLogger } from '@shoppingmate/shared';
import { promoteToSuggest } from './promoteToSuggest.js';
import type { SelectorMap } from './selectorExtract.js';

const log = childLogger({ step: 'smokeTest' });

/** DOM cartAdd failures that mean "this merchant can't be automated" — trigger Suggest promotion. */
const DOM_PROMOTE_REASONS = new Set(['action_cap', 'override_failing', 'gave_up']);
/** Max consecutive `unsupported` cartAdd results before auto-promoting a DOM merchant. */
const DOM_UNSUPPORTED_PROMOTION_THRESHOLD = 3;

export type SmokeResult =
  | { kind: 'passed'; latencyMs: number; promotedToSuggest?: boolean }
  | { kind: 'failed'; reason: string };

export type SmokeAdapterType =
  | 'shopify'
  | 'woo'
  | 'magento'
  | 'bigcommerce'
  | 'wix'
  | 'squarespace'
  | 'dom'
  | 'suggest';

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
 *
 * Auto-promotes to Suggest when the DOMAdapter signals the merchant cannot
 * be automated: an `unsupported` reason in DOM_PROMOTE_REASONS, or
 * DOM_UNSUPPORTED_PROMOTION_THRESHOLD consecutive `unsupported` results.
 * The caller (handler / smokeTest dispatch) is responsible for re-running
 * smoke against the promoted Suggest adapter when this returns `failed` with
 * reason `promoted_to_suggest`.
 */
async function smokeDom(input: SmokeInput): Promise<SmokeResult> {
  if (!input.selectors) return { kind: 'failed', reason: 'selectors_missing' };
  if (!input.merchant) return { kind: 'failed', reason: 'merchant_missing' };
  const start = Date.now();
  const sessionId = `smoke-${Date.now()}`;
  let stop: (() => Promise<void>) | undefined;
  let promoteReason: string | null = null;
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

    let unsupportedStreak = 0;
    let lastReason = 'no_attempts';
    for (let attempt = 0; attempt < DOM_UNSUPPORTED_PROMOTION_THRESHOLD; attempt++) {
      const r = await adapter.cartAdd(
        { merchant: input.merchant, cartToken: null, sessionId },
        input.sku ?? input.firstVariantId,
        input.firstVariantId,
        1,
      );
      if (r.kind === 'ok') return { kind: 'passed', latencyMs: Date.now() - start };
      if (r.kind === 'platform_error') {
        lastReason = `http_${r.status}`;
        break;
      }
      // unsupported
      lastReason = r.reason;
      if (DOM_PROMOTE_REASONS.has(r.reason)) {
        promoteReason = r.reason;
        break;
      }
      unsupportedStreak += 1;
      if (unsupportedStreak >= DOM_UNSUPPORTED_PROMOTION_THRESHOLD) {
        promoteReason = 'three_unsupported_cart_adds';
        break;
      }
    }
    return { kind: 'failed', reason: lastReason };
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
    if (promoteReason && input.merchant) {
      try {
        await promoteToSuggest(input.merchant.id, promoteReason);
      } catch (err) {
        log.error({ err: (err as Error).message }, 'promoteToSuggest failed in smokeDom');
      }
    }
  }
}

/**
 * Suggest smoke: cart-less merchants pass when the catalog has at least one
 * indexed product. No transactable assertion — the LLM/widget just need
 * something to recommend.
 */
async function smokeSuggest(input: SmokeInput): Promise<SmokeResult> {
  if (!input.merchant) return { kind: 'failed', reason: 'merchant_missing' };
  const start = Date.now();
  try {
    const { FakeWSTransport } = await import('@shoppingmate/adapters');
    const transport = new FakeWSTransport();
    transport.ackAll({ ok: true });
    const adapter = getAdapter(input.merchant, {
      transport,
      state: new InMemorySessionState(),
    });
    const r = await adapter.searchProducts(
      { merchant: input.merchant, cartToken: null, sessionId: `smoke-${Date.now()}` },
      '',
      1,
    );
    if (r.kind !== 'ok') return { kind: 'failed', reason: 'search_unsupported' };
    if (r.value.length === 0) return { kind: 'failed', reason: 'catalog_empty' };
    return { kind: 'passed', latencyMs: Date.now() - start };
  } catch (err) {
    return { kind: 'failed', reason: `error_${(err as Error).message.slice(0, 40)}` };
  }
}

export async function smokeTest(input: SmokeInput): Promise<SmokeResult> {
  if (input.adapterType === 'suggest') return smokeSuggest(input);
  if (input.adapterType !== 'dom') return smokeViaAdapter(input);

  // DOM path: run, and if auto-promoted, re-run as Suggest with a refreshed
  // merchant row so the second pass actually dispatches to SuggestAdapter.
  const r = await smokeDom(input);
  if (r.kind === 'passed' || !input.merchant) return r;
  // Detect promotion via post-run merchant row state. Avoid an extra DB
  // import by trusting the caller to refresh the merchant; we re-dispatch
  // via Suggest only when smokeDom signaled it (it set adapterType behind
  // the scenes via promoteToSuggest).
  const { db, schema } = await import('@shoppingmate/db');
  const { eq } = await import('drizzle-orm');
  const [refreshed] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, input.merchant.id))
    .limit(1);
  if (refreshed?.adapterType === 'suggest') {
    const promoted = await smokeSuggest({
      ...input,
      adapterType: 'suggest',
      merchant: refreshed,
    });
    if (promoted.kind === 'passed') {
      return { ...promoted, promotedToSuggest: true };
    }
    return promoted;
  }
  return r;
}
