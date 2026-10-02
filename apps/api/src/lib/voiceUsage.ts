import { VOICE_SECONDS_METRIC } from '@shoppingmate/agent';
import { db, schema } from '@shoppingmate/db';
import { and, eq, gte, sql } from 'drizzle-orm';

/**
 * First instant (UTC) of the calendar month containing `now`.
 *
 * v1 scopes the voice-minute cap to the calendar month. Shopify billing cycles
 * are actually 30-day windows anchored to subscription activation; Phase B will
 * read the real cycle anchor from the subscription. Calendar-month is a close,
 * predictable approximation for the hard cap.
 */
export function startOfMonthUtc(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Month-to-date voice minutes for a merchant, summed from the per-call
 * `voice.seconds` metric events (written at session end by the voice worker),
 * floored to whole minutes. Returns 0 when there is no usage yet.
 */
export async function getVoiceMinutesThisMonth(
  merchantId: string,
  now: Date = new Date(),
): Promise<number> {
  const rows = await db
    .select({ seconds: sql<string>`coalesce(sum(${schema.metricEvents.value}), 0)` })
    .from(schema.metricEvents)
    .where(
      and(
        eq(schema.metricEvents.merchantId, merchantId),
        eq(schema.metricEvents.metricName, VOICE_SECONDS_METRIC),
        gte(schema.metricEvents.ts, startOfMonthUtc(now)),
      ),
    );
  const seconds = Number(rows[0]?.seconds ?? 0);
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.floor(seconds / 60);
}
