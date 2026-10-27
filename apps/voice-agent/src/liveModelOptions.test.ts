import { describe, expect, it } from 'vitest';
import { liveModelOptions } from './geminiSdkTransport.js';

describe('liveModelOptions', () => {
  it('2.5 native audio keeps Gemini VAD and thinking off', () => {
    expect(liveModelOptions('gemini-2.5-flash-native-audio-latest', {})).toEqual({
      manualTurns: false,
      thinking: { thinkingBudget: 0 },
    });
  });

  it('3.1 flash live uses our turn detection and no thinking budget (budget 0 stalls it)', () => {
    expect(liveModelOptions('gemini-3.1-flash-live-preview', {})).toEqual({ manualTurns: true, thinking: null });
  });

  it('env overrides both', () => {
    expect(
      liveModelOptions('gemini-3.1-flash-live-preview', { GEMINI_TURN_DETECTION: 'auto', GEMINI_THINKING_BUDGET: '128' }),
    ).toEqual({ manualTurns: false, thinking: { thinkingBudget: 128 } });
    expect(
      liveModelOptions('gemini-2.5-flash-native-audio-latest', { GEMINI_TURN_DETECTION: 'manual', GEMINI_THINKING_BUDGET: 'default' }),
    ).toEqual({ manualTurns: true, thinking: null });
  });
});
