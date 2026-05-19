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

  it('demo mode tells the voice model it cannot drive the browser and not to recite tool names', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!, undefined, { demoMode: true });
    expect(out).toContain('PRICING IN VOICE MODE');
    expect(out).toMatch(/cannot drive/i);
    expect(out).not.toContain('site.navigate({');
    expect(out).not.toContain('TOUR TOOLS');
  });
});
