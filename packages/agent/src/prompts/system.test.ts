import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { BRAND_KB_SLOT, buildSystemPrompt } from './system.js';

const merchant = {
  id: 'm_1',
  domain: 'acme.test',
  name: 'Acme',
  personaId: 'calm-clinician',
  adapterType: 'shopify',
} as unknown as Merchant;

describe('buildSystemPrompt()', () => {
  it('includes persona name + voice descriptor + brand name', () => {
    const p = buildSystemPrompt(merchant);
    expect(p).toContain('Sage');
    expect(p).toContain('Calm, clinical tone');
    expect(p).toContain('Acme');
  });

  it('includes the SPEAKING RULES no-numeric-prices line', () => {
    const p = buildSystemPrompt(merchant);
    expect(p).toMatch(/NEVER say a numeric price/i);
  });

  it('contains the Phase 2 BRAND_KB_SLOT marker (empty in Phase 1)', () => {
    const p = buildSystemPrompt(merchant);
    expect(p).toContain(BRAND_KB_SLOT);
  });

  it('falls back to concierge persona for unknown personaId', () => {
    const m = { ...merchant, personaId: 'made-up' } as unknown as Merchant;
    const p = buildSystemPrompt(m);
    expect(p).toContain('Olivia'); // concierge default
  });

  it('uses domain when name is null', () => {
    const m = { ...merchant, name: null } as unknown as Merchant;
    const p = buildSystemPrompt(m);
    expect(p).toContain('acme.test');
  });
});
