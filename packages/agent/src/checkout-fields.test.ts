import { describe, expect, it } from 'vitest';
import { validateCheckoutDetails, validateCheckoutFill } from './checkout-fields.js';

const goodDetails = {
  name: 'Karan',
  phone: '+91 8105791726',
  email: 'karan@calmosis.com',
  address: 'First Retreat, Ferns Paradise',
  city: 'Bangalore',
  state: 'Karnataka',
  pincode: '560 038',
};

describe('validateCheckoutDetails', () => {
  it('accepts a full valid payload and normalizes phone + pincode', () => {
    const r = validateCheckoutDetails(goodDetails);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.details.phone).toBe('8105791726');
      expect(r.details.pincode).toBe('560038');
    }
  });

  it('rejects a 9-digit phone with an actionable reason', () => {
    const r = validateCheckoutDetails({ ...goodDetails, phone: '810579172' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/10-digit/i);
  });

  it('rejects a bad pincode and a bad email and a missing name', () => {
    expect(validateCheckoutDetails({ ...goodDetails, pincode: '560' }).ok).toBe(false);
    expect(validateCheckoutDetails({ ...goodDetails, email: 'nope' }).ok).toBe(false);
    expect(validateCheckoutDetails({ ...goodDetails, name: '  ' }).ok).toBe(false);
  });

  it('does NOT require city or state (the checkout page derives them from the pincode)', () => {
    const r = validateCheckoutDetails({ ...goodDetails, city: '', state: '' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.details.city).toBe('');
      expect(r.details.state).toBe('');
      // The fields that ARE required still validate/normalize as before.
      expect(r.details.pincode).toBe('560038');
    }
  });

  it('with requireEmail:false, accepts a blank/garbled email and blanks it (voice flow)', () => {
    const blank = validateCheckoutDetails({ ...goodDetails, email: '' }, { requireEmail: false });
    expect(blank.ok).toBe(true);
    if (blank.ok) expect(blank.details.email).toBe('');
    // A mis-heard non-email is dropped to blank, not filled as a wrong guess.
    const garbled = validateCheckoutDetails({ ...goodDetails, email: 'corona at gmail' }, { requireEmail: false });
    expect(garbled.ok).toBe(true);
    if (garbled.ok) expect(garbled.details.email).toBe('');
    // A valid email is still kept.
    const valid = validateCheckoutDetails({ ...goodDetails, email: 'k@c.com' }, { requireEmail: false });
    expect(valid.ok && valid.details.email).toBe('k@c.com');
    // Phone/pincode are still required even in lenient mode.
    expect(validateCheckoutDetails({ ...goodDetails, phone: '123' }, { requireEmail: false }).ok).toBe(false);
  });
});

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
