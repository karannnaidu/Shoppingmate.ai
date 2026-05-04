import { buildVoiceSystemInstruction, lookupPersona } from '@shoppingmate/agent';

export type VoiceContext = {
  personaId: string;
  voiceId: string;
  systemInstruction: string;
};

export function resolveVoiceContext(personaId: string | null | undefined): VoiceContext {
  const persona = lookupPersona(personaId);
  return {
    personaId: persona.id,
    voiceId: persona.geminiVoiceId,
    systemInstruction: buildVoiceSystemInstruction(persona),
  };
}
