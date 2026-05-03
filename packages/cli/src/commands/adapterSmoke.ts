import {
  type AdapterContext,
  type DispatchDeps,
  FakeWSTransport,
  InMemorySessionState,
  getAdapter,
} from '@shoppingmate/adapters';
import { db, schema } from '@shoppingmate/db';
import { runWithHarness } from '@shoppingmate/dom-harness';
import { eq } from 'drizzle-orm';

type CallHaiku = (prompt: string) => Promise<string>;

async function defaultHaikuCall(prompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY missing — cannot heal selectors');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'http-referer': 'https://shoppingmate.ai',
      'x-title': 'shoppingmate-adapter-smoke',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`openrouter http ${res.status}`);
  const body = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return body.choices[0]?.message?.content?.trim() ?? '';
}

export async function adapterSmoke(
  merchantId: string,
  opts: { llmCall?: CallHaiku } = {},
): Promise<number> {
  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);
  if (!merchant) {
    console.error(`merchant ${merchantId} not found`);
    return 1;
  }

  let ctx: AdapterContext = {
    merchant,
    cartToken: null,
    sessionId: `smoke-${Date.now()}`,
  };

  // For DOM merchants, spin a local WS server + Playwright harness so the
  // DOMAdapter has something to talk to (mirrors production widget round-trip).
  // For Suggest merchants, use a fake transport that auto-acks so we can
  // capture the ui.show_message + ui.show_product_card actions and assert
  // they were emitted (the live widget would render these into the chat
  // column without driving a real cart).
  let dispatchDeps: DispatchDeps | undefined;
  let suggestTransport: FakeWSTransport | undefined;
  let harnessStop: (() => Promise<void>) | undefined;
  if (merchant.adapterType === 'dom') {
    const setup = await runWithHarness({
      sessionId: ctx.sessionId,
      merchantId: merchant.id,
      initialUrl: `https://${merchant.domain}`,
    });
    harnessStop = setup.stop;
    dispatchDeps = {
      transport: setup.transport,
      state: new InMemorySessionState(),
      llmCall: opts.llmCall ?? defaultHaikuCall,
    };
  } else if (merchant.adapterType === 'suggest') {
    suggestTransport = new FakeWSTransport();
    suggestTransport.ackAll({ ok: true });
    dispatchDeps = {
      transport: suggestTransport,
      state: new InMemorySessionState(),
    };
  }

  const a = getAdapter(merchant, dispatchDeps);
  const log = (label: string, ok: boolean, extra?: string): void => {
    console.log(`${ok ? '[OK]' : '[FAIL]'} ${label}${extra ? ` — ${extra}` : ''}`);
  };

  try {
    // 1. searchProducts
    const sp = await a.searchProducts(ctx, '', 5);
    log('searchProducts', sp.kind === 'ok' && sp.value.length > 0, sp.kind);
    if (sp.kind !== 'ok' || sp.value.length === 0) return 1;

    // 2. getProduct
    const first = sp.value[0];
    if (!first) return 1;
    const gp = await a.getProduct(ctx, first.sku);
    log('getProduct', gp.kind === 'ok' && gp.value !== null);

    // 3. cartAdd
    const variants = (first.variants ?? []) as Array<{ id: string }>;
    const variantId = variants[0]?.id ?? null;
    const ca = await a.cartAdd(ctx, first.sku, variantId, 1);
    log('cartAdd', ca.kind === 'ok', ca.kind);
    if (ca.kind !== 'ok') return 1;
    ctx = { ...ctx, cartToken: ca.value.cartToken };

    // 3a. Suggest-only: assert ui.show_message + ui.show_product_card emitted.
    if (merchant.adapterType === 'suggest' && suggestTransport) {
      const sent = suggestTransport.sent(ctx.sessionId);
      const hasMessage = sent.some((m) => m.type === 'ui.show_message');
      const hasCard = sent.some((m) => m.type === 'ui.show_product_card');
      log('suggest.ui.show_message', hasMessage);
      log('suggest.ui.show_product_card', hasCard);
      if (!hasMessage || !hasCard) return 1;
    }

    // 4. cartGet — Suggest returns an empty placeholder by design; only
    // require non-empty lines for transactable adapters (and DOM is
    // partial-state, so its cartGet may also be empty).
    const cg = await a.cartGet(ctx);
    const cartGetOk =
      cg.kind === 'ok' &&
      (cg.value.lines.length > 0 ||
        merchant.adapterType === 'dom' ||
        merchant.adapterType === 'suggest');
    log('cartGet', cartGetOk);

    // 5. cartUpdate — skip for Suggest (it narrates and returns placeholder
    // without exposing a lineId).
    if (
      merchant.adapterType !== 'suggest' &&
      cg.kind === 'ok' &&
      cg.value.lines[0]
    ) {
      const cu = await a.cartUpdate(ctx, cg.value.lines[0].lineId, 2);
      log('cartUpdate', cu.kind === 'ok' || cu.kind === 'unsupported');
    }

    // 6. couponApply (failure tolerated)
    const coupon = process.env.SMOKE_COUPON ?? 'TESTNONE';
    const cp = await a.couponApply(ctx, coupon);
    log(`couponApply(${coupon})`, true, cp.kind);

    // 7. checkoutUrl — Suggest legitimately returns `unsupported` when the
    // merchant has no `checkoutUrl` configured; tolerate that case.
    const ch = await a.checkoutUrl(ctx);
    const checkoutOk =
      ch.kind === 'ok' || (merchant.adapterType === 'suggest' && ch.kind === 'unsupported');
    log('checkoutUrl', checkoutOk, ch.kind === 'ok' ? ch.value : ch.kind);

    return 0;
  } finally {
    if (harnessStop) await harnessStop();
  }
}
