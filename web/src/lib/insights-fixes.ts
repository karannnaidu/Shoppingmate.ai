import type { InsightFacts } from '@shoppingmate/db/insights';
import { DEVICE_LABEL, FRICTION_LABEL, PAGE_LABEL, STEP_LABEL, elementWords, money, outOf100 } from './insights-copy';

// Fix cards computed straight from the facts — shown until (and alongside) the
// weekly AI report, so the page is useful from day one. Same 5-part shape.

export type FixCard = {
  id: string;
  title: string;
  impact: string;
  impactValue: number;
  proof: string;
  action: string;
  pageType?: string;
  status: 'open' | 'done';
};

const ACTION_FOR_LEAK: Record<string, string> = {
  'visit→product': 'Put your best seller and a clear “Shop now” button in the first screen of your home page.',
  'product→add_to_cart': 'Make the price, delivery time and “Add to cart” visible without scrolling on phones; add 2–3 reviews near the button.',
  'add_to_cart→checkout': 'Show shipping cost and delivery date in the cart, and keep the checkout button big and first.',
  'checkout→purchase': 'Cut checkout to the essential fields and show trusted payment options (UPI / COD / cards) up front.',
};

export function deterministicFixes(f: InsightFacts): FixCard[] {
  const out: FixCard[] = [];
  for (const leak of f.leaks.filter((l) => l.lost > 0).slice(0, 2)) {
    out.push({
      id: `leak-${leak.from}-${leak.to}`,
      title: `${leak.lost} of ${leak.reached} people stopped between “${STEP_LABEL[leak.from]}” and “${STEP_LABEL[leak.to]}”`,
      impact: leak.valueAtRisk > 0 ? `about ${money(leak.valueAtRisk, f.currency)} a week` : `${leak.lost} shoppers a week`,
      impactValue: leak.valueAtRisk,
      proof: `${leak.continued} of ${leak.reached} moved on to the next step this week.`,
      action: ACTION_FOR_LEAK[`${leak.from}→${leak.to}`] ?? 'Look at this step on your phone and remove whatever slows a shopper down.',
      pageType: leak.from === 'product' ? 'pdp' : leak.from === 'visit' ? 'home' : undefined,
      status: 'open',
    });
  }
  const worst = f.friction.find((x) => x.kind === 'dead' || x.kind === 'rage' || x.kind === 'error');
  if (worst) {
    out.push({
      id: `friction-${worst.pageType}-${worst.kind}-${worst.target}`,
      title: `On your ${(PAGE_LABEL[worst.pageType] ?? worst.pageType).toLowerCase()}, people ${FRICTION_LABEL[worst.kind]}`,
      impact: `${worst.count} times this week on ${DEVICE_LABEL[worst.device] ?? worst.device}`,
      impactValue: 0,
      proof: `Most often on ${elementWords(worst.target)}.`,
      action:
        worst.kind === 'dead'
          ? 'Make that element a real link or button — or change its look so it doesn’t invite a tap.'
          : 'Check that this button works on a phone; if it’s slow, show a loading state right away.',
      pageType: worst.pageType,
      status: 'open',
    });
  }
  const field = f.abandonedFields[0];
  if (field && field.count >= 3) {
    out.push({
      id: `field-${field.pageType}-${field.field}`,
      title: `${field.count} people started typing “${field.field}” and then gave up`,
      impact: 'shoppers who were close to finishing',
      impactValue: 0,
      proof: `On your ${(PAGE_LABEL[field.pageType] ?? field.pageType).toLowerCase()}.`,
      action: 'Make that field optional, auto-fill it, or explain why you need it in one short line.',
      pageType: field.pageType,
      status: 'open',
    });
  }
  if (out.length === 0 && f.sessions > 0) {
    out.push({
      id: 'steady',
      title: `${outOf100(f.conversionRate)} visitors bought this week`,
      impact: 'no single big leak stood out',
      impactValue: 0,
      proof: `${f.sessions} visits, ${f.steps.purchase} purchases.`,
      action: 'Keep going — we will flag the first thing that starts costing you sales.',
      status: 'open',
    });
  }
  return out.sort((a, b) => b.impactValue - a.impactValue);
}
