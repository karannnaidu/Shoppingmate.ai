// Monthly credit allowance per plan. 1 conversation = 1 credit (text or voice).
// Sized at ~$0.10/convo cost → ~65-67% margin. See
// docs/superpowers/specs/2026-10-05-dashboard-billing-credit-model-design.md
// The marketing Pricing component mirrors these numbers.
export const PLAN_CREDITS: Record<string, { credits: number; price: number }> = {
  starter: { credits: 100, price: 30 },
  growth: { credits: 350, price: 99 },
  scale: { credits: 1000, price: 299 },
};

export function planCredits(plan: string | null | undefined) {
  return PLAN_CREDITS[plan ?? 'starter'] ?? PLAN_CREDITS.starter;
}
