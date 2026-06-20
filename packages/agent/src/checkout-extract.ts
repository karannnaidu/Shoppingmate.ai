import {
  type CheckoutDetails,
  type ContactDetails,
  type ContactDetailsResult,
  validateCheckoutDetails,
  validateContactDetails,
} from './checkout-fields.js';

// A minimal chat function (injected for testability) — the voice worker wires
// this to the OpenRouter `chat` completion with the precise checkout model.
export type ChatFn = (
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
) => Promise<{ text: string }>;

export type ExtractResult =
  | { ok: true; details: CheckoutDetails }
  | { ok: false; reason: string };

const SYSTEM = `You extract structured checkout details from a VOICE shopping conversation transcript. The transcript may be in English, Hindi, or Hinglish, with messy speech-to-text and spelled-out corrections (e.g. a name given as "K A R A N" or an email spelled "t h o r i n 1 4 3 5 at gmail dot com"). Rules:
- Output ONLY a single JSON object, no prose, with exactly these keys: name, phone, email, address, city, state, pincode.
- Use the visitor's MOST RECENT correction for each field (later statements override earlier ones).
- Reconstruct spelled-out values into their normal form (letters → a name; "t h o r i n 1435 at gmail dot com" → "thorin1435@gmail.com").
- phone = the 10-digit Indian mobile digits only; pincode = the 6 digits only.
- If a field was never clearly provided, use an empty string "". NEVER invent or guess a value.`;

/**
 * Deterministically pull the 7 checkout fields out of the full voice transcript
 * (both sides), then validate/normalize. This is the reliable path for voice —
 * it reads the whole conversation at once instead of relying on the side-channel
 * executor's flaky turn-by-turn tool decisions. On a missing/invalid field the
 * reason names it so the bot can ask again instead of faking success.
 */
export async function extractCheckoutDetails(
  transcript: string,
  chat: ChatFn,
  opts: { requireEmail?: boolean } = {},
): Promise<ExtractResult> {
  let text: string;
  try {
    const res = await chat([
      { role: 'system', content: SYSTEM },
      { role: 'user', content: `Transcript:\n${transcript}\n\nReturn the JSON object now.` },
    ]);
    text = res.text ?? '';
  } catch {
    return { ok: false, reason: 'I had trouble reading back the details — could the visitor repeat them?' };
  }
  let parsed: Partial<CheckoutDetails>;
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('no json');
    parsed = JSON.parse(text.slice(start, end + 1)) as Partial<CheckoutDetails>;
  } catch {
    return { ok: false, reason: 'I had trouble reading back the details — could the visitor repeat them?' };
  }
  return validateCheckoutDetails(parsed, opts);
}

const CONTACT_SYSTEM = `You extract "Contact us" / inquiry form details from a VOICE conversation transcript (English, Hindi, or Hinglish, with messy speech-to-text and spelled-out corrections). Rules:
- Output ONLY a single JSON object, no prose, with exactly these keys: name, email, mobile, subject, message.
- Use the visitor's MOST RECENT correction for each field.
- Reconstruct spelled-out values (letters → a name; "t h o r i n at gmail dot com" → "thorin1435@gmail.com").
- mobile = the 10-digit Indian mobile digits only.
- subject = a short subject line summarizing the inquiry; message = the full thing the visitor wants to say/ask.
- If a field was never clearly provided, use an empty string "". NEVER invent a name, email, or phone.`;

/** Same as extractCheckoutDetails but for the "Contact us" / inquiry form. */
export async function extractContactDetails(
  transcript: string,
  chat: ChatFn,
): Promise<ContactDetailsResult> {
  let text: string;
  try {
    const res = await chat([
      { role: 'system', content: CONTACT_SYSTEM },
      { role: 'user', content: `Transcript:\n${transcript}\n\nReturn the JSON object now.` },
    ]);
    text = res.text ?? '';
  } catch {
    return { ok: false, reason: 'I had trouble reading back the details — could the visitor repeat them?' };
  }
  let parsed: Partial<ContactDetails>;
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw new Error('no json');
    parsed = JSON.parse(text.slice(start, end + 1)) as Partial<ContactDetails>;
  } catch {
    return { ok: false, reason: 'I had trouble reading back the details — could the visitor repeat them?' };
  }
  return validateContactDetails(parsed);
}
