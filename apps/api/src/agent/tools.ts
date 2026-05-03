import type { Adapter, AdapterContext, AdapterResult } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import type { ToolDef } from '@shoppingmate/shared';

export function buildToolSurface(_merchant: Merchant): ToolDef[] {
  return [
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
}

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
    default:
      return { ok: false, kind: 'unsupported', reason: 'unknown_tool' };
  }
}
