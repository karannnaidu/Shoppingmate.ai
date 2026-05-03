import type { Product } from '@shoppingmate/db';
import { getProduct as repoGet, searchProducts as repoSearch } from '@shoppingmate/db';
import type { Adapter, AdapterContext, AdapterResult, CartLine, CartState } from '../types.js';
import { markSelectorFailed, resolveSelector } from './resolver.js';
import type { SessionState } from './sessionState.js';
import type { DomAck, DomAction, WSTransport } from './transport.js';

const ACTION_CAP_TURN = 50;
const ACTION_CAP_SESSION = 200;

type RunOutcome = DomAck | { kind: 'degraded' } | { kind: 'gave_up' };

function isDomAck(o: RunOutcome): o is DomAck {
  return 'ok' in o;
}

export class DOMAdapter implements Adapter {
  readonly kind = 'dom' as const;

  constructor(
    private transport: WSTransport,
    private state: SessionState,
    private llmCall?: (prompt: string) => Promise<string>,
  ) {}

  async searchProducts(
    ctx: AdapterContext,
    q: string,
    limit = 20,
  ): Promise<AdapterResult<Product[]>> {
    return { kind: 'ok', value: await repoSearch(ctx.merchant.id, q, limit) };
  }

  async getProduct(ctx: AdapterContext, sku: string): Promise<AdapterResult<Product | null>> {
    return { kind: 'ok', value: await repoGet(ctx.merchant.id, sku) };
  }

  private templateHash(ctx: AdapterContext, page: 'product' | 'cart' | 'checkout'): string {
    const cfg = ctx.merchant.adapterConfig as { page_templates?: Record<string, string> } | null;
    return cfg?.page_templates?.[page] ?? 'unknown';
  }

  private async actionCapCheck(ctx: AdapterContext): Promise<{ reason: 'action_cap' } | null> {
    const counts = await this.state.getActions(ctx.sessionId);
    if (counts.thisTurn >= ACTION_CAP_TURN || counts.thisSession >= ACTION_CAP_SESSION) {
      return { reason: 'action_cap' };
    }
    return null;
  }

  /**
   * Resolve a selector → send a built action → on selector_not_found/timeout,
   * heal once via the resolver and retry. Up to 3 attempts before giving up.
   */
  private async runWithHeal(
    ctx: AdapterContext,
    page: 'product' | 'cart' | 'checkout',
    selectorKey: string,
    build: (selector: string) => DomAction,
  ): Promise<RunOutcome> {
    const hash = this.templateHash(ctx, page);
    const cap = await this.actionCapCheck(ctx);
    if (cap) return { kind: 'gave_up' };

    let resolved = await resolveSelector({
      merchant: ctx.merchant,
      sessionId: ctx.sessionId,
      pageTemplateHash: hash,
      selectorKey,
    });

    for (let attempt = 0; attempt < 3; attempt++) {
      if (resolved.kind === 'degrade_to_suggest') return { kind: 'degraded' };
      if (resolved.kind === 'gave_up') return { kind: 'gave_up' };

      const ack = await this.transport.send(ctx.sessionId, build(resolved.selector));
      await this.state.incrAction(ctx.sessionId, 'session');
      if (ack.ok) return ack;
      if (ack.reason !== 'selector_not_found' && ack.reason !== 'timeout') return ack;

      resolved = await markSelectorFailed(
        {
          merchant: ctx.merchant,
          sessionId: ctx.sessionId,
          pageTemplateHash: hash,
          selectorKey,
          html: ack.html,
        },
        { llmCall: this.llmCall, maxLlmPerSession: 5, state: this.state },
      );
    }
    return { kind: 'gave_up' };
  }

  async cartAdd(
    ctx: AdapterContext,
    sku: string,
    _variantId: string | null,
    qty: number,
  ): Promise<AdapterResult<CartState>> {
    const product = await repoGet(ctx.merchant.id, sku);
    if (!product) return { kind: 'unsupported', reason: 'product_not_in_catalog' };

    const cap = await this.actionCapCheck(ctx);
    if (cap) return { kind: 'unsupported', reason: 'action_cap' };

    // 1. navigate to product
    const navAck = await this.transport.send(ctx.sessionId, {
      type: 'dom.navigate',
      url: product.productUrl,
    });
    await this.state.incrAction(ctx.sessionId, 'session');
    if (!navAck.ok) {
      return { kind: 'platform_error', status: 0, body: `navigate_${navAck.reason}` };
    }

    // 2. fill qty
    const fillRes = await this.runWithHeal(ctx, 'product', 'qty_input', (sel) => ({
      type: 'dom.fill',
      selector: sel,
      value: String(qty),
    }));
    if (!isDomAck(fillRes)) {
      return {
        kind: 'unsupported',
        reason: fillRes.kind === 'degraded' ? 'override_failing' : 'gave_up',
      };
    }

    // 3. click add-to-cart
    const clickRes = await this.runWithHeal(ctx, 'product', 'add_to_cart_button', (sel) => ({
      type: 'dom.click',
      selector: sel,
    }));
    if (!isDomAck(clickRes)) {
      return {
        kind: 'unsupported',
        reason: clickRes.kind === 'degraded' ? 'override_failing' : 'gave_up',
      };
    }

    // 4. wait for cart total to mutate
    const waitRes = await this.runWithHeal(ctx, 'cart', 'cart_page_total', (sel) => ({
      type: 'dom.wait_for',
      selector: sel,
      condition: 'mutation',
      timeoutMs: 5000,
    }));
    if (!isDomAck(waitRes)) {
      return { kind: 'unsupported', reason: 'wait_failed' };
    }

    // 5. read total
    const readRes = await this.runWithHeal(ctx, 'cart', 'cart_page_total', (sel) => ({
      type: 'dom.read',
      selector: sel,
    }));
    const totalText = isDomAck(readRes) && readRes.ok ? (readRes.value ?? '') : '';
    const totalCents = parseTotal(totalText);

    const lines: CartLine[] = [
      {
        lineId: `${sku}:${Date.now()}`,
        sku,
        variantId: null,
        title: product.title,
        qty,
        unitPriceCents: product.priceCents ?? totalCents,
        lineTotalCents: totalCents,
        currency: product.currency ?? 'USD',
        imageUrl: product.imageUrl,
      },
    ];

    return {
      kind: 'ok',
      value: {
        cartToken: ctx.sessionId, // DOM has no opaque token
        lines,
        subtotalCents: totalCents,
        totalCents,
        currency: product.currency ?? 'USD',
        appliedCoupons: [],
      },
    };
  }

  async cartUpdate(
    _ctx: AdapterContext,
    _lineId: string,
    _qty: number,
  ): Promise<AdapterResult<CartState>> {
    return { kind: 'unsupported', reason: 'phase2_dom_cart_update' };
  }

  async cartGet(ctx: AdapterContext): Promise<AdapterResult<CartState>> {
    return {
      kind: 'ok',
      value: {
        cartToken: ctx.sessionId,
        lines: [],
        subtotalCents: 0,
        totalCents: 0,
        currency: 'USD',
        appliedCoupons: [],
      },
    };
  }

  async couponApply(_ctx: AdapterContext, _code: string): Promise<AdapterResult<CartState>> {
    return { kind: 'unsupported', reason: 'phase2_dom_coupon' };
  }

  async checkoutUrl(ctx: AdapterContext): Promise<AdapterResult<string>> {
    const cfg = ctx.merchant.adapterConfig as { selectors?: Record<string, string> } | null;
    const sel = cfg?.selectors?.checkout_button;
    const explicitUrl = (ctx.merchant as { checkoutUrl?: string | null }).checkoutUrl ?? null;
    if (!sel && !explicitUrl) {
      return { kind: 'unsupported', reason: 'no_checkout_url' };
    }
    return { kind: 'ok', value: explicitUrl ?? `https://${ctx.merchant.domain}/cart` };
  }
}

function parseTotal(s: string): number {
  const m = s.match(/([0-9][0-9,]*\.?[0-9]*)/);
  if (!m?.[1]) return 0;
  return Math.round(Number.parseFloat(m[1].replace(/,/g, '')) * 100);
}
