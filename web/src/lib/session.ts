import { auth } from './auth';
import { db } from './db';
import { eq } from 'drizzle-orm';
import { merchantOwners, merchants } from '@shoppingmate/db/schema';

export type DashboardSession = {
  user: { id: string; email: string; name: string | null; image: string | null };
  session: { id: string; expiresAt: Date };
  merchant: {
    id: string;
    plan: string;
    billingStatus: string;
    status: string;
    persona: { voiceDescriptorId: string; brandVoiceNotes: string; toneValue: number } | null;
    leadWebhookUrl: string | null;
    knowledgeBaseStatus: string;
    lastWidgetPing: Date | null;
  } | null;
};

export async function getDashboardSession({ headers }: { headers: Headers }): Promise<DashboardSession | null> {
  const session = await auth.api.getSession({ headers });
  if (!session) return null;

  const ownerRow = await db.query.merchantOwners.findFirst({
    where: eq(merchantOwners.userId, session.user.id),
  });

  let merchant: DashboardSession['merchant'] = null;
  if (ownerRow) {
    const m = await db.query.merchants.findFirst({
      where: eq(merchants.id, ownerRow.merchantId),
    });
    if (m && !m.deletedAt) {
      merchant = {
        id: m.id,
        plan: m.plan,
        billingStatus: m.billingStatus,
        status: m.status,
        persona: m.persona ?? null,
        leadWebhookUrl: m.leadWebhookUrl,
        knowledgeBaseStatus: m.knowledgeBaseStatus,
        lastWidgetPing: m.lastWidgetPing,
      };
    }
  }

  return {
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
      image: session.user.image ?? null,
    },
    session: { id: session.session.id, expiresAt: session.session.expiresAt },
    merchant,
  };
}

export function resolveOnboardingStep(merchant: DashboardSession['merchant']): string {
  if (!merchant) return '/app/onboarding?step=2';
  if (merchant.billingStatus === 'pending') return '/app/onboarding?step=2';
  if (['pending', 'onboarding'].includes(merchant.status)) {
    return '/app/onboarding?step=3';
  }
  if (merchant.status === 'live' && !merchant.lastWidgetPing) return '/app/onboarding?step=4';
  if (merchant.status === 'suspended') return '/app/billing';
  return '/app';
}
