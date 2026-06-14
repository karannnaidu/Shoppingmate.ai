import type { Adapter, AdapterContext, AdapterResult } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import type { ToolDef } from '@shoppingmate/shared';
import { findPlan } from './pricing/plans.js';
import { formatPlanSpeech } from './pricing/speech.js';

export const SHOPPINGMATE_DEMO_MERCHANT_ID =
  process.env.SHOPPINGMATE_DEMO_MERCHANT_ID ?? 'SM-XPK2EN';

/**
 * Whether the merchant's adapter can actually mutate a server-side cart.
 *
 * 'dom' and 'suggest' adapters "add to cart" by driving the live page through a
 * WSTransport — but in the current runtime that transport is a no-op (the
 * widget has no dom-harness handler), so cart.add/update/coupons silently FAKE
 * success and the assistant then lies ("added to cart") while nothing changed
 * on the real site. Only the API-backed adapters (shopify, woo, magento,
 * bigcommerce, wix, squarespace) truly modify a cart. For the faked ones we
 * drop the cart tools and steer the model to navigate the visitor to the
 * product page instead (see buildSystemPrompt). */
export function merchantCanMutateCart(merchant: Merchant): boolean {
  return merchant.adapterType !== 'dom' && merchant.adapterType !== 'suggest';
}

/** The Calmosis tenant — its storefront exposes window.__shoppingmateCartAdd__
 *  and a guest checkout API, so its bot drives the real cart via host actions
 *  (not the faked DOM adapter). */
export const CALMOSIS_MERCHANT_ID = 'SM-2SCCLZ';
export function isCalmosisStitch(merchant: Pick<Merchant, 'id'>): boolean {
  return merchant.id === CALMOSIS_MERCHANT_ID;
}

// Calmosis cart/coupon tools are HOST ACTIONS (executed by the widget against
// the storefront's __shoppingmate*__ hooks), not adapter calls.
const CALMOSIS_SKU_DESC = 'One of: peace-mantra, sleep-mantra, green-mantra, dog-mantra';
const CALMOSIS_CART_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'cart.add',
      description:
        "Add a product to the visitor's cart on the Calmosis store and open the cart. Use when the visitor wants to add or buy a product. Calling again adds one more of the same product.",
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: CALMOSIS_SKU_DESC },
          qty: { type: 'integer', minimum: 1, default: 1 },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cart.update',
      description:
        "Set the EXACT quantity of a product already in the cart (e.g. the visitor says 'make it 1' or 'I want 2'). Use qty 0 to REMOVE the product from the cart.",
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: CALMOSIS_SKU_DESC },
          qty: { type: 'integer', minimum: 0, description: '0 removes the item' },
        },
        required: ['sku', 'qty'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'coupon.apply',
      description:
        'Apply a discount/coupon code to the order (e.g. CALM10). The discount is reflected at checkout. Only claim it worked if this returns success.',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
      },
    },
  },
];

export function buildToolSurface(merchant: Merchant): ToolDef[] {
  const productTools: ToolDef[] = [
    {
      type: 'function',
      function: {
        name: 'products.search',
        description:
          "Search the merchant's catalog. Use whenever the visitor asks for a product or category.",
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description:
                'Free-text search (e.g. "winter face cream", "wedding dress under 2000")',
            },
            limit: { type: 'integer', minimum: 1, maximum: 20, default: 5 },
          },
          required: ['query'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'products.get',
        description:
          'Fetch full product detail by SKU. Use for variant disambiguation or detail Q&A.',
        parameters: {
          type: 'object',
          properties: { sku: { type: 'string' } },
          required: ['sku'],
        },
      },
    },
  ];
  const cartTools: ToolDef[] = [
    {
      type: 'function',
      function: {
        name: 'cart.add',
        description: "Add an item to the visitor's cart.",
        parameters: {
          type: 'object',
          properties: {
            sku: { type: 'string' },
            variantId: { type: ['string', 'null'], description: 'null if product has no variants' },
            qty: { type: 'integer', minimum: 1 },
          },
          required: ['sku', 'qty'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'cart.update',
        description: 'Change quantity of an existing line item. Set qty=0 to remove.',
        parameters: {
          type: 'object',
          properties: {
            lineId: { type: 'string' },
            qty: { type: 'integer', minimum: 0 },
          },
          required: ['lineId', 'qty'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'cart.get',
        description: 'Read the current cart contents.',
        parameters: { type: 'object', properties: {} },
      },
    },
    {
      type: 'function',
      function: {
        name: 'coupons.apply',
        description: 'Apply a coupon code the visitor mentioned or the agent knows.',
        parameters: {
          type: 'object',
          properties: { code: { type: 'string' } },
          required: ['code'],
        },
      },
    },
  ];
  const checkoutTools: ToolDef[] = [
    {
      type: 'function',
      function: {
        name: 'checkout.url',
        description:
          "When the visitor is ready to pay, fetch the merchant's native checkout URL. The runtime will redirect them.",
        parameters: { type: 'object', properties: {} },
      },
    },
  ];
  // Demo merchant keeps the full surface — its showcase tour expects cart tools.
  if (merchant.id === SHOPPINGMATE_DEMO_MERCHANT_ID) {
    return [...productTools, ...cartTools, ...checkoutTools, ...DEMO_TOOLS];
  }
  // Drop cart-mutation tools for adapters that can't really change a cart
  // (dom/suggest) so the model can't claim it added something it didn't.
  const base = merchantCanMutateCart(merchant)
    ? [...productTools, ...cartTools, ...checkoutTools]
    : [...productTools, ...checkoutTools];
  if (merchant.siteGraphEnabled) {
    const siteTools = isCalmosisStitch(merchant)
      ? [...SITE_NAV_TOOLS, ...CALMOSIS_CART_TOOLS]
      : SITE_NAV_TOOLS;
    return [...base, ...siteTools];
  }
  return base;
}

// Site-graph merchants (e.g. Calmosis) get navigation tools so the bot can
// route the visitor between pages of their SPA. We don't expose the heuristic
// tools (scroll_to / highlight / click / point_at / demo_click) outside the
// shoppingmate.ai demo because those require selector resolution we haven't
// built for arbitrary host sites yet.
const SITE_NAV_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'site.navigate',
      description:
        "Navigate the visitor's browser to a same-origin path on the merchant's site (e.g. a product page, cart, checkout). Use this whenever the visitor asks to see a specific page or product, or after you've recommended a product and want to take them there.",
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description:
              'Relative path starting with "/", e.g. "/shop", "/shop/green-mantra", "/checkout", "/contact"',
          },
        },
        required: ['path'],
      },
    },
  },
];

const DEMO_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'site.navigate',
      description:
        "Navigate the visitor's browser to a same-origin path on shoppingmate.ai (demo-only).",
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'e.g. /pricing, /features' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site.scroll_to',
      description: 'Smoothly scroll the visitor to a section matched by free-text intent.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', description: 'e.g. "plan grid", "features section", "starter plan card"' },
        },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site.highlight',
      description: 'Visually pulse an element matched by intent for a few seconds.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string' },
          duration_ms: { type: 'integer', minimum: 500, maximum: 6000, default: 2000 },
        },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site.click',
      description: 'Click an element on the page matched by intent (e.g. the Sign up button).',
      parameters: {
        type: 'object',
        properties: { intent: { type: 'string' } },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site.point_at',
      description:
        'Glide the visible Sage cursor over an element so the visitor sees what you are talking about. Use this BEFORE you start describing anything on screen — point first, then narrate. Does NOT click; pairs with scroll_to / highlight / demo_click.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', description: 'e.g. "pricing nav link", "starter plan card", "install snippet"' },
        },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site.demo_click',
      description:
        'Glide the cursor to an element, pulse, and click it for real (navigates if it is a link). Use for walkthrough actions — opening a page, expanding a section, etc. Narrate aloud while calling this so the visitor follows your hands.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', description: 'e.g. "pricing nav link", "features card", "sign up button"' },
        },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pricing.quote',
      description:
        "Get the canonical, server-formatted speech string for a plan. ALWAYS use this when voicing a price. Returns { planId, speech, card }. Speak the `speech` field verbatim — do not paraphrase or rewrite the numbers.",
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', enum: ['starter', 'growth', 'enterprise'] },
        },
        required: ['plan_id'],
      },
    },
  },
];

export type ToolResultEnvelope =
  | { ok: true; value: unknown }
  | { ok: false; kind: 'unsupported'; reason: string }
  | { ok: false; kind: 'platform_error'; status: number; body: string }
  | { ok: false; kind: 'not_found'; query?: string }
  | { ok: false; kind: 'retry_exhausted' };

function toEnvelope<T>(r: AdapterResult<T>): ToolResultEnvelope {
  if (r.kind === 'ok') return { ok: true, value: r.value };
  if (r.kind === 'unsupported') return { ok: false, kind: 'unsupported', reason: r.reason };
  return { ok: false, kind: 'platform_error', status: r.status, body: r.body };
}

export async function dispatchTool(
  adapter: Adapter,
  ctx: AdapterContext,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResultEnvelope> {
  switch (name) {
    case 'products.search': {
      const r = await adapter.searchProducts(
        ctx,
        String(args.query ?? ''),
        Number(args.limit) || undefined,
      );
      if (r.kind === 'ok' && r.value.length === 0) {
        return { ok: false, kind: 'not_found', query: String(args.query ?? '') };
      }
      return toEnvelope(r);
    }
    case 'products.get': {
      const r = await adapter.getProduct(ctx, String(args.sku ?? ''));
      if (r.kind === 'ok' && r.value === null) {
        return { ok: false, kind: 'not_found', query: String(args.sku ?? '') };
      }
      return toEnvelope(r);
    }
    case 'cart.add': {
      const variantId = args.variantId == null ? null : String(args.variantId);
      const r = await adapter.cartAdd(
        ctx,
        String(args.sku ?? ''),
        variantId,
        Number(args.qty) || 1,
      );
      return toEnvelope(r);
    }
    case 'cart.update': {
      const r = await adapter.cartUpdate(ctx, String(args.lineId ?? ''), Number(args.qty) || 0);
      return toEnvelope(r);
    }
    case 'cart.get': {
      const r = await adapter.cartGet(ctx);
      return toEnvelope(r);
    }
    case 'coupons.apply': {
      const r = await adapter.couponApply(ctx, String(args.code ?? ''));
      return toEnvelope(r);
    }
    case 'checkout.url': {
      const r = await adapter.checkoutUrl(ctx);
      return toEnvelope(r);
    }
    case 'pricing.quote': {
      const plan = findPlan(String(args.plan_id ?? ''));
      if (!plan) return { ok: false, kind: 'not_found', query: String(args.plan_id ?? '') };
      const speech = formatPlanSpeech(plan);
      const priceFormatted =
        plan.priceCents === null ? 'Custom' : `$${(plan.priceCents / 100).toFixed(0)}`;
      return {
        ok: true,
        value: {
          planId: plan.id,
          speech,
          card: { name: plan.displayName, priceFormatted, convCount: plan.convCount },
        },
      };
    }
    case 'site.navigate':
    case 'site.scroll_to':
    case 'site.highlight':
    case 'site.click':
    case 'site.point_at':
    case 'site.demo_click': {
      return { ok: false, kind: 'unsupported', reason: 'host_action_dispatcher_missing' };
    }
    default:
      return { ok: false, kind: 'unsupported', reason: 'unknown_tool' };
  }
}
