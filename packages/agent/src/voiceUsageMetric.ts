/**
 * Canonical metric name for per-call voice duration, written at session end by
 * the voice worker and summed month-to-date by the API's voice-minute cap gate
 * (apps/api/src/lib/voiceUsage.ts). Keep writer and reader on this one constant
 * so they can never drift.
 */
export const VOICE_SECONDS_METRIC = 'voice.seconds';

/**
 * Build the `metric_events` row that records a finished voice call's duration
 * (whole seconds). `value` is a string because the column is Postgres numeric.
 */
export function voiceSecondsMetric(args: {
  merchantId: string;
  durationSec: number;
  sessionId: string;
}): { merchantId: string; metricName: string; value: string; tags: { session_id: string } } {
  return {
    merchantId: args.merchantId,
    metricName: VOICE_SECONDS_METRIC,
    value: String(Math.max(0, Math.round(args.durationSec))),
    tags: { session_id: args.sessionId },
  };
}
