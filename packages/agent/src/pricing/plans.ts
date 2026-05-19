export type Plan = {
  id: 'starter' | 'growth' | 'enterprise';
  displayName: string;
  priceCents: number | null;
  convCount: number | null;
  currency: 'USD';
};

export const PLANS: Plan[] = [
  { id: 'starter',    displayName: 'Starter',    priceCents: 3000,   convCount: 100,   currency: 'USD' },
  { id: 'growth',     displayName: 'Growth',     priceCents: 6000,   convCount: 500,   currency: 'USD' },
  { id: 'enterprise', displayName: 'Enterprise', priceCents: null,   convCount: null,  currency: 'USD' },
];

export function findPlan(id: string): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}
