const PRICE_PATTERNS: Array<{ pattern: string; re: RegExp }> = [
  { pattern: 'rupee',       re: /₹\s*\d[\d,]*(?:\.\d+)?/g },
  { pattern: 'dollar',      re: /\$\s*\d[\d,]*(?:\.\d+)?/g },
  { pattern: 'rs_prefix',   re: /\bRs\.?\s*\d[\d,]*(?:\.\d+)?/g },
  { pattern: 'word_suffix', re: /\b\d[\d,]*(?:\.\d+)?\s*(?:rupees|rupee|dollars|dollar|INR|USD)\b/gi },
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
  text = text.replace(/  +/g, ' ').trim();
  return { text, hits };
}
