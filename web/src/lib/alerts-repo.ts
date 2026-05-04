import { db } from './db';
import { alerts, type Alert } from '@shoppingmate/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';

export async function getActiveAlert(merchantId: string): Promise<Alert | null> {
  const rows = await db
    .select()
    .from(alerts)
    .where(and(eq(alerts.merchantId, merchantId), isNull(alerts.resolvedAt)))
    .orderBy(desc(alerts.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function resolveAlert(id: string) {
  await db.update(alerts).set({ resolvedAt: new Date() }).where(eq(alerts.id, id));
}

export async function createAlert(args: {
  merchantId: string;
  kind: string;
  severity: string;
  payload: unknown;
}) {
  await db.insert(alerts).values({
    merchantId: args.merchantId,
    kind: args.kind,
    severity: args.severity,
    payload: args.payload as Record<string, unknown>,
  });
}
