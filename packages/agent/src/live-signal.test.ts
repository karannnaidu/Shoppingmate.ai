import { describe, expect, it } from 'vitest';
import {
  classifyLiveSignal,
  nextNudge,
  signalSteerLine,
  type LiveSignal,
  type NudgeState,
} from './live-signal.js';
import type { ChatFn } from './checkout-extract.js';

const chatReturning = (text: string): ChatFn => async () => ({ text });

describe('classifyLiveSignal', () => {
  it('parses a valid JSON object into the LiveSignal fields', async () => {
    const chat = chatReturning(
      'Here you go: {"intent":"ready_to_buy","urgency":"high","objection":"price","need":"Sleep Mantra"} done.',
    );
    const sig = await classifyLiveSignal('user: I want sleep mantra now', chat);
    expect(sig.intent).toBe('ready_to_buy');
    expect(sig.urgency).toBe('high');
    expect(sig.objection).toBe('price');
    expect(sig.need).toBe('Sleep Mantra');
  });

  it('returns an EMPTY low-urgency signal on unparseable text', async () => {
    const chat = chatReturning('I could not classify this, sorry.');
    const sig = await classifyLiveSignal('user: hi', chat);
    expect(sig.intent).toBe('browsing');
    expect(sig.urgency).toBe('low');
    expect(sig.objection).toBeNull();
    expect(sig.need).toBeNull();
  });

  it('returns EMPTY when the chat call throws', async () => {
    const chat: ChatFn = async () => {
      throw new Error('boom');
    };
    const sig = await classifyLiveSignal('user: hi', chat);
    expect(sig).toEqual({ intent: 'browsing', urgency: 'low', objection: null, need: null });
  });

  it('coerces an unknown urgency value to low', async () => {
    const chat = chatReturning('{"intent":"comparing","urgency":"medium-ish","objection":null,"need":null}');
    const sig = await classifyLiveSignal('x', chat);
    expect(sig.urgency).toBe('low');
    expect(sig.intent).toBe('comparing');
  });
});

describe('signalSteerLine', () => {
  it('returns empty string for a low + empty signal', () => {
    const sig: LiveSignal = { intent: 'browsing', urgency: 'low', objection: null, need: null };
    expect(signalSteerLine(sig)).toBe('');
  });

  it('includes objection= when an objection is set', () => {
    const sig: LiveSignal = {
      intent: 'price_check',
      urgency: 'high',
      objection: 'price',
      need: 'Sleep Mantra',
    };
    const line = signalSteerLine(sig);
    expect(line).toContain('objection=price');
    expect(line).toContain('intent=price_check');
    expect(line).toContain('urgency=high');
    expect(line).toContain('wants=Sleep Mantra');
  });
});

describe('nextNudge', () => {
  const base: LiveSignal = {
    intent: 'ready_to_buy',
    urgency: 'high',
    objection: null,
    need: null,
  };

  it('returns null within 3 turns of the last nudge', () => {
    const state: NudgeState = { lastNudgeTurn: 5 };
    expect(nextNudge(base, 7, state)).toBeNull();
  });

  it('returns null when urgency is not high', () => {
    const state: NudgeState = { lastNudgeTurn: 0 };
    const sig: LiveSignal = { ...base, urgency: 'medium' };
    expect(nextNudge(sig, 10, state)).toBeNull();
  });

  it('returns the objection line on high urgency + an objection past the throttle', () => {
    const state: NudgeState = { lastNudgeTurn: 0 };
    const sig: LiveSignal = { ...base, intent: 'price_check', objection: 'delivery_time' };
    const line = nextNudge(sig, 10, state);
    expect(line).not.toBeNull();
    expect(line).toContain('delivery_time');
  });

  it('returns the buy line on high urgency + a ready/buy intent', () => {
    const state: NudgeState = { lastNudgeTurn: 0 };
    const line = nextNudge(base, 10, state);
    expect(line).not.toBeNull();
    expect(line).toMatch(/checkout/i);
  });

  it('returns null on high urgency with no objection and a non-buy intent', () => {
    const state: NudgeState = { lastNudgeTurn: 0 };
    const sig: LiveSignal = { ...base, intent: 'comparing' };
    expect(nextNudge(sig, 10, state)).toBeNull();
  });
});
