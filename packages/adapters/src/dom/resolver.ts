import type { Merchant } from '@shoppingmate/db';
import { selectorCacheRepo } from '@shoppingmate/db';
import type { SelectorSource } from '@shoppingmate/db';

export type ResolveOutcome =
  | { kind: 'use_selector'; selector: string; source: SelectorSource }
  | { kind: 'degrade_to_suggest'; reason: string }
  | { kind: 'gave_up'; reason: string };

export type ResolveCtx = {
  merchant: Merchant;
  sessionId: string;
  pageTemplateHash: string;
  selectorKey: string;
  /** raw HTML of the failing page; passed to Haiku when healing */
  html?: string;
};

export type ResolveOptions = {
  /** OpenRouter Haiku 4.5 callable; absent → resolver cannot heal. */
  llmCall?: (prompt: string) => Promise<string>;
  /** cap of resolver/LLM calls per session (default 5) */
  maxLlmPerSession?: number;
  state?: { incrResolver(sessionId: string): Promise<number> };
};

const KEY_HINTS: Record<string, string> = {
  add_to_cart_button: 'the button that adds the current product to cart',
  qty_input: 'the quantity number input on a product or cart page',
  variant_selector_template: 'the swatch/select that picks a product variant',
  cart_url: 'the URL or anchor that navigates to the cart page',
  cart_page_total: 'the cart-total text element on the cart page',
  checkout_button: 'the button that proceeds to checkout',
  coupon_field: 'the input where the visitor types a coupon code',
  coupon_apply_button: 'the button that submits the coupon',
  line_item_remove_button: 'the button that removes a line item from the cart',
  thank_you_order_id: 'the order id text on the thank-you page',
  thank_you_total: 'the total text on the thank-you page',
};

function buildPrompt(ctx: ResolveCtx): string {
  const html = (ctx.html ?? '').slice(0, 24_000); // ~6k tokens upper bound
  const hint = KEY_HINTS[ctx.selectorKey] ?? 'a relevant element';
  return [
    'You are extracting a CSS selector from this DOM. Return ONLY the selector string, no explanation, no quotes, no backticks.',
    `Selector key: ${ctx.selectorKey}`,
    `Hint: ${hint}`,
    `Truncated HTML:\n${html}`,
  ].join('\n\n');
}

/**
 * First-attempt resolver: cache hit → use it; else fall back to merchant
 * adapterConfig.selectors[key]; else `gave_up`. A `merchant_override` row
 * with `last_test_passed=false` short-circuits to `degrade_to_suggest` so we
 * never silently mutate the override.
 */
export async function resolveSelector(
  ctx: ResolveCtx,
  _opts: ResolveOptions = {},
): Promise<ResolveOutcome> {
  const cached = await selectorCacheRepo.get(
    ctx.merchant.id,
    ctx.pageTemplateHash,
    ctx.selectorKey,
  );
  if (cached) {
    if (cached.source === 'merchant_override' && cached.lastTestPassed === false) {
      return { kind: 'degrade_to_suggest', reason: 'override_failing' };
    }
    return { kind: 'use_selector', selector: cached.resolvedSelector, source: cached.source };
  }
  const cfg = ctx.merchant.adapterConfig as { selectors?: Record<string, string> } | null;
  const fromConfig = cfg?.selectors?.[ctx.selectorKey];
  if (fromConfig) return { kind: 'use_selector', selector: fromConfig, source: 'auto' };
  return { kind: 'gave_up', reason: 'no_selector_anywhere' };
}

/**
 * Heal path: called by the adapter after a `selector_not_found`/`timeout` ack.
 * Asks Haiku for a replacement selector against the failing page's HTML, caches
 * the result as `llm_resolved`. If the existing row is `merchant_override`,
 * never mutates the selector — writes only `suggested_replacement` and returns
 * `degrade_to_suggest` so the agent can ask the visitor for help instead.
 */
export async function markSelectorFailed(
  ctx: ResolveCtx,
  opts: ResolveOptions = {},
): Promise<ResolveOutcome> {
  const max = opts.maxLlmPerSession ?? 5;
  const calls = (await opts.state?.incrResolver(ctx.sessionId)) ?? 1;
  const cached = await selectorCacheRepo.get(
    ctx.merchant.id,
    ctx.pageTemplateHash,
    ctx.selectorKey,
  );

  // Override-permanence: ask Haiku for a hint but DO NOT replace the selector.
  if (cached?.source === 'merchant_override') {
    let suggestion: string | null = null;
    if (opts.llmCall && calls <= max) {
      try {
        suggestion = await opts.llmCall(buildPrompt(ctx));
      } catch {
        // swallow; suggestion stays null
      }
    }
    await selectorCacheRepo.markOverrideFailing(
      ctx.merchant.id,
      ctx.pageTemplateHash,
      ctx.selectorKey,
      suggestion,
    );
    return { kind: 'degrade_to_suggest', reason: 'override_failing' };
  }

  if (calls > max) return { kind: 'gave_up', reason: 'resolver_cap_exhausted' };
  if (!opts.llmCall) return { kind: 'gave_up', reason: 'no_llm_callable' };

  let selector: string;
  try {
    selector = await opts.llmCall(buildPrompt(ctx));
  } catch (err) {
    return { kind: 'gave_up', reason: `llm_error_${(err as Error).message.slice(0, 40)}` };
  }
  selector = selector.trim();
  if (!selector || selector.length > 500) {
    return { kind: 'gave_up', reason: 'llm_bad_output' };
  }
  await selectorCacheRepo.upsertHealed(
    ctx.merchant.id,
    ctx.pageTemplateHash,
    ctx.selectorKey,
    selector,
  );
  return { kind: 'use_selector', selector, source: 'llm_resolved' };
}
