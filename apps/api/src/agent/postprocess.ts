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

export function stripPrices(input: string): { text: string; hits: PriceHit[] } {
  let text = input;
  const hits: PriceHit[] = [];
  for (const { pattern, re } of PRICE_PATTERNS) {
    text = text.replace(re, (matched) => {
      hits.push({ pattern, matched });
      return 'the price on the card';
    });
  }
  // collapse double spaces created by replacements
  text = text.replace(/ {2,}/g, ' ').trim();
  return { text, hits };
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

export function segmentSay(input: string): string[] {
  return input
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
