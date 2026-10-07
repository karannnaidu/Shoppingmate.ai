import type { Merchant } from '@shoppingmate/db';
import { afterEach, describe, expect, it } from 'vitest';
import { normalizePhone, validateCaseOpen } from './case.js';
import { buildSystemPrompt } from './prompts/system.js';
import { buildToolSurface, caseCaptureEnabled } from './tools.js';

const ok = {
  type: 'order_tracking',
  summary: 'Order 10259 not delivered, wants tracking',
  details: { order_number: '10259' },
  contact: { name: 'Asha', phone: '98765 43210' },
  consent: true,
};

afterEach(() => {
  delete process.env.CASE_CAPTURE;
});

describe('validateCaseOpen()', () => {
  it('accepts a complete tracking case and normalises the phone', () => {
    const v = validateCaseOpen(ok, '+91');
    expect(v).toMatchObject({
      ok: true,
      value: {
        type: 'order_tracking',
        contactPhone: '+91 9876543210',
        contactName: 'Asha',
        consent: true,
      },
    });
  });

  it('asks for the order number on tracking requests', () => {
    expect(validateCaseOpen({ ...ok, details: {} })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/order number/),
    });
  });

  it('requires a way to reach them, valid formats, and consent', () => {
    expect(validateCaseOpen({ ...ok, contact: {} })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/phone number or email/),
    });
    expect(validateCaseOpen({ ...ok, contact: { phone: '12' } })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/phone/),
    });
    expect(validateCaseOpen({ ...ok, contact: { email: 'not-an-email' } })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/email/),
    });
    expect(validateCaseOpen({ ...ok, consent: false })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/contacted/),
    });
  });

  it('bad reviews are always high urgency; unknown types rejected', () => {
    const v = validateCaseOpen({
      type: 'bad_review',
      summary: 'Product arrived leaking, very upset',
      contact: { email: 'A@B.co' },
      consent: true,
      urgency: 'low',
      sentiment: 'angry',
    });
    expect(v).toMatchObject({
      ok: true,
      value: { urgency: 'high', sentiment: 'angry', contactEmail: 'a@b.co' },
    });
    expect(validateCaseOpen({ ...ok, type: 'refund_now' }).ok).toBe(false);
  });

  it('normalizePhone keeps explicit country codes and rejects junk', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123');
    expect(normalizePhone('9876543210', '')).toBe('9876543210');
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('CASE_CAPTURE flag', () => {
  const m = { id: 'M1', adapterType: 'shopify' } as unknown as Merchant;
  it('adds case.open + the customer-care prompt only when enabled', () => {
    expect(caseCaptureEnabled(m)).toBe(false);
    expect(buildToolSurface(m).map((t) => t.function.name)).not.toContain('case.open');
    expect(buildSystemPrompt(m)).not.toContain('CUSTOMER CARE');
    process.env.CASE_CAPTURE = 'M1';
    expect(buildToolSurface(m).map((t) => t.function.name)).toContain('case.open');
    expect(buildSystemPrompt(m)).toContain('CUSTOMER CARE');
  });
});

describe('service site without a catalog', () => {
  it('gets no product/cart/checkout tools, keeps case.open', () => {
    process.env.CASE_CAPTURE = '*';
    const m = { id: 'M2', adapterType: 'dom', adapterConfig: { catalog: 'none' }, siteGraphEnabled: true, domain: 'clinic.example' } as unknown as Merchant;
    const names = buildToolSurface(m).map((t) => t.function.name);
    expect(names.some((n) => n.startsWith('products.') || n.startsWith('cart.') || n.startsWith('checkout.'))).toBe(false);
    expect(names).toContain('case.open');
    expect(names).toContain('site.navigate');
  });
});
