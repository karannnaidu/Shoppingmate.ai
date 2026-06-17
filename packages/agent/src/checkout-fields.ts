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
