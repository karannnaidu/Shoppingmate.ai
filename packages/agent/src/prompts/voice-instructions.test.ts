import { describe, expect, it } from 'vitest';
import { PERSONAS } from './persona-table.js';
import { buildVoiceSystemInstruction } from './voice-instructions.js';

describe('buildVoiceSystemInstruction', () => {
  it('always includes the no-numeric-prices rule', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!);
    expect(out).toMatch(/never speak numeric prices/i);
    // Regression for 2026-05-24 hallucination: the rule must explicitly tell
    // the model to refer to the on-screen price card instead of "paraphrasing"
    // a number it doesn't know. The old rule's example "a few hundred dollars"
    // was being parroted back as the answer for $30/mo plans.
    expect(out).toMatch(/on screen|price card|card on screen/i);
    expect(out).toMatch(/do not invent|hallucinations/i);
  });

  it('includes the persona voice descriptor verbatim', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.coach!);
    expect(out).toContain(PERSONAS.coach!.voiceDescriptor);
  });

  it('includes a "Voice cadence" line', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.stylist!);
    expect(out).toMatch(/voice cadence/i);
  });

  it('tells the voice model to mirror the visitor\'s language (multilingual)', () => {
    // Regression for 2026-06-08 Calmosis report: native-audio replied in
    // English even when the visitor spoke Hindi/Hinglish because the all-English
    // system prompt biased the model toward English. The instruction must tell
    // the model to detect and reply in the visitor's language and to switch when
    // they switch.
    const out = buildVoiceSystemInstruction(PERSONAS['calmosis-clinician']!, {
      name: 'Calmosis',
      domain: 'calmosis.com',
    });
    expect(out).toMatch(/language/i);
    expect(out).toMatch(/same language|match their language|reply in (that|the same)/i);
    expect(out).toMatch(/switch/i);
  });

  it('demo mode tells the voice model not to recite tool names and to answer pricing in voice', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!, undefined, { demoMode: true });
    expect(out).toContain('VOICE MODE PRICING + TOOLS');
    expect(out).toMatch(/never speak tool names/i);
    expect(out).toMatch(/do not redirect.*chat/i);
    expect(out).not.toContain('site.navigate({');
    expect(out).not.toContain('TOUR TOOLS');
  });

  it('demo mode also mirrors the visitor language and does not force English-only', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!, undefined, { demoMode: true });
    expect(out).toMatch(/same language|match their language|reply in (that|the same)/i);
    expect(out).toMatch(/switch/i);
    // The old "Speak natural conversational English only" line forced English
    // even when the founder spoke another language — must be gone.
    expect(out).not.toMatch(/english only/i);
  });
});
