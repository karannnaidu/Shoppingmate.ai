import { describe, expect, it, vi } from 'vitest';
import { createSessionCaps } from './caps.js';

describe('createSessionCaps', () => {
  it('warns at 26 turns, trips at 30', () => {
    const onWarn = vi.fn();
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn, onTrip, now: () => 0 });
    for (let i = 1; i <= 25; i++) caps.recordTurn();
    expect(onWarn).not.toHaveBeenCalled();
    caps.recordTurn(); // 26
    expect(onWarn).toHaveBeenCalledWith({ cap: 'turns', remaining: 4 });
    for (let i = 27; i <= 29; i++) caps.recordTurn();
    expect(onTrip).not.toHaveBeenCalled();
    caps.recordTurn(); // 30
    expect(onTrip).toHaveBeenCalledWith({ cap: 'turns' });
  });

  it('trips on 6 minutes cumulative voice (360 s)', () => {
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn: vi.fn(), onTrip, now: () => 0 });
    caps.recordVoiceSeconds(300);
    expect(onTrip).not.toHaveBeenCalled();
    caps.recordVoiceSeconds(60);
    expect(onTrip).toHaveBeenCalledWith({ cap: 'voice_seconds' });
  });

  it('trips on 30 minutes wall-clock (1800 s)', () => {
    let now = 1_000_000;
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn: vi.fn(), onTrip, now: () => now });
    caps.start();
    now += 1799 * 1000;
    caps.tick();
    expect(onTrip).not.toHaveBeenCalled();
    now += 2 * 1000;
    caps.tick();
    expect(onTrip).toHaveBeenCalledWith({ cap: 'wall_clock' });
  });
});
