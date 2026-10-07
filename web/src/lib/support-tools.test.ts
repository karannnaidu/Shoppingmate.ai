import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./db', () => ({ db: {} }));
vi.mock('@shoppingmate/db', () => ({ emailTeam: vi.fn() }));

import { isOpsAdmin, validateTicket } from './support-tools';

describe('validateTicket', () => {
  it('accepts a well-formed feature request and defaults priority', () => {
    const v = validateTicket({ kind: 'feature', title: 'Add WhatsApp to customer requests', details: 'so I can reply faster' });
    expect(v).toEqual({ ok: true, value: { kind: 'feature', title: 'Add WhatsApp to customer requests', details: 'so I can reply faster', priority: 'normal' } });
  });
  it('rejects unknown kinds and empty titles with a reason the assistant can relay', () => {
    expect(validateTicket({ kind: 'rant', title: 'whatever happened here' })).toMatchObject({ ok: false });
    expect(validateTicket({ kind: 'bug', title: 'x' })).toMatchObject({ ok: false, reason: expect.stringMatching(/title/) });
  });
});

describe('isOpsAdmin', () => {
  const env = process.env.OPS_ADMIN_EMAILS;
  afterEach(() => {
    process.env.OPS_ADMIN_EMAILS = env;
  });
  it('only lets listed emails into the internal tickets page (case-insensitive)', () => {
    process.env.OPS_ADMIN_EMAILS = 'founder@example.com, ops@example.com';
    expect(isOpsAdmin('Founder@Example.com')).toBe(true);
    expect(isOpsAdmin('brand-owner@store.com')).toBe(false);
    expect(isOpsAdmin(null)).toBe(false);
  });
  it('denies everyone when unconfigured', () => {
    process.env.OPS_ADMIN_EMAILS = '';
    expect(isOpsAdmin('founder@example.com')).toBe(false);
  });
});
