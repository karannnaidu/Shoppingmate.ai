export type Plan = {
  id: 'starter' | 'growth' | 'scale' | 'enterprise';
  displayName: string;
  priceCents: number | null;
  convCount: number | null;
  currency: 'USD';
};

export const PLANS: Plan[] = [
  { id: 'starter',    displayName: 'Starter',    priceCents: 3000,   convCount: 100,   currency: 'USD' },
  // Mirrors web/src/lib/plan-credits.ts (the pricing page) — keep in sync.
  { id: 'growth',     displayName: 'Growth',     priceCents: 9900,   convCount: 350,   currency: 'USD' },
  { id: 'scale',      displayName: 'Scale',      priceCents: 29900,  convCount: 1000,  currency: 'USD' },
  { id: 'enterprise', displayName: 'Enterprise', priceCents: null,   convCount: null,  currency: 'USD' },
];

export function findPlan(id: string): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}
