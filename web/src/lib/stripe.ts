import Stripe from 'stripe';

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (_stripe) return _stripe;
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not set');
  _stripe = new Stripe(apiKey, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion });
  return _stripe;
}

export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    const client = getStripe();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

export const PRICE_IDS = {
  starter_monthly: process.env.STRIPE_PRICE_STARTER_MONTHLY ?? '',
  growth_monthly: process.env.STRIPE_PRICE_GROWTH_MONTHLY ?? '',
  scale_monthly: process.env.STRIPE_PRICE_SCALE_MONTHLY ?? '',
  topup_50: process.env.STRIPE_PRICE_TOPUP_50 ?? '',
  topup_200: process.env.STRIPE_PRICE_TOPUP_200 ?? '',
  topup_1000: process.env.STRIPE_PRICE_TOPUP_1000 ?? '',
  topup_5000: process.env.STRIPE_PRICE_TOPUP_5000 ?? '',
} as const;

export type TopupKey = 'topup_50' | 'topup_200' | 'topup_1000' | 'topup_5000';
export const TOPUP_QTYS: Record<TopupKey, number> = {
  topup_50: 50,
  topup_200: 200,
  topup_1000: 1000,
  topup_5000: 5000,
};
