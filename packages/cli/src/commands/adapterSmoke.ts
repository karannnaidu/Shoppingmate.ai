import { type AdapterContext, getAdapter } from '@shoppingmate/adapters';
import { db, schema } from '@shoppingmate/db';
import { eq } from 'drizzle-orm';

export async function adapterSmoke(merchantId: string): Promise<number> {
  const [merchant] = await db
    .select()
    .from(schema.merchants)
    .where(eq(schema.merchants.id, merchantId))
    .limit(1);
  if (!merchant) {
    console.error(`merchant ${merchantId} not found`);
    return 1;
  }
  const a = getAdapter(merchant);
  let ctx: AdapterContext = {
    merchant,
    cartToken: null,
    sessionId: `smoke-${Date.now()}`,
  };
  const log = (label: string, ok: boolean, extra?: string): void => {
    console.log(`${ok ? '[OK]' : '[FAIL]'} ${label}${extra ? ` — ${extra}` : ''}`);
  };

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
  log('cartGet', cg.kind === 'ok' && cg.value.lines.length > 0);

  // 5. cartUpdate
  if (cg.kind === 'ok' && cg.value.lines[0]) {
    const cu = await a.cartUpdate(ctx, cg.value.lines[0].lineId, 2);
    log('cartUpdate', cu.kind === 'ok');
  }

  // 6. couponApply (failure tolerated)
  const coupon = process.env.SMOKE_COUPON ?? 'TESTNONE';
  const cp = await a.couponApply(ctx, coupon);
  log(`couponApply(${coupon})`, true, cp.kind);

  // 7. checkoutUrl
  const ch = await a.checkoutUrl(ctx);
  log('checkoutUrl', ch.kind === 'ok', ch.kind === 'ok' ? ch.value : ch.kind);

  return 0;
}
