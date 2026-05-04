import Stripe from 'stripe';

const apiKey = process.env.STRIPE_SECRET_KEY;
if (!apiKey) throw new Error('STRIPE_SECRET_KEY is not set');

export const stripe = new Stripe(apiKey, { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion });

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
