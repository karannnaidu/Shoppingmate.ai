import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ mod: 'voice-metrics' });

export type LedgerEntry = {
  sessionId: string;
  merchantId: string;
  counters: Record<string, number>;
  flushedAt: number;
};

export type MetricsLedger = {
  add: (counter: string, value: number) => void;
  flush: () => void;
};

export function createMetricsLedger(opts: {
  sessionId: string;
  merchantId: string;
  sink: (e: LedgerEntry) => void;
  now?: () => number;
}): MetricsLedger {
  const counters: Record<string, number> = {};
  let flushed = false;
  const now = opts.now ?? (() => Date.now());
  return {
    add(counter, value) {
      counters[counter] = (counters[counter] ?? 0) + value;
    },
    flush() {
      if (flushed) return;
      flushed = true;
      opts.sink({
        sessionId: opts.sessionId,
        merchantId: opts.merchantId,
        counters,
        flushedAt: now(),
      });
    },
  };
}

export function defaultSink(entry: LedgerEntry): void {
  log.info(entry, 'voice-metrics flush');
}
