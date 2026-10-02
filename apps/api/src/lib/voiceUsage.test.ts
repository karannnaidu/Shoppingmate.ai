import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mutable stand-in for the aggregation query result. getVoiceMinutesThisMonth
// does `db.select(...).from(...).where(...)` and awaits the final where(), so
// the mock resolves that to `rows`.
let rows: Array<{ seconds: string | number | null }> = [];

vi.mock('@shoppingmate/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => rows,
      }),
    }),
  },
  schema: {
    metricEvents: {
      merchantId: 'merchant_id',
      metricName: 'metric_name',
      value: 'value',
      ts: 'ts',
    },
  },
}));

const { getVoiceMinutesThisMonth, startOfMonthUtc } = await import('./voiceUsage.js');

describe('startOfMonthUtc', () => {
  it('returns midnight on the first of the given month in UTC', () => {
    const d = startOfMonthUtc(new Date('2026-10-02T17:22:17.643Z'));
    expect(d.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
});

describe('getVoiceMinutesThisMonth', () => {
  beforeEach(() => {
    rows = [];
  });

  it('converts summed voice-seconds to whole minutes (floored)', async () => {
    rows = [{ seconds: '930' }]; // 15.5 min
    expect(await getVoiceMinutesThisMonth('SM-ABC123')).toBe(15);
  });

  it('returns 0 when the merchant has no voice usage this month', async () => {
    rows = [{ seconds: '0' }];
    expect(await getVoiceMinutesThisMonth('SM-ABC123')).toBe(0);
  });

  it('returns 0 when the aggregate is null/absent', async () => {
    rows = [{ seconds: null }];
    expect(await getVoiceMinutesThisMonth('SM-ABC123')).toBe(0);
    rows = [];
    expect(await getVoiceMinutesThisMonth('SM-ABC123')).toBe(0);
  });
});
