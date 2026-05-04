import { describe, expect, it, vi } from 'vitest';
import { createSessionCaps } from './caps.js';

describe('createSessionCaps', () => {
  it('warns at 13 turns, trips at 16', () => {
    const onWarn = vi.fn();
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn, onTrip, now: () => 0 });
    for (let i = 1; i <= 12; i++) caps.recordTurn();
    expect(onWarn).not.toHaveBeenCalled();
    caps.recordTurn(); // 13
    expect(onWarn).toHaveBeenCalledWith({ cap: 'turns', remaining: 3 });
    caps.recordTurn(); // 14
    caps.recordTurn(); // 15
    expect(onTrip).not.toHaveBeenCalled();
    caps.recordTurn(); // 16
    expect(onTrip).toHaveBeenCalledWith({ cap: 'turns' });
  });

  it('trips on 3 minutes cumulative voice (180 s)', () => {
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn: vi.fn(), onTrip, now: () => 0 });
    caps.recordVoiceSeconds(120);
    expect(onTrip).not.toHaveBeenCalled();
    caps.recordVoiceSeconds(60);
    expect(onTrip).toHaveBeenCalledWith({ cap: 'voice_seconds' });
  });

  it('trips on 25 minutes wall-clock (1500 s)', () => {
    let now = 1_000_000;
    const onTrip = vi.fn();
    const caps = createSessionCaps({ onWarn: vi.fn(), onTrip, now: () => now });
    caps.start();
    now += 1499 * 1000;
    caps.tick();
    expect(onTrip).not.toHaveBeenCalled();
    now += 2 * 1000;
    caps.tick();
    expect(onTrip).toHaveBeenCalledWith({ cap: 'wall_clock' });
  });
});
