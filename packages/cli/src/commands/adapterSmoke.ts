import {
  type AdapterContext,
  type DispatchDeps,
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
  let domDeps: DispatchDeps | undefined;
  let harnessStop: (() => Promise<void>) | undefined;
  if (merchant.adapterType === 'dom') {
    const setup = await runWithHarness({
      sessionId: ctx.sessionId,
      merchantId: merchant.id,
      initialUrl: `https://${merchant.domain}`,
    });
    harnessStop = setup.stop;
    domDeps = {
      transport: setup.transport,
      state: new InMemorySessionState(),
      llmCall: opts.llmCall ?? defaultHaikuCall,
    };
  }

  const a = getAdapter(merchant, domDeps);
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

    // 4. cartGet
    const cg = await a.cartGet(ctx);
    log(
      'cartGet',
      cg.kind === 'ok' && (cg.value.lines.length > 0 || merchant.adapterType === 'dom'),
    );

    // 5. cartUpdate
    if (cg.kind === 'ok' && cg.value.lines[0]) {
      const cu = await a.cartUpdate(ctx, cg.value.lines[0].lineId, 2);
      log('cartUpdate', cu.kind === 'ok' || cu.kind === 'unsupported');
    }

    // 6. couponApply (failure tolerated)
    const coupon = process.env.SMOKE_COUPON ?? 'TESTNONE';
    const cp = await a.couponApply(ctx, coupon);
    log(`couponApply(${coupon})`, true, cp.kind);

    // 7. checkoutUrl
    const ch = await a.checkoutUrl(ctx);
    log('checkoutUrl', ch.kind === 'ok', ch.kind === 'ok' ? ch.value : ch.kind);

    return 0;
  } finally {
    if (harnessStop) await harnessStop();
  }
}
