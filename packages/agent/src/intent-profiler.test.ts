import { describe, expect, it, vi } from 'vitest';
import { extractConversationProfile } from './intent-profiler.js';

const facts = { cartAdds: 1, checkoutReached: false, purchased: false, mode: 'voice' as const };

describe('extractConversationProfile', () => {
  it('parses the model JSON into a validated record', async () => {
    const chat = vi.fn().mockResolvedValue({
      text: `{"intent":"ready_to_buy","intentConfidence":0.8,"needs":["sleep"],"objections":["price"],
        "preferences":{"products":["sleep-mantra"]},"affect":{"sentiment":"positive"},
        "identity":{"name":"Karan","city":"Bangalore"},"dropStage":null}`,
    });
    const r = await extractConversationProfile('Visitor: I need help sleeping ...', facts, chat);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.intent).toBe('ready_to_buy');
      expect(r.record.needs).toContain('sleep');
      expect(r.record.identity.name).toBe('Karan');
    }
  });

  it('falls back to a safe empty record when the model output is unparseable', async () => {
    const chat = vi.fn().mockResolvedValue({ text: 'sorry' });
    const r = await extractConversationProfile('x', facts, chat);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.record.intent).toBe('browsing');
  });

  it('coerces an unknown intent to browsing', async () => {
    const chat = vi.fn().mockResolvedValue({ text: `{"intent":"banana"}` });
    const r = await extractConversationProfile('x', facts, chat);
    expect(r.ok && r.record.intent).toBe('browsing');
  });
});
