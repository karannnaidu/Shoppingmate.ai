import { describe, expect, it } from 'vitest';
import { DEFAULT_PERSONA, PERSONAS, lookupPersona } from './persona-table.js';

describe('PERSONAS — Gemini voice mapping (Plan 6 Phase B)', () => {
  it('every persona has a non-empty geminiVoiceId', () => {
    for (const [id, persona] of Object.entries(PERSONAS)) {
      expect(persona.geminiVoiceId, `persona ${id} missing geminiVoiceId`).toBeTruthy();
      expect(typeof persona.geminiVoiceId).toBe('string');
      expect(persona.geminiVoiceId.length).toBeGreaterThan(0);
    }
  });

  it('every persona has a non-empty voiceDescriptor', () => {
    for (const [id, persona] of Object.entries(PERSONAS)) {
      expect(persona.voiceDescriptor, `persona ${id} missing voiceDescriptor`).toBeTruthy();
    }
  });

  it('exactly 8 personas defined', () => {
    expect(Object.keys(PERSONAS).length).toBe(8);
  });

  it('lookupPersona falls back to DEFAULT_PERSONA on unknown', () => {
    const p = lookupPersona('does-not-exist');
    expect(p).toBe(DEFAULT_PERSONA);
    expect(p.geminiVoiceId).toBeTruthy();
  });
});
