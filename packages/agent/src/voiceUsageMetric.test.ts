import { describe, expect, it } from 'vitest';
import { VOICE_SECONDS_METRIC, voiceSecondsMetric } from './voiceUsageMetric.js';

describe('voiceSecondsMetric', () => {
  it('builds a metric_events row recording the call duration in seconds', () => {
    const row = voiceSecondsMetric({
      merchantId: 'SM-ABC123',
      durationSec: 128,
      sessionId: 'ws_x',
    });
    expect(row).toEqual({
      merchantId: 'SM-ABC123',
      metricName: VOICE_SECONDS_METRIC,
      value: '128',
      tags: { session_id: 'ws_x' },
    });
  });

  it('rounds fractional seconds and clamps negatives to 0', () => {
    expect(voiceSecondsMetric({ merchantId: 'm', durationSec: 12.6, sessionId: 's' }).value).toBe(
      '13',
    );
    expect(voiceSecondsMetric({ merchantId: 'm', durationSec: -5, sessionId: 's' }).value).toBe(
      '0',
    );
  });

  it('uses the same metric name the usage aggregator reads', () => {
    expect(VOICE_SECONDS_METRIC).toBe('voice.seconds');
  });
});
