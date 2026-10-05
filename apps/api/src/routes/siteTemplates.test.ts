import { describe, expect, it, vi } from 'vitest';
import { DRIFT_SESSIONS, handleTemplateSignal } from './siteTemplates.js';

// In-memory stand-in for the few Redis commands the signal handler uses.
function fakeRedis() {
  const sets = new Map<string, Set<string>>();
  const keys = new Set<string>();
  return {
    sadd: vi.fn(async (k: string, v: string) => {
      const s = sets.get(k) ?? new Set<string>();
      s.add(v);
      sets.set(k, s);
      return 1;
    }),
    scard: vi.fn(async (k: string) => sets.get(k)?.size ?? 0),
    expire: vi.fn(async () => 1),
    set: vi.fn(async (k: string) => {
      if (keys.has(k)) return null;
      keys.add(k);
      return 'OK';
    }),
  };
}

const base = { merchantId: 'M1', templateId: 't1', pageType: 'pdp' };

describe('handleTemplateSignal()', () => {
  it('re-scans only after enough DISTINCT sessions report drift, once per cooldown', async () => {
    const redis = fakeRedis();
    const enqueue = vi.fn(async () => {});
    const deps = { redis: redis as never, enqueue };
    // Same session reporting repeatedly never trips it.
    for (let i = 0; i < 5; i++) {
      const r = await handleTemplateSignal(deps, { ...base, kind: 'drift', sessionId: 's1' });
      expect(r.rescanQueued).toBe(false);
    }
    for (let i = 2; i < DRIFT_SESSIONS; i++) {
      await handleTemplateSignal(deps, { ...base, kind: 'drift', sessionId: `s${i}` });
    }
    const tripped = await handleTemplateSignal(deps, { ...base, kind: 'drift', sessionId: 'sX' });
    expect(tripped.rescanQueued).toBe(true);
    expect(enqueue).toHaveBeenCalledWith({ merchantId: 'M1', pageType: 'pdp', trigger: 'drift' });
    // Cooldown: more reports don't enqueue again.
    const again = await handleTemplateSignal(deps, { ...base, kind: 'drift', sessionId: 'sY' });
    expect(again.rescanQueued).toBe(false);
    expect(enqueue).toHaveBeenCalledTimes(1);
  });

  it('two sessions with unverified clicks are enough to re-scan', async () => {
    const enqueue = vi.fn(async () => {});
    const deps = { redis: fakeRedis() as never, enqueue };
    await handleTemplateSignal(deps, { ...base, kind: 'verify', sessionId: 'a' });
    const r = await handleTemplateSignal(deps, { ...base, kind: 'verify', sessionId: 'b' });
    expect(r.rescanQueued).toBe(true);
    expect(enqueue).toHaveBeenCalledWith({ merchantId: 'M1', pageType: 'pdp', trigger: 'verify' });
  });
});
