// Does the visitor sound finished? Our turn detector ends a turn after a short
// pause; this decides how much longer to hold Olivia's (already generating)
// reply in case they're mid-thought. Live 2026-10-27 (Karan): "Why are you
// giving", "I wanted to look at green" and a phone number read as "1 0" /
// "81079" / "10579" were each answered as if complete.

export type Slot = 'phone' | 'pincode' | 'age' | 'address' | 'email';
/** none = release now; short/long = sounds unfinished; dictation = reading out a detail. */
export type Hold = 'none' | 'short' | 'long' | 'dictation';

// Words a finished sentence practically never ends on (Gemini's transcript
// often adds a full stop anyway, e.g. "I wanted to look at.").
const DANGLING = new Set([
  'and', 'or', 'but', 'because', 'the', 'a', 'an', 'to', 'of', 'for', 'with', 'at', 'in', 'from', 'into',
  'my', 'your', 'our', 'their', 'is', 'are', 'was', 'were', 'am', "i'm", 'um', 'uh', 'umm', 'about', 'if', 'than',
]);
const EMAIL_LIKE = /@|\bat\b.*\b(dot|gmail|yahoo|outlook|hotmail|rediff)\b|\bdot\s*(com|in|co)\b|gmail|yahoo|outlook|hotmail|rediff/i;
const ADDRESS_LIKE =
  /\d|\b(flat|house|apartment|apt|floor|road|rd|street|st|lane|nagar|colony|sector|block|cross|main|layout|society|tower|phase|near|opp(osite)?)\b/i;

/** What Olivia just asked the visitor for (from her last spoken line). */
export function expectedSlot(botText: string): Slot | null {
  const t = botText.toLowerCase();
  const tail = t.slice(-160);
  if (/pin ?code|postal code|zip/.test(tail)) return 'pincode';
  if (/e-?mail/.test(tail)) return 'email';
  if (/phone|mobile|whatsapp|contact number|\bnumber\b/.test(tail)) return 'phone';
  if (/address/.test(tail)) return 'address';
  if (/\bage\b|how old/.test(tail)) return 'age';
  return null;
}

export function utteranceHold(text: string, slot: Slot | null): Hold {
  const t = text.trim();
  if (!t) return 'none';
  const digits = (t.match(/\d/g) ?? []).length;
  const wantsPhone = slot === 'phone' || /\b(phone|mobile|number|whatsapp)\b/i.test(t);
  if (wantsPhone && digits > 0) {
    // Indian mobiles are 10 digits (+91 makes 12); fewer = still dictating.
    return digits >= 10 ? 'none' : 'dictation';
  }
  if (slot === 'pincode' && digits > 0) return digits >= 6 ? 'none' : 'dictation';
  // Slot patience only when the answer looks like that slot — a visitor who
  // changes the subject ("actually, something for sleep?") isn't dictating.
  if (slot === 'address' && ADDRESS_LIKE.test(t)) return /\b\d{6}\b/.test(t) ? 'none' : 'dictation';
  if (slot === 'email' && EMAIL_LIKE.test(t)) return /\b(com|in|co|net|org)[.!?]?$/i.test(t) ? 'none' : 'dictation';
  const words = t.split(/\s+/);
  const last = (words[words.length - 1] ?? '').toLowerCase().replace(/[^a-z0-9']/g, '');
  if (DANGLING.has(last)) return 'long';
  if (/[.?!…]["')\]]?$/.test(t)) return 'none';
  // Bare short answers ("yes", "hello", "42", "okay sure") are complete.
  if (words.length <= 2) return 'none';
  return 'short';
}
