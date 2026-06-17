import { describe, expect, it } from 'vitest';
import { validateCheckoutFill } from './checkout-fields.js';

describe('validateCheckoutFill', () => {
  it('rejects a phone that is not 10 digits', () => {
    const r = validateCheckoutFill([{ field: 'Phone', value: '810579172' }]); // 9 digits
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/10-digit/i);
  });

  it('rejects a phone that does not start 6–9', () => {
    const r = validateCheckoutFill([{ field: 'Phone number', value: '1234567890' }]);
    expect(r.ok).toBe(false);
  });

  it('accepts and normalizes a +91-prefixed phone to 10 digits', () => {
    const r = validateCheckoutFill([{ field: 'Phone', value: '+91 81057-91726' }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields[0].value).toBe('8105791726');
  });

  it('strips a leading 0 from an 11-digit phone', () => {
    const r = validateCheckoutFill([{ field: 'Mobile', value: '08105791726' }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields[0].value).toBe('8105791726');
  });

  it('rejects a pincode that is not 6 digits', () => {
    const r = validateCheckoutFill([{ field: 'Pincode', value: '5600' }]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/6 digit/i);
  });

  it('accepts a valid 6-digit pincode (stripping spaces)', () => {
    const r = validateCheckoutFill([{ field: 'Pin code', value: '560 038' }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields[0].value).toBe('560038');
  });

  it('rejects an invalid email but passes a valid one', () => {
    expect(validateCheckoutFill([{ field: 'Email', value: 'not-an-email' }]).ok).toBe(false);
    expect(validateCheckoutFill([{ field: 'Email', value: 'karan@calmosis.com' }]).ok).toBe(true);
  });

  it('passes non-validated fields (name, address) through untouched', () => {
    const r = validateCheckoutFill([
      { field: 'Full name', value: 'Karan' },
      { field: 'Address', value: 'First Retreat, Ferns Paradise' },
    ]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.fields).toHaveLength(2);
  });

  it('reports the first invalid field across a full payload', () => {
    const r = validateCheckoutFill([
      { field: 'Full name', value: 'Karan' },
      { field: 'Phone', value: '123' },
      { field: 'Pincode', value: '560038' },
    ]);
    expect(r.ok).toBe(false);
  });
});
