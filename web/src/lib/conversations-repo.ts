import { db } from './db';
import { metricEvents } from '@shoppingmate/db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';

export type ConversationRow = {
  id: string;
  startedAt: Date;
  durationSec: number;
  turns: number;
  mode: 'voice' | 'text';
  outcome: 'purchased' | 'abandoned' | 'in_progress';
  attributedCents: number | null;
};

export async function recentConversations(args: { merchantId: string; limit?: number }): Promise<ConversationRow[]> {
  const limit = args.limit ?? 20;
  const rows = await db
    .select({
      id: sql<string>`(${metricEvents.tags}->>'session_id')`,
      startedAt: metricEvents.ts,
      durationSec: sql<number>`coalesce((${metricEvents.tags}->>'duration_sec')::int, 0)`,
      turns: sql<number>`coalesce((${metricEvents.tags}->>'turns')::int, 0)`,
      mode: sql<'voice' | 'text'>`coalesce(${metricEvents.tags}->>'mode', 'text')`,
      outcome: sql<'purchased' | 'abandoned' | 'in_progress'>`coalesce(${metricEvents.tags}->>'outcome', 'in_progress')`,
      attributedCents: sql<number | null>`nullif((${metricEvents.tags}->>'attributed_cents'), '')::int`,
    })
    .from(metricEvents)
    .where(and(eq(metricEvents.merchantId, args.merchantId), eq(metricEvents.metricName, 'conversationCompleted')))
    .orderBy(desc(metricEvents.ts))
    .limit(limit);

  return rows;
}

export type ListFilters = {
  merchantId: string;
  outcome?: 'purchased' | 'abandoned';
  mode?: 'voice' | 'text';
  hasAttributedSale?: boolean;
  search?: string;
  cursorRecordedAt?: Date;
  limit?: number;
};

export async function listConversations(filters: ListFilters): Promise<ConversationRow[]> {
  const limit = filters.limit ?? 50;
  const conditions = [
    eq(metricEvents.merchantId, filters.merchantId),
    eq(metricEvents.metricName, 'conversationCompleted'),
  ];
  if (filters.outcome) conditions.push(sql`${metricEvents.tags}->>'outcome' = ${filters.outcome}`);
  if (filters.mode) conditions.push(sql`${metricEvents.tags}->>'mode' = ${filters.mode}`);
  if (filters.hasAttributedSale) conditions.push(sql`(${metricEvents.tags}->>'attributed_cents')::int > 0`);
  if (filters.cursorRecordedAt) conditions.push(sql`${metricEvents.ts} < ${filters.cursorRecordedAt}`);

  const rows = await db
    .select({
      id: sql<string>`(${metricEvents.tags}->>'session_id')`,
      startedAt: metricEvents.ts,
      durationSec: sql<number>`coalesce((${metricEvents.tags}->>'duration_sec')::int, 0)`,
      turns: sql<number>`coalesce((${metricEvents.tags}->>'turns')::int, 0)`,
      mode: sql<'voice' | 'text'>`coalesce(${metricEvents.tags}->>'mode', 'text')`,
      outcome: sql<'purchased' | 'abandoned' | 'in_progress'>`coalesce(${metricEvents.tags}->>'outcome', 'in_progress')`,
      attributedCents: sql<number | null>`nullif((${metricEvents.tags}->>'attributed_cents'), '')::int`,
    })
    .from(metricEvents)
    .where(and(...conditions))
    .orderBy(desc(metricEvents.ts))
    .limit(limit);

  return rows;
}

export type ConversationDetail = {
  id: string;
  startedAt: Date;
  durationSec: number;
  turns: number;
  mode: 'voice' | 'text';
  outcome: 'purchased' | 'abandoned' | 'in_progress';
  attributedCents: number | null;
  transcript: Array<{ role: 'user' | 'agent' | 'tool' | 'card'; content: string; timestamp: number }>;
  llmCostCents: number;
  voiceCostCents: number;
  intent?: {
    intent: string;
    intentConfidence: number;
    needs: string[];
    objections: string[];
    identity: Record<string, unknown>;
    dropStage: string | null;
  };
};

export async function getConversation(args: { merchantId: string; sessionId: string }): Promise<ConversationDetail | null> {
  const rows = await db
    .select()
    .from(metricEvents)
    .where(and(
      eq(metricEvents.merchantId, args.merchantId),
      eq(metricEvents.metricName, 'conversationCompleted'),
      sql`${metricEvents.tags}->>'session_id' = ${args.sessionId}`,
    ))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  const t = (row.tags ?? {}) as Record<string, unknown>;
  const attributed = t.attributed_cents;
  const rawIntent = t.intent;
  const intent =
    rawIntent && typeof rawIntent === 'object' && !Array.isArray(rawIntent)
      ? (() => {
          const i = rawIntent as Record<string, unknown>;
          return {
            intent: String(i.intent ?? ''),
            intentConfidence: Number(i.intentConfidence ?? 0),
            needs: Array.isArray(i.needs) ? (i.needs as string[]) : [],
            objections: Array.isArray(i.objections) ? (i.objections as string[]) : [],
            identity:
              i.identity && typeof i.identity === 'object' && !Array.isArray(i.identity)
                ? (i.identity as Record<string, unknown>)
                : {},
            dropStage: i.dropStage != null ? String(i.dropStage) : null,
          };
        })()
      : undefined;
  return {
    id: args.sessionId,
    startedAt: row.ts,
    durationSec: Number(t.duration_sec ?? 0),
    turns: Number(t.turns ?? 0),
    mode: (t.mode as 'voice' | 'text') ?? 'text',
    outcome: (t.outcome as 'purchased' | 'abandoned' | 'in_progress') ?? 'in_progress',
    attributedCents: attributed != null && attributed !== '' ? Number(attributed) : null,
    transcript: Array.isArray(t.transcript) ? (t.transcript as ConversationDetail['transcript']) : [],
    llmCostCents: Number(t.llm_cost_cents ?? 0),
    voiceCostCents: Number(t.voice_cost_cents ?? 0),
    intent,
  };
}
