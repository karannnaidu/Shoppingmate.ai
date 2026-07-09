import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { PersonaForm } from '@/components/dashboard/PersonaForm';
import { WebhookForm } from '@/components/dashboard/WebhookForm';
import { WidgetPlacementForm } from '@/components/dashboard/WidgetPlacementForm';
import { InstallSnippet } from '@/components/dashboard/InstallSnippet';
import { DangerZone } from '@/components/dashboard/DangerZone';

export default async function SettingsPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Settings</h1>
      <PersonaForm initial={session.merchant.persona} />
      <WidgetPlacementForm initial={session.merchant.widgetPosition} />
      <WebhookForm initial={session.merchant.leadWebhookUrl} />
      <InstallSnippet merchantId={session.merchant.id} lastPing={session.merchant.lastWidgetPing} />
      <DangerZone merchantId={session.merchant.id} />
    </div>
  );
}
