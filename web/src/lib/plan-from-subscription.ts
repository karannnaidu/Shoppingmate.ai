export type PlanKey = 'starter' | 'growth' | 'scale';

/** Plan key for a Razorpay subscription: the note we set at checkout, else
 *  its plan_id mapped back through our PLAN_IDS, else starter. */
export function planFromSubscription(
  sub: { plan_id?: string; notes?: { plan?: string } },
  planIds: Partial<Record<PlanKey, string>>,
): PlanKey {
  const n = sub.notes?.plan;
  if (n === 'starter' || n === 'growth' || n === 'scale') return n;
  for (const key of ['growth', 'scale', 'starter'] as const) {
    if (sub.plan_id && planIds[key] && planIds[key] === sub.plan_id) return key;
  }
  return 'starter';
}
