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
    expect(p).toMatch(/bliss club/i); // membership awareness (bliss-club)
    expect(p).toMatch(/one or more products/i); // multi-product allowed
    expect(p).not.toMatch(/one product per order/i);
    expect(p).toMatch(/₹250|cash on delivery/i);
    // Must NOT carry the "you cannot add to cart" lie-guard (Calmosis CAN add now).
    expect(p).not.toMatch(/cannot add .*cart/i);
  });

  it('explains Bliss Club fully and correctly (10% not 20%, real benefits, ₹299/6mo)', () => {
    const p = buildSystemPrompt(calmosis);
    // Authoritative benefits — the bot must be able to actually describe it.
    expect(p).toMatch(/10%/);
    expect(p).toMatch(/free delivery/i);
    expect(p).toMatch(/early access/i);
    expect(p).toMatch(/retreat/i);
    expect(p).toMatch(/299/);
    expect(p).toMatch(/6 months/i);
    // The discount is 10% — the old 20% plan is gone; never quote 20%.
    expect(p).not.toMatch(/20\s*%/);
  });

  it('shows the Bliss Club card via products.get (now in the catalog)', () => {
    const p = buildSystemPrompt(calmosis);
    // bliss-club now has a product card; the bot brings it up like any product.
    expect(p).toMatch(/bliss club now has a product card/i);
    expect(p).toMatch(/products\.get\(\{\s*sku:\s*["']bliss-club["']/);
  });

  it('tells the bot to enroll via cart.add({sku:"bliss-club"})', () => {
    const p = buildSystemPrompt(calmosis);
    // Bliss Club is added with cart.add (correct backend-matching attributes),
    // not a fragile page.click on a membership button (multiple controls + a
    // colliding "Join The Bliss Club" heading made the click unreliable).
    expect(p).toMatch(/cart\.add\(\{\s*sku:\s*["']bliss-club["']/);
  });

  it('includes the consultation intake flow and the consultation.request tool', () => {
    const p = buildSystemPrompt(calmosis);
    expect(p).toMatch(/DOCTOR CONSULTATION/);
    expect(p).toMatch(/consultation\.request/);
    expect(p).toMatch(/10 digits/i);
    expect(p).toMatch(/\+91/);
  });

  it('forbids speaking tool/function syntax', () => {
    const p = buildSystemPrompt(calmosis);
    expect(p).toMatch(/never speak tool names/i);
  });

  it('has cart-accuracy guardrails (no wrong/extra adds, read back the cart)', () => {
    const p = buildSystemPrompt(calmosis);
    expect(p).toMatch(/CART ACCURACY/);
    expect(p).toMatch(/read back/i);
  });

  it('opens proactively, leads the conversation, upsells, and offers coupons', () => {
    const p = buildSystemPrompt(calmosis);
    expect(p).toMatch(/OPENING/);
    expect(p).toMatch(/LEAD THE CONVERSATION/i);
    expect(p).toMatch(/upsell/i);
    expect(p).toMatch(/COUPONS/);
  });

  it('drives Calmosis checkout via the brand hooks (state → fill → place), not page.fill', () => {
    const p = buildSystemPrompt(calmosis);
    // Reliable flow: checkout.state → navigate → checkout.fill (animated) → confirm → checkout.place.
    expect(p).toMatch(/checkout\.state/);
    expect(p).toMatch(/checkout\.fill/);
    expect(p).toMatch(/checkout\.place/);
    // Must steer AWAY from the brittle generic DOM flow for Calmosis checkout.
    expect(p).toMatch(/never page\.fill \/ page\.click here/i);
  });

  it('confirms the order with the visitor BEFORE placing it (checkout.place)', () => {
    const p = buildSystemPrompt(calmosis);
    expect(p).toMatch(/ONLY after an explicit yes, call checkout\.place/i);
    expect(p).toMatch(/never call checkout\.place before checkout\.fill has succeeded/i);
  });

  it('tells the bot to always use the visitor’s latest corrected value', () => {
    const p = buildSystemPrompt(calmosis);
    expect(p).toMatch(/CORRECTIONS/i);
    expect(p).toMatch(/LATEST value/i);
    expect(p).toMatch(/never place an order with a value the visitor has just changed/i);
  });

  it('keeps checkout.fill validation enforced + does not loop on a missing field', () => {
    const p = buildSystemPrompt(calmosis);
    expect(p).toMatch(/VALIDATION IS ENFORCED/i);
    expect(p).toMatch(/checkout\.fill REJECTS/i);
    expect(p).toMatch(/DON'T GET STUCK/i);
  });
});

describe('RETURNING VISITOR section', () => {
  it('injects the visitor summary when visitorSummaryText is provided', () => {
    const p = buildSystemPrompt(merchant, {
      visitorSummaryText: 'Karan from Mumbai (visit #3).',
    });
    expect(p).toContain('RETURNING VISITOR');
    expect(p).toContain('Karan from Mumbai (visit #3).');
  });

  it('omits the RETURNING VISITOR section for first-time visitors (no summary)', () => {
    const p = buildSystemPrompt(merchant);
    expect(p).not.toContain('RETURNING VISITOR');
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
