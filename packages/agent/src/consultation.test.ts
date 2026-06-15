import { describe, expect, it } from 'vitest';
import { validateConsultationRequest } from './consultation.js';

describe('validateConsultationRequest', () => {
  it('accepts a valid request and defaults country code to +91', () => {
    const r = validateConsultationRequest({ name: 'Karan', age: 32, phone: '9876543210' });
    expect(r).toEqual({
      ok: true,
      value: { name: 'Karan', age: 32, condition: null, phoneCountryCode: '+91', phone: '9876543210' },
    });
  });
  it('strips spaces/dashes from a 10-digit phone', () => {
    const r = validateConsultationRequest({ name: 'A', age: 20, phone: '98765-43 210' });
    expect(r.ok && r.value.phone).toBe('9876543210');
  });
  it('keeps an optional condition (trimmed)', () => {
    const r = validateConsultationRequest({ name: 'A', age: 20, phone: '9876543210', condition: '  anxiety ' });
    expect(r.ok && r.value.condition).toBe('anxiety');
  });
  it('normalizes a custom country code to start with +', () => {
    const r = validateConsultationRequest({ name: 'A', age: 20, phone: '9876543210', phone_country_code: '1' });
    expect(r.ok && r.value.phoneCountryCode).toBe('+1');
  });
  it('rejects empty name', () => {
    expect(validateConsultationRequest({ name: '  ', age: 20, phone: '9876543210' })).toEqual({
      ok: false,
      reason: 'name is required',
    });
  });
  it('rejects non-integer or out-of-range age', () => {
    expect(validateConsultationRequest({ name: 'A', age: 0, phone: '9876543210' }).ok).toBe(false);
    expect(validateConsultationRequest({ name: 'A', age: 200, phone: '9876543210' }).ok).toBe(false);
    expect(validateConsultationRequest({ name: 'A', age: 3.5, phone: '9876543210' }).ok).toBe(false);
  });
  it('rejects a phone that is not 10 digits', () => {
    expect(validateConsultationRequest({ name: 'A', age: 20, phone: '12345' })).toEqual({
      ok: false,
      reason: 'phone must be exactly 10 digits',
    });
  });
});
