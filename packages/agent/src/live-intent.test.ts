import type { Merchant } from '@shoppingmate/db';
import { afterEach, describe, expect, it } from 'vitest';
import { classifyLiveSignal, nextNudge, quickMode, signalSteerLine } from './live-signal.js';
import { buildSystemPrompt } from './prompts/system.js';

// Nav PRD Phase 5 — live intent + adaptive behaviour.

afterEach(() => {
  delete process.env.LIVE_INTENT;
});

describe('quickMode() — same-turn cues', () => {
  it.each([
    ['my bottle arrived broken and leaking', 'complaint'],
    ['this is the worst product, I want a refund', 'complaint'],
    ['where is my order 10259?', 'support'],
    ['can you track my delivery', 'support'],
    ["ok I'll take it, checkout please", 'buy'],
  ])('%s → %s', (text, mode) => {
    expect(quickMode(text)?.mode).toBe(mode);
  });

  it('stays quiet on ordinary browsing', () => {
    expect(quickMode('what helps with sleep?')).toBeNull();
    expect(quickMode('tell me about green mantra')).toBeNull();
  });
});

describe('classifier + steer line', () => {
  it('parses mode + sentiment and keeps an unhappy low-urgency visitor visible', async () => {
    const sig = await classifyLiveSignal('user: it broke', async () => ({
      text: '{"intent":"support","urgency":"low","objection":null,"need":null,"mode":"complaint","sentiment":"angry"}',
    }));
    expect(sig).toMatchObject({ mode: 'complaint', sentiment: 'angry' });
    expect(signalSteerLine(sig)).toBe(
      'mode=complaint · intent=support · urgency=low · sentiment=angry',
    );
  });

  it('ignores unknown modes and stays backward compatible', async () => {
    const sig = await classifyLiveSignal('user: hi', async () => ({
      text: '{"intent":"browsing","urgency":"low","mode":"party"}',
    }));
    expect(sig.mode).toBeUndefined();
    expect(signalSteerLine(sig)).toBe('');
  });

  it('never nudges an unhappy visitor toward a sale', () => {
    const line = nextNudge(
      {
        intent: 'ready_to_buy',
        urgency: 'high',
        objection: null,
        need: null,
        mode: 'complaint',
        sentiment: 'angry',
      },
      10,
      { lastNudgeTurn: 0 },
    );
    expect(line).toMatch(/do not sell/);
  });
});

describe('ADAPT prompt block', () => {
  const calmosis = {
    id: 'SM-2SCCLZ',
    adapterType: 'dom',
    siteGraphEnabled: true,
  } as unknown as Merchant;
  it('is added only with LIVE_INTENT and comes after the selling rules', () => {
    expect(buildSystemPrompt(calmosis)).not.toContain('ADAPT TO THE VISITOR');
    process.env.LIVE_INTENT = '*';
    const p = buildSystemPrompt(calmosis);
    expect(p).toContain('ADAPT TO THE VISITOR');
    expect(p.indexOf('ADAPT TO THE VISITOR')).toBeGreaterThan(p.indexOf('UPSELL gently'));
  });
});
