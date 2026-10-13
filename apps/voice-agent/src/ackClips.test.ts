import { describe, expect, it } from 'vitest';
import { trimClip } from './ackClips.js';

describe('ack clip trimming', () => {
  it('drops surrounding silence, keeps a little padding, fades the edges', () => {
    const pcm = new Int16Array(24_000); // 1 s
    for (let i = 9_600; i < 14_400; i++) pcm[i] = 5000; // 0.4–0.6 s of sound
    const out = trimClip(pcm);
    expect(out.length).toBeGreaterThan(4_800);
    expect(out.length).toBeLessThan(4_800 + 2 * 24 * 40 + 2);
    expect(out[0]).toBe(0);
    expect(out[out.length - 1]).toBe(0);
  });

  it('caps very long clips', () => {
    const pcm = new Int16Array(24_000 * 3).fill(5000);
    expect(trimClip(pcm, 1100).length).toBeLessThanOrEqual(24 * 1100);
  });
});
