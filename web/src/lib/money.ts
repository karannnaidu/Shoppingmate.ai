import { conversionEvents, products } from '@shoppingmate/db/schema';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db } from './db';

export { formatMoney } from './format-money';

/** The currency the store sells in: from recorded orders, else its product
 *  catalog (same fallback chain as Store Insights), else USD. */
export async function merchantCurrency(merchantId: string): Promise<string> {
  const order = await db
    .select({ currency: conversionEvents.currency })
    .from(conversionEvents)
    .where(eq(conversionEvents.merchantId, merchantId))
    .orderBy(desc(conversionEvents.occurredAt))
    .limit(1);
  if (order[0]?.currency) return order[0].currency.toUpperCase();
  const product = await db
    .select({ currency: products.currency })
    .from(products)
    .where(and(eq(products.merchantId, merchantId), isNotNull(products.currency)))
    .limit(1);
  return product[0]?.currency?.toUpperCase() || 'USD';
}
