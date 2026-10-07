// Nav PRD Phase 4 — validation for the flexible `case.open` tool. The model
// fills the fields that matter for the scenario; we enforce just enough to make
// the case actionable (what it is, how to reach the customer, consent) and
// return a human reason the bot relays when something is missing.

export const CASE_TYPES = [
  'order_tracking',
  'complaint',
  'return_refund',
  'bad_review',
  'product_question',
  // Service businesses (multi-segment PRD 2026-10-07): a table / appointment /
  // visit request, and a price-estimate request.
  'booking',
  'quote',
  'other',
] as const;
export type CaseOpenType = (typeof CASE_TYPES)[number];

export type CaseOpen = {
  type: CaseOpenType;
  summary: string;
  details: Record<string, string>;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  consent: boolean;
  urgency: 'low' | 'normal' | 'high';
  sentiment: 'positive' | 'neutral' | 'negative' | 'angry';
};

export type CaseValidation = { ok: true; value: CaseOpen } | { ok: false; reason: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Normalise a phone to "+CC digits" (or digits); null if implausible. */
export function normalizePhone(raw: string, defaultCc = '+91'): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return null;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.length === 10 && defaultCc) return `${defaultCc} ${digits}`;
  return digits;
}

function str(v: unknown, max = 500): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : typeof v === 'number' ? String(v) : '';
}

export function validateCaseOpen(args: Record<string, unknown>, defaultCc = '+91'): CaseValidation {
  const type = (CASE_TYPES as readonly string[]).includes(String(args.type))
    ? (String(args.type) as CaseOpenType)
    : null;
  if (!type) return { ok: false, reason: `type must be one of: ${CASE_TYPES.join(', ')}` };

  const summary = str(args.summary, 300);
  if (summary.length < 5)
    return { ok: false, reason: 'add a one-line summary of what the customer needs' };

  const details: Record<string, string> = {};
  if (args.details && typeof args.details === 'object' && !Array.isArray(args.details)) {
    for (const [k, v] of Object.entries(args.details as Record<string, unknown>).slice(0, 15)) {
      const s = str(v, 400);
      if (s) details[k.slice(0, 40)] = s;
    }
  }
  if (type === 'order_tracking' && !details.order_number && !details.orderNumber) {
    return { ok: false, reason: 'ask for their order number before opening a tracking request' };
  }
  if (type === 'booking') {
    const when = details.date ?? details.preferred_date ?? details.time ?? details.preferred_time ?? details.when;
    if (!when) return { ok: false, reason: 'ask for their preferred date and time before sending the booking request' };
  }

  const contact = (args.contact && typeof args.contact === 'object' ? args.contact : {}) as Record<
    string,
    unknown
  >;
  const rawPhone = str(contact.phone ?? args.phone, 40);
  const rawEmail = str(contact.email ?? args.email, 120).toLowerCase();
  const contactPhone = rawPhone ? normalizePhone(rawPhone, defaultCc) : null;
  if (rawPhone && !contactPhone)
    return { ok: false, reason: 'that phone number looks incomplete — ask them to repeat it' };
  const contactEmail = rawEmail ? (EMAIL_RE.test(rawEmail) ? rawEmail : null) : null;
  if (rawEmail && !contactEmail)
    return { ok: false, reason: 'that email address looks wrong — ask them to spell it' };
  if (!contactPhone && !contactEmail) {
    return { ok: false, reason: 'ask for a phone number or email so the team can follow up' };
  }
  if (args.consent !== true) {
    return {
      ok: false,
      reason: 'confirm the customer is happy to be contacted, then set consent to true',
    };
  }

  const urgency = args.urgency === 'high' || args.urgency === 'low' ? args.urgency : 'normal';
  const sentiment =
    args.sentiment === 'angry' || args.sentiment === 'negative' || args.sentiment === 'positive'
      ? args.sentiment
      : 'neutral';

  return {
    ok: true,
    value: {
      type,
      summary,
      details,
      contactName: str(contact.name ?? args.name, 80) || null,
      contactPhone,
      contactEmail,
      consent: true,
      // Unhappy customers are always at least normal urgency; bad reviews high.
      urgency:
        type === 'bad_review'
          ? 'high'
          : sentiment === 'angry' && urgency === 'low'
            ? 'normal'
            : urgency,
      sentiment,
    },
  };
}
