import { describe, expect, it } from 'vitest';
import { stripPrices } from '../postprocess.js';
import { PERSONAS } from './persona-table.js';
import { buildVoiceSystemInstruction } from './voice-instructions.js';

// Defense-in-depth on the no-numeric-prices invariant.
// Layer 1: stripPrices() rewrites "$89.99" → "the price on the card" before any text reaches voice.
// Layer 2: Gemini sysprompt also forbids numerics if anything ever leaks through layer 1.
describe('voice no-numeric-prices defense-in-depth', () => {
  it('stripPrices rewrites $ amounts to a paraphrase before they reach voice agent', () => {
    const sonnetOutput = 'These shoes are $89.99 right now.';
    const { text, hits } = stripPrices(sonnetOutput);
    expect(text).not.toMatch(/\$/);
    expect(text).not.toMatch(/\d/);
    expect(text).toContain('the price on the card');
    expect(hits).toHaveLength(1);
    expect(hits[0]?.pattern).toBe('dollar');
  });

  it('Gemini sysprompt also forbids numerics if any leak through', () => {
    const out = buildVoiceSystemInstruction(PERSONAS.concierge!);
    expect(out).toMatch(/never speak numeric prices/i);
  });
});
