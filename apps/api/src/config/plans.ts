/**
 * Shopify App Store plan tiers → monthly voice-minute caps.
 *
 * v1 (Phase A) ships flat tiers with a HARD monthly voice-minute cap; text chat
 * stays unlimited. When a merchant's month-to-date voice minutes reach the cap,
 * voice pauses for the rest of the billing cycle (see apps/api/src/routes/
 * voice-token.ts). Metered overage is the Phase B fast-follow.
 *
 * Numbers are the approved design:
 * docs/superpowers/specs/2026-10-02-shopify-pricing-plans-design.md
 */
export const PLAN_VOICE_MINUTE_CAPS = {
  starter: 200,
  growth: 800,
  scale: 2600,
} as const;

export type PlanTier = keyof typeof PLAN_VOICE_MINUTE_CAPS;

/** The merchants.plan column defaults to 'starter'. */
export const DEFAULT_PLAN: PlanTier = 'starter';

/**
 * Resolve a plan name (as stored in merchants.plan, from Shopify) to its monthly
 * voice-minute cap. Unknown/missing plans fall back to the starter cap so a
 * misconfigured or not-yet-synced merchant is never given an unbounded quota.
 */
export function getVoiceMinuteCap(plan: string | null | undefined): number {
  const key = String(plan ?? DEFAULT_PLAN).toLowerCase();
  return (
    (PLAN_VOICE_MINUTE_CAPS as Record<string, number>)[key] ?? PLAN_VOICE_MINUTE_CAPS[DEFAULT_PLAN]
  );
}
