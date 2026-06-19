// Hard validation for bot-driven checkout form fills (page.fill). The model is
// told to collect a 10-digit phone etc., but prompt guidance is soft — it can
// pass a malformed phone/pincode/email straight onto the real checkout page.
// This is the guarantee: reject the fill (with an actionable reason the bot
// relays) before anything is written, and normalize the values that are valid.

export type CheckoutFillField = { field: string; value: string };

export type CheckoutFillResult =
  | { ok: true; fields: CheckoutFillField[] }
  | { ok: false; reason: string };

const PHONE_RE = /phone|mobile|contact|whats\s?app/i;
const PINCODE_RE = /pin\s?code|postal|\bzip\b/i;
const EMAIL_FIELD_RE = /e-?mail/i;
const EMAIL_VALUE_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Strip a +91 / 91 / leading-0 prefix and all non-digits, returning the bare
 *  subscriber digits so "+91 98765-43210" and "098765 43210" both normalize. */
function normalizePhoneDigits(value: string): string {
  let d = value.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}

const reasonFor = {
  phone: (raw: string) =>
    `The phone number "${raw}" isn't a valid 10-digit Indian mobile — ask the visitor to re-share it (10 digits, starting 6–9).`,
  pincode: (raw: string) =>
    `The pincode "${raw}" isn't 6 digits — ask the visitor for a valid 6-digit pincode.`,
  email: (raw: string) =>
    `The email address "${raw}" looks invalid — ask the visitor for a valid email.`,
};

/** True for a valid 10-digit Indian mobile (already normalized digits). */
function isValidPhone(digits: string): boolean {
  return digits.length === 10 && /^[6-9]/.test(digits);
}

export type CheckoutDetails = {
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
};

export type CheckoutDetailsResult =
  | { ok: true; details: CheckoutDetails }
  | { ok: false; reason: string };

/**
 * Validate + normalize the named checkout.fill details (the brand-hook path).
 * Mirrors validateCheckoutFill but for the structured shape, returning a
 * field-specific reason so the bot re-asks for exactly what's wrong instead of
 * looping. Normalizes phone (bare 10 digits) and pincode (6 digits).
 */
export function validateCheckoutDetails(
  d: Partial<CheckoutDetails>,
  opts: { requireEmail?: boolean } = {},
): CheckoutDetailsResult {
  const name = (d.name ?? '').trim();
  if (!name) return { ok: false, reason: 'The name is missing — ask the visitor for their full name.' };

  const phone = normalizePhoneDigits((d.phone ?? '').trim());
  if (!isValidPhone(phone)) return { ok: false, reason: reasonFor.phone((d.phone ?? '').trim()) };

  // Voice can't reliably spell emails (STT garbles them), so the voice flow
  // passes requireEmail:false: we KEEP the email only if it's actually valid,
  // otherwise leave it blank for the visitor to type on the checkout page —
  // never fill a mis-heard guess. The text flow keeps requireEmail (default).
  const rawEmail = (d.email ?? '').trim();
  const emailValid = EMAIL_VALUE_RE.test(rawEmail);
  if (opts.requireEmail !== false && !emailValid) return { ok: false, reason: reasonFor.email(rawEmail) };
  const email = emailValid ? rawEmail : '';

  const address = (d.address ?? '').trim();
  if (!address) return { ok: false, reason: 'The street address is missing — ask the visitor for it.' };

  const city = (d.city ?? '').trim();
  if (!city) return { ok: false, reason: 'The city is missing — ask the visitor for it.' };

  const state = (d.state ?? '').trim();
  if (!state) return { ok: false, reason: 'The state is missing — ask the visitor for it.' };

  const pincode = (d.pincode ?? '').replace(/\D/g, '');
  if (pincode.length !== 6) return { ok: false, reason: reasonFor.pincode((d.pincode ?? '').trim()) };

  return { ok: true, details: { name, phone, email, address, city, state, pincode } };
}

/**
 * Validate + normalize the fields the bot wants to type into the checkout page.
 * Only phone/pincode/email fields are checked (by field-name); everything else
 * passes through untouched. Returns ok:false with a human, actionable reason on
 * the FIRST invalid field so the bot fixes exactly that and re-asks.
 */
export function validateCheckoutFill(fields: CheckoutFillField[]): CheckoutFillResult {
  const out: CheckoutFillField[] = [];
  for (const f of fields) {
    const name = f.field ?? '';
    const raw = (f.value ?? '').trim();
    // Email takes precedence so a field literally named "email" isn't caught by
    // the phone matcher via the word "mail"/"contact".
    if (EMAIL_FIELD_RE.test(name)) {
      if (!EMAIL_VALUE_RE.test(raw)) {
        return { ok: false, reason: `The email address "${raw}" looks invalid — ask the visitor for a valid email.` };
      }
      out.push({ field: f.field, value: raw });
      continue;
    }
    if (PHONE_RE.test(name)) {
      const d = normalizePhoneDigits(raw);
      if (d.length !== 10 || !/^[6-9]/.test(d)) {
        return {
          ok: false,
          reason: `The phone number "${raw}" isn't a valid 10-digit Indian mobile — ask the visitor to re-share it (10 digits, starting 6–9).`,
        };
      }
      out.push({ field: f.field, value: d });
      continue;
    }
    if (PINCODE_RE.test(name)) {
      const d = raw.replace(/\D/g, '');
      if (d.length !== 6) {
        return {
          ok: false,
          reason: `The pincode "${raw}" isn't 6 digits — ask the visitor for a valid 6-digit pincode.`,
        };
      }
      out.push({ field: f.field, value: d });
      continue;
    }
    out.push({ field: f.field, value: raw });
  }
  return { ok: true, fields: out };
}
