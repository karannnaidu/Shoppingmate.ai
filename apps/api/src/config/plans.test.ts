import { describe, expect, it } from 'vitest';
import { getVoiceMinuteCap } from './plans.js';

describe('getVoiceMinuteCap', () => {
  it('returns the monthly voice-minute cap for each known plan', () => {
    expect(getVoiceMinuteCap('starter')).toBe(200);
    expect(getVoiceMinuteCap('growth')).toBe(800);
    expect(getVoiceMinuteCap('scale')).toBe(2600);
  });

  it('is case-insensitive on the plan name', () => {
    expect(getVoiceMinuteCap('Growth')).toBe(800);
    expect(getVoiceMinuteCap('SCALE')).toBe(2600);
  });

  it('falls back to the starter cap for an unknown, null, or undefined plan', () => {
    expect(getVoiceMinuteCap('enterprise')).toBe(200);
    expect(getVoiceMinuteCap(null)).toBe(200);
    expect(getVoiceMinuteCap(undefined)).toBe(200);
  });
});
