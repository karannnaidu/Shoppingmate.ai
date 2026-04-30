import type { MerchantStatus } from '@shoppingmate/db/schema';

const STALE_ONBOARDING_MS = 24 * 60 * 60 * 1000;

export type InstallAction = { kind: 'enqueue' } | { kind: 'noop' };

export function nextInstallAction(
  merchant: { status: MerchantStatus; lastInstallAt: Date | null },
  now: Date,
): InstallAction {
  switch (merchant.status) {
    case 'pending':
    case 'failed':
      return { kind: 'enqueue' };
    case 'onboarding': {
      if (
        merchant.lastInstallAt &&
        now.getTime() - merchant.lastInstallAt.getTime() > STALE_ONBOARDING_MS
      ) {
        return { kind: 'enqueue' };
      }
      return { kind: 'noop' };
    }
    default:
      return { kind: 'noop' };
  }
}
