import { and, eq, gte, sql } from 'drizzle-orm';
import { db, schema, upsertBrandPlaybook } from '@shoppingmate/db';
import { aggregateBrandStats, distilBrandPlaybook, type BrandRecord } from '@shoppingmate/agent';
import type { ChatFn } from '@shoppingmate/agent';

type RefreshResult =
  | { ok: true; count: number; playbook: string }
  | { ok: false; reason: 'below_threshold' | 'distil_empty'; count: number };

export async function runPlaybookRefresh(args: {
  merchantId: string;
  chat: ChatFn;
  minConversations?: number;
}): Promise<RefreshResult> {
  const minConversations = args.minConversations ?? 20;
  const since = new Date(Date.now() - 90 * 86400_000);
  const rows = await db
    .select({ tags: schema.metricEvents.tags })
    .from(schema.metricEvents)
    .where(and(
      eq(schema.metricEvents.merchantId, args.merchantId),
      eq(schema.metricEvents.metricName, 'conversationCompleted'),
      gte(schema.metricEvents.ts, since),
      sql`${schema.metricEvents.tags} ? 'intent'`,
    ));
  const records: BrandRecord[] = [];
  const dropStages: string[] = [];
  for (const row of rows) {
    const t = (row.tags ?? {}) as Record<string, unknown>;
    const intent = (t.intent ?? {}) as Record<string, unknown>;
    const outcome = String(t.outcome ?? 'abandoned');
    const prefs = (intent.preferences ?? {}) as Record<string, unknown>;
    records.push({
      intent: typeof intent.intent === 'string' ? intent.intent : null,
      needs: Array.isArray(intent.needs) ? (intent.needs as string[]) : [],
      objections: Array.isArray(intent.objections) ? (intent.objections as string[]) : [],
      outcome,
      couponUsed: Boolean(prefs.coupon),
      attributedCents: Number(t.attributed_cents ?? 0),
    });
    if (outcome === 'abandoned' && typeof intent.dropStage === 'string') dropStages.push(intent.dropStage);
  }
  if (records.length < minConversations) return { ok: false, reason: 'below_threshold', count: records.length };
  const stats = aggregateBrandStats(records, dropStages);
  const playbook = await distilBrandPlaybook(stats, args.chat);
  if (!playbook) return { ok: false, reason: 'distil_empty', count: records.length };
  await upsertBrandPlaybook(args.merchantId, playbook, records.length);
  return { ok: true, count: records.length, playbook };
}
