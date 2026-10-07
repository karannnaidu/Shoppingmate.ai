import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { PersonaForm } from '@/components/dashboard/PersonaForm';
import { WebhookForm } from '@/components/dashboard/WebhookForm';
import { WidgetPlacementForm } from '@/components/dashboard/WidgetPlacementForm';
import { InstallSnippet } from '@/components/dashboard/InstallSnippet';
import { DangerZone } from '@/components/dashboard/DangerZone';
import { DashHeader } from '@/components/dashboard/v2';

export default async function SettingsPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <DashHeader title="Settings" description="How your assistant sounds and looks on your site, where new leads go, and the line that puts it on your store." />
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
      <DangerZone merchantId={session.merchant.id} />
    </div>
  );
}
