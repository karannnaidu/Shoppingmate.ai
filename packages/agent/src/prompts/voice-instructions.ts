import type { Persona } from './persona-table.js';

const NO_PRICE_RULE =
  'Never speak numeric prices, currency amounts, or discount percentages. ' +
  'Always paraphrase ("a few hundred dollars", "a small discount") and refer to what is on screen ("the price you see").';

export function buildVoiceSystemInstruction(persona: Persona): string {
  return [persona.voiceDescriptor, `Voice cadence: ${persona.voiceDescriptor}`, NO_PRICE_RULE].join(
    '\n\n',
  );
}
