import { describe, expect, it } from 'vitest';
import { PERSONAS } from './persona-table.js';
import { buildVoiceSystemInstruction } from './voice-instructions.js';

describe('buildVoiceSystemInstruction', () => {
  it('always includes the no-numeric-prices rule', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!);
    expect(out).toMatch(/never speak numeric prices/i);
    expect(out).toMatch(/paraphrase/i);
  });

  it('includes the persona voice descriptor verbatim', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.coach!);
    expect(out).toContain(PERSONAS.coach!.voiceDescriptor);
  });

  it('includes a "Voice cadence" line', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.stylist!);
    expect(out).toMatch(/voice cadence/i);
  });

  it('demo mode tells the voice model not to recite tool names and to answer pricing in voice', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!, undefined, { demoMode: true });
    expect(out).toContain('VOICE MODE PRICING + TOOLS');
    expect(out).toMatch(/never speak tool names/i);
    expect(out).toMatch(/do not redirect.*chat/i);
    expect(out).not.toContain('site.navigate({');
    expect(out).not.toContain('TOUR TOOLS');
  });
});
