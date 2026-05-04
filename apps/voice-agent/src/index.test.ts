import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('voice-agent bootstrap', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('throws if LIVEKIT_URL is missing', async () => {
    const orig = { ...process.env };
    delete process.env.LIVEKIT_URL;
    await expect(import('./index.js')).rejects.toThrow(/LIVEKIT_URL/);
    process.env = orig;
  });
});
