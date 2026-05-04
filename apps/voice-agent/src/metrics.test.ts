import { describe, expect, it, vi } from 'vitest';
import { createMetricsLedger } from './metrics.js';

describe('createMetricsLedger', () => {
  it('accumulates per-session counters', () => {
    const sink = vi.fn();
    const ledger = createMetricsLedger({ sessionId: 'ws_x', merchantId: 'SM-X', sink });
    ledger.add('gemini_audio_input_seconds', 12);
    ledger.add('gemini_audio_input_seconds', 8);
    ledger.add('sonnet_input_tokens', 250);
    ledger.flush();
    expect(sink).toHaveBeenCalledOnce();
    const entry = sink.mock.calls[0]![0];
    expect(entry.sessionId).toBe('ws_x');
    expect(entry.counters.gemini_audio_input_seconds).toBe(20);
    expect(entry.counters.sonnet_input_tokens).toBe(250);
    expect(typeof entry.flushedAt).toBe('number');
  });

  it('flush is idempotent — second flush of same session is a no-op', () => {
    const sink = vi.fn();
    const ledger = createMetricsLedger({ sessionId: 'ws_y', merchantId: 'SM-Y', sink });
    ledger.add('a', 1);
    ledger.flush();
    ledger.flush();
    expect(sink).toHaveBeenCalledOnce();
  });
});
