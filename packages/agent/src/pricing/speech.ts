import type { Plan } from './plans.js';

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    throw new Error(`numberToWords: out-of-range ${n}`);
  }
  if (n < 20) return ONES[n]!;
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)]!;
    const o = n % 10;
    return o === 0 ? t : `${t}-${ONES[o]!}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return rest === 0 ? `${ONES[h]!} hundred` : `${ONES[h]!} hundred ${numberToWords(rest)}`;
  }
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  return rest === 0 ? `${ONES[th]!} thousand` : `${ONES[th]!} thousand ${numberToWords(rest)}`;
}

export function formatPlanSpeech(plan: Plan): string {
  if (plan.priceCents === null) {
    return `${plan.displayName} is custom pricing — talk to our team for a quote.`;
  }
  const dollars = Math.round(plan.priceCents / 100);
  const priceWords = numberToWords(dollars);
  if (plan.convCount === null) {
    return `${plan.displayName} is ${priceWords} dollars per month.`;
  }
  const convWords = numberToWords(plan.convCount);
  return `${plan.displayName} is ${priceWords} dollars per month for ${convWords} conversations.`;
}
