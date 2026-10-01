import Razorpay from 'razorpay';

let _rzp: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (_rzp) return _rzp;
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) throw new Error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET is not set');
  _rzp = new Razorpay({ key_id, key_secret });
  return _rzp;
}

export const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    const client = getRazorpay();
    const value = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(client) : value;
  },
});

// HMAC-SHA256 verification (static on the SDK). Cast keeps us resilient if the
// static's type ever moves between SDK versions.
export function validateWebhookSignature(body: string, signature: string, secret: string): boolean {
  const rz = Razorpay as unknown as {
    validateWebhookSignature: (b: string, s: string, sec: string) => boolean;
  };
  return rz.validateWebhookSignature(body, signature, secret);
}

export const PLAN_IDS = {
  starter: process.env.RAZORPAY_PLAN_STARTER ?? '',
  growth: process.env.RAZORPAY_PLAN_GROWTH ?? '',
  scale: process.env.RAZORPAY_PLAN_SCALE ?? '',
} as const;

export const BILLING_CURRENCY = process.env.BILLING_CURRENCY ?? 'USD';

export type TopupKey = 'topup_50' | 'topup_200' | 'topup_1000' | 'topup_5000';

// Charge amount in the smallest currency unit (cents/paise).
export const TOPUP_AMOUNTS: Record<TopupKey, { amount: number; label: string }> = {
  topup_50: { amount: 1900, label: '50' },
  topup_200: { amount: 5900, label: '200' },
  topup_1000: { amount: 19900, label: '1,000' },
  topup_5000: { amount: 79900, label: '5,000' },
};

// Conversations credited to topupBalance when a pack is paid.
export const TOPUP_QTYS: Record<TopupKey, number> = {
  topup_50: 50,
  topup_200: 200,
  topup_1000: 1000,
  topup_5000: 5000,
};
