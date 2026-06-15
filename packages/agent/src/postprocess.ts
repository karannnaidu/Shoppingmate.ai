const PRICE_PATTERNS: Array<{ pattern: string; re: RegExp }> = [
  { pattern: 'rupee', re: /₹\s*\d[\d,]*(?:\.\d+)?/g },
  { pattern: 'dollar', re: /\$\s*\d[\d,]*(?:\.\d+)?/g },
  { pattern: 'rs_prefix', re: /\bRs\.?\s*\d[\d,]*(?:\.\d+)?/g },
  {
    pattern: 'word_suffix',
    re: /\b\d[\d,]*(?:\.\d+)?\s*(?:rupees|rupee|dollars|dollar|INR|USD)\b/gi,
  },
];

export type PriceHit = { pattern: string; matched: string };

export function stripPrices(
  input: string,
  allowedSpeechTokens?: Set<string>,
): { text: string; hits: PriceHit[] } {
  let text = input;
  const hits: PriceHit[] = [];
  for (const { pattern, re } of PRICE_PATTERNS) {
    const mask = buildMask(text, allowedSpeechTokens);
    text = text.replace(re, (matched, offset: number) => {
      if (isMaskedSpan(mask, offset, matched.length)) return matched;
      hits.push({ pattern, matched });
      return 'the price on the card';
    });
  }
  text = text.replace(/ {2,}/g, ' ').trim();
  return { text, hits };
}

function buildMask(s: string, allowed?: Set<string>): Uint8Array {
  const mask = new Uint8Array(s.length);
  if (!allowed || allowed.size === 0) return mask;
  for (const token of allowed) {
    if (!token) continue;
    let i = 0;
    while (i <= s.length - token.length) {
      const j = s.indexOf(token, i);
      if (j < 0) break;
      for (let k = j; k < j + token.length; k++) mask[k] = 1;
      i = j + token.length;
    }
  }
  return mask;
}

function isMaskedSpan(mask: Uint8Array, start: number, len: number): boolean {
  for (let i = start; i < start + len; i++) {
    if (mask[i] !== 1) return false;
  }
  return len > 0;
}

const EMAIL_RE = /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g;
const PHONE_RE = /(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){10,15}/g; // catches ten-digit and intl
const CARD_RE = /\b(?:\d[\s-]?){13,19}\b/g;

export function redactPii(input: string): string {
  return input
    .replace(CARD_RE, '[redacted]')
    .replace(EMAIL_RE, '[redacted]')
    .replace(PHONE_RE, '[redacted]');
}

// Strip any leaked tool-call syntax from model speech, e.g.
// `site.navigate({"path":"/x"})` or `navigation.site.navigate({"url":...})`.
// Matches a DOTTED identifier (namespace.method — all our tools are dotted)
// immediately followed by a parenthesised arg list. Requiring the dot keeps
// ordinary prose like "Green Mantra (our blend)" untouched.
const TOOL_SYNTAX_RE = /\b[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+\s*\((?:[^()]|\{[^}]*\})*\)/g;

export function stripToolSyntax(input: string): string {
  return input
    .replace(TOOL_SYNTAX_RE, '')
    .replace(/ {2,}/g, ' ')
    .replace(/\s+([.,!?])/g, '$1')
    .trim();
}

export function segmentSay(input: string): string[] {
  return input
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
