// Plan → feature entitlements (nav PRD Phase 8.14). Shared by the API (what the
// widget may collect) and the dashboard (what the owner may see).

export type PlanFeature = 'insights' | 'insights_detail' | 'insights_export';

const PLAN_FEATURES: Record<string, PlanFeature[]> = {
  starter: [],
  growth: ['insights'],
  scale: ['insights', 'insights_detail', 'insights_export'],
};

/** Pilot override (env INSIGHTS_FORCE_MERCHANTS="id1,id2" or "*"): treat these
 *  merchants as Growth for Insights without touching their billing plan. */
function forced(merchantId: string): boolean {
  const raw = (process.env.INSIGHTS_FORCE_MERCHANTS ?? '').trim();
  if (!raw) return false;
  return (
    raw === '*' ||
    raw
      .split(',')
      .map((s) => s.trim())
      .includes(merchantId)
  );
}

export function hasFeature(
  merchant: { id: string; plan: string | null },
  feature: PlanFeature,
): boolean {
  const features = PLAN_FEATURES[merchant.plan ?? 'starter'] ?? [];
  if (features.includes(feature)) return true;
  return feature === 'insights' && forced(merchant.id);
}

/** Tracked sessions per month before the tracker is told to stop (cost control). */
export function insightsSessionCap(merchant: { id: string; plan: string | null }): number {
  if (merchant.plan === 'scale') return 250_000;
  if (merchant.plan === 'growth') return 50_000;
  return forced(merchant.id) ? 50_000 : 0;
}

/** Days detailed pageview rows are kept. */
export function insightsDetailRetentionDays(plan: string | null): number {
  return plan === 'scale' ? 14 : 7;
}
