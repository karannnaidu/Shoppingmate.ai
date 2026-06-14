import type { Merchant } from '@shoppingmate/db';
import { describe, expect, it } from 'vitest';
import { BRAND_KB_SLOT, SITE_GRAPH_SLOT, buildSystemPrompt } from './system.js';

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

describe('cart guidance for non-cart-capable (dom) merchants', () => {
  // A generic dom merchant (NOT Calmosis) has no working cart tool.
  const dom = {
    id: 'SM-OTHERDOM', name: 'SomeBrand', domain: 'some.test',
    personaId: 'calm-clinician', adapterType: 'dom', siteGraphEnabled: true,
  } as unknown as Merchant;

  it('tells a generic dom merchant bot it cannot add to cart and must navigate instead', () => {
    const p = buildSystemPrompt(dom);
    expect(p).toMatch(/cannot add .*cart|can.?t add .*cart/i);
    expect(p).toMatch(/add to cart/i);
    expect(p).toMatch(/never (say|claim)[^.]*added/i);
  });

  it('does not add the cannot-add-to-cart block for API-backed merchants', () => {
    const p = buildSystemPrompt(merchant); // shopify
    expect(p).not.toMatch(/cannot add .*cart/i);
  });
});

describe('Calmosis purchase flow (SM-2SCCLZ)', () => {
  const calmosis = {
    id: 'SM-2SCCLZ', name: 'Calmosis', domain: 'calmosis.com',
    personaId: 'calmosis-clinician', adapterType: 'dom', siteGraphEnabled: true,
  } as unknown as Merchant;

  it('gives Calmosis the real buy flow (cart.add + checkout), not the cannot-add block', () => {
    const p = buildSystemPrompt(calmosis);
    expect(p).toMatch(/BUYING ON CALMOSIS/);
    expect(p).toMatch(/cart\.add/);
    expect(p).toMatch(/one product per order/i);
    expect(p).toMatch(/₹250|cash on delivery/i);
    // Must NOT carry the "you cannot add to cart" lie-guard (Calmosis CAN add now).
    expect(p).not.toMatch(/cannot add .*cart/i);
  });
});

describe('SITE_GRAPH_SLOT injection', () => {
  it('uses raw slot placeholder when siteGraphText is missing', () => {
    const m = {
      id: 'm1', name: 'Acme', domain: 'acme.com', personaId: 'concierge', adapterType: 'shopify',
    } as never;
    const out = buildSystemPrompt(m, {});
    expect(out).toContain(SITE_GRAPH_SLOT);
  });
  it('replaces slot with provided siteGraphText', () => {
    const m = {
      id: 'm1', name: 'Acme', domain: 'acme.com', personaId: 'concierge', adapterType: 'shopify',
    } as never;
    const out = buildSystemPrompt(m, { siteGraphText: 'SITE MAP — pages: /\n  /pricing' });
    expect(out).not.toContain(SITE_GRAPH_SLOT);
    expect(out).toContain('SITE MAP — pages');
  });
});

describe('VISITOR AWARENESS section', () => {
  it('appears in the standard system prompt', () => {
    const p = buildSystemPrompt(merchant);
    expect(p).toContain('VISITOR AWARENESS');
    expect(p).toContain('[VISITOR_CONTEXT]');
  });
  it('appears in the demo system prompt', () => {
    const p = buildSystemPrompt(merchant, { demoMode: true });
    expect(p).toContain('VISITOR AWARENESS');
    expect(p).toContain('[VISITOR_CONTEXT]');
  });
});
