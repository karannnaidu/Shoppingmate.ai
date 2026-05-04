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
});
