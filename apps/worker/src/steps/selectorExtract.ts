import { createHash } from 'node:crypto';
import { childLogger } from '@shoppingmate/shared';
import { chat, type ChatMessage } from '../lib/openrouter.js';
import { withContext } from '../lib/playwright.js';

const log = childLogger({ step: 'selectorExtract' });

const SELECTOR_KEYS = [
  'add_to_cart_button',
  'qty_input',
  'variant_selector_template',
  'cart_url',
  'cart_page_total',
  'checkout_button',
  'coupon_field',
  'coupon_apply_button',
  'line_item_remove_button',
  'thank_you_order_id',
  'thank_you_total',
] as const;

export type SelectorMap = Record<(typeof SELECTOR_KEYS)[number], string>;

export type SelectorExtractResult =
  | {
      kind: 'ok';
      selectors: SelectorMap;
      pageTemplates: { product: string; cart: string; checkout: string };
      llmInputTokens: number;
      llmOutputTokens: number;
    }
  | { kind: 'failed'; reason: string };

export type SelectorExtractInput = {
  merchantId: string;
  domain: string;
  sampleProductUrl: string;
  cartUrl: string;
  checkoutUrl: string;
  // injected for tests
  renderHtml?: (url: string) => Promise<string>;
  callLlm?: (opts: { messages: ChatMessage[] }) => Promise<string>;
};

async function defaultRender(url: string): Promise<string> {
  return withContext(async (ctx) => {
    const page = await ctx.newPage();
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      return await page.content();
    } finally {
      await page.close();
    }
  });
}

async function defaultCallLlm({ messages }: { messages: ChatMessage[] }): Promise<string> {
  const r = await chat({
    model: 'anthropic/claude-sonnet-4-6',
    messages,
    responseFormat: 'json',
    timeoutMs: 90_000,
  });
  return r.text;
}

function normalizeDom(html: string): string {
  // strip scripts/styles/text content; keep tag tree + ids/classes
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/>\s*[^<]*\s*</g, '><')
    .toLowerCase();
}

function templateHash(html: string): string {
  return `sha256:${createHash('sha256').update(normalizeDom(html)).digest('hex')}`;
}

export async function selectorExtract(
  input: SelectorExtractInput,
): Promise<SelectorExtractResult> {
  const render = input.renderHtml ?? defaultRender;
  const llm = input.callLlm ?? defaultCallLlm;

  let productHtml: string;
  let cartHtml: string;
  let checkoutHtml: string;
  try {
    productHtml = await render(input.sampleProductUrl);
    cartHtml = await render(input.cartUrl);
    checkoutHtml = await render(input.checkoutUrl);
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'page render failed');
    return { kind: 'failed', reason: 'render_error' };
  }

  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: `You are a senior browser automation engineer. Given a product page, cart page, and checkout page (HTML), return JSON with one CSS selector for each of these keys: ${SELECTOR_KEYS.join(', ')}. variant_selector_template should contain the placeholder {value}. cart_url is a path or URL. Do not include explanations.`,
    },
    {
      role: 'user',
      content: `PRODUCT PAGE:\n${productHtml.slice(0, 60_000)}\n\nCART PAGE:\n${cartHtml.slice(0, 60_000)}\n\nCHECKOUT PAGE:\n${checkoutHtml.slice(0, 60_000)}`,
    },
  ];

  let raw: string;
  try {
    raw = await llm({ messages });
  } catch (err) {
    log.warn({ err: (err as Error).message }, 'selector extraction llm call failed');
    return { kind: 'failed', reason: 'llm_error' };
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { kind: 'failed', reason: 'llm_parse_failed' };
  }
  for (const k of SELECTOR_KEYS) {
    if (typeof parsed[k] !== 'string') return { kind: 'failed', reason: `missing_${k}` };
  }
  const selectors = Object.fromEntries(SELECTOR_KEYS.map((k) => [k, parsed[k]])) as SelectorMap;
  return {
    kind: 'ok',
    selectors,
    pageTemplates: {
      product: templateHash(productHtml),
      cart: templateHash(cartHtml),
      checkout: templateHash(checkoutHtml),
    },
    llmInputTokens: 0,
    llmOutputTokens: 0,
  };
}
