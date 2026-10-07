import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { PersonaForm } from '@/components/dashboard/PersonaForm';
import { WebhookForm } from '@/components/dashboard/WebhookForm';
import { WidgetPlacementForm } from '@/components/dashboard/WidgetPlacementForm';
import { InstallSnippet } from '@/components/dashboard/InstallSnippet';
import { DangerZone } from '@/components/dashboard/DangerZone';
import { DashHeader } from '@/components/dashboard/v2';
import { DomainsManager } from '@/components/dashboard/OnboardingWizard';
import { BusinessTypeForm } from '@/components/dashboard/BusinessTypeForm';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { SEGMENT_PLAYBOOK, SERVICE_SEGMENTS, detectSegment, type Segment } from '@shoppingmate/shared';

export default async function SettingsPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const [profile] = await db
    .select({
      name: merchants.name,
      domain: merchants.domain,
      brandSummary: merchants.brandSummary,
      brandCategories: merchants.brandCategories,
      businessType: merchants.businessType,
    })
    .from(merchants)
    .where(eq(merchants.id, session.merchant.id))
    .limit(1);
  const option = (id: Segment) => ({ id, label: SEGMENT_PLAYBOOK[id].label, service: SERVICE_SEGMENTS.has(id) });
  const typeOptions = (Object.keys(SEGMENT_PLAYBOOK) as Segment[]).filter((s) => s !== 'general').map(option);
  // What we'd pick on our own (ignoring the owner's saved choice).
  const detectedType = option(detectSegment({ ...profile, businessType: null }));

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <DashHeader title="Settings" description="How your assistant sounds and looks on your site, where new leads go, and the line that puts it on your store." />
      <BusinessTypeForm options={typeOptions} current={profile?.businessType ?? ''} detected={detectedType} />
      <PersonaForm initial={session.merchant.persona} />
      <WidgetPlacementForm
        initialPosition={session.merchant.widgetPosition}
        initialSize={session.merchant.widgetSize}
        initialAccent={session.merchant.widgetAccent}
        initialLabel={session.merchant.widgetLabel}
        initialGreeting={session.merchant.widgetGreeting}
      />
      <WebhookForm initial={session.merchant.leadWebhookUrl} />
      <InstallSnippet merchantId={session.merchant.id} lastPing={session.merchant.lastWidgetPing} />
      {/* Was only reachable during onboarding — a brand that later added a
          custom domain or second storefront had the assistant silently
          blocked there with no way to fix it. */}
      <section className="card-v2 p-6" id="web-addresses">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">Your web addresses</h2>
        <p className="mb-4 mt-0.5 text-[13px] text-text-muted">
          Changed domain or opened a second storefront? Add it here, or your assistant won&apos;t load there.
        </p>
        <DomainsManager />
      </section>
      <DangerZone merchantId={session.merchant.id} />
    </div>
  );
}
