import { describe, expect, it } from 'vitest';
import { createTurnDetector } from './turnDetector.js';

// 40 ms frames of 16 kHz PCM16 at a constant level (sine-ish square wave).
const frame = (level: number, ms = 40) => {
  const n = (16_000 * ms) / 1000;
  const s = new Int16Array(n);
  for (let i = 0; i < n; i++) s[i] = i % 2 === 0 ? level : -level;
  return new Uint8Array(s.buffer);
};

function harness(opts: Partial<Parameters<typeof createTurnDetector>[0]> = {}) {
  const events: string[] = [];
  let sent = 0;
  let botSpeaking = false;
  const d = createTurnDetector({
    onStart: (preroll) => {
      events.push(`start(${preroll.length})`);
      sent += preroll.length;
    },
    onAudio: () => {
      sent++;
    },
    onEnd: (reason) => events.push(`end:${reason}`),
    isBotSpeaking: () => botSpeaking,
    ...opts,
  });
  const feed = (level: number, ms: number) => {
    for (let t = 0; t < ms; t += 40) d.push(frame(level));
  };
  return { d, events, feed, sentFrames: () => sent, setBot: (b: boolean) => (botSpeaking = b) };
}

describe('turnDetector', () => {
  it('starts after ~80ms of speech with pre-roll, ends after the silence window', () => {
    const h = harness({ endSilenceMs: 480 });
    h.feed(0, 400); // gated silence (true zeros)
    h.feed(3000, 600); // "hello there"
    expect(h.events[0]).toMatch(/^start\(\d+\)$/);
    // pre-roll includes the ~300ms before speech + the start frames
    const pre = Number(/start\((\d+)\)/.exec(h.events[0]!)![1]);
    expect(pre).toBeGreaterThanOrEqual(8);
    h.feed(0, 400);
    expect(h.events).toHaveLength(1); // a 400ms pause is still the same turn
    h.feed(0, 200);
    expect(h.events).toEqual([h.events[0], 'end:silence']);
  });

  it('keeps one turn across a short mid-sentence pause', () => {
    const h = harness({ endSilenceMs: 500 });
    h.feed(3000, 800);
    h.feed(0, 320);
    h.feed(3000, 800);
    h.feed(0, 600);
    expect(h.events.filter((e) => e.startsWith('start'))).toHaveLength(1);
    expect(h.events.at(-1)).toBe('end:silence');
  });

  it('ignores a single click / short blip', () => {
    const h = harness();
    h.feed(0, 400);
    h.feed(5000, 40);
    h.feed(0, 2000);
    expect(h.events).toEqual([]);
  });

  it('does not treat steady room noise as speech (adaptive floor)', () => {
    const h = harness();
    h.feed(400, 200); // noise from the very first frame
    h.feed(400, 6000);
    // noise may open one turn before the floor adapts, but it must close and not reopen
    const starts = h.events.filter((e) => e.startsWith('start')).length;
    expect(starts).toBeLessThanOrEqual(1);
    h.feed(400, 4000);
    expect(h.events.filter((e) => e.startsWith('start')).length).toBe(starts);
    // speech well above the noise still opens a turn
    h.feed(4000, 400);
    expect(h.events.filter((e) => e.startsWith('start')).length).toBe(starts + 1);
  });

  it('needs louder input to start while Olivia is speaking (echo guard)', () => {
    const h = harness();
    h.feed(0, 400);
    h.setBot(true);
    h.feed(500, 600); // faint echo of her voice
    expect(h.events).toEqual([]);
    h.feed(4000, 300); // the visitor barges in properly
    expect(h.events[0]).toMatch(/^start/);
  });

  it('dictation gets a longer pause window', () => {
    const h = harness({ endSilenceMs: 500 });
    h.d.setEndSilenceMs(900);
    h.feed(3000, 600);
    h.feed(0, 720); // a pause between digit groups
    expect(h.events.filter((e) => e.startsWith('end'))).toHaveLength(0);
    h.feed(0, 240);
    expect(h.events.at(-1)).toBe('end:silence');
    h.d.setEndSilenceMs(0); // back to the default
    h.feed(3000, 400);
    h.feed(0, 520);
    expect(h.events.filter((e) => e === 'end:silence')).toHaveLength(2);
  });

  it('caps a runaway turn', () => {
    const h = harness({ maxTurnMs: 2000 });
    h.feed(3000, 3000);
    expect(h.events).toContain('end:max');
  });

  it('reset() drops an open turn without ending it', () => {
    const h = harness();
    h.feed(3000, 400);
    h.d.reset();
    h.feed(0, 1000);
    expect(h.events).toEqual([h.events[0]]);
    expect(h.d.active()).toBe(false);
  });
});
