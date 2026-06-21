import { buildVoiceSystemInstruction, lookupPersona } from '@shoppingmate/agent';

export type VoiceContext = {
  personaId: string;
  voiceId: string;
  systemInstruction: string;
};

export type VoiceBrandContext = {
  name: string | null;
  domain: string;
};

export type VoiceContextOpts = {
  kbText?: string;
  demoMode?: boolean;
  brandSummary?: string;
  brandCategories?: string[];
  /** Compact returning-visitor brief (from buildVisitorSummary). Threaded into
   *  buildVoiceSystemInstruction's opts; empty/omitted for first-time visitors. */
  visitorSummary?: string;
  /** Data-driven brand selling-playbook (from loadBrandPlaybook). Spread into
   *  buildVoiceSystemInstruction's opts; omitted when the brand has no playbook. */
  brandPlaybook?: string;
};

export function resolveVoiceContext(
  personaId: string | null | undefined,
  brand?: VoiceBrandContext,
  opts: VoiceContextOpts = {},
): VoiceContext {
  const persona = lookupPersona(personaId);
  return {
    personaId: persona.id,
    voiceId: persona.geminiVoiceId,
    systemInstruction: buildVoiceSystemInstruction(
      persona,
      {
        name: brand?.name ?? brand?.domain ?? '',
        domain: brand?.domain ?? '',
      },
      opts,
    ),
  };
}
