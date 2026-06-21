import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listAudience } from '@/lib/audience-repo';
import { AudienceTable } from '@/components/dashboard/AudienceTable';

export default async function AudiencePage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const rows = await listAudience({ merchantId: session.merchant.id });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
          Audience · returning visitors
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Visitors who came back, with the intents and needs the assistant captured across sessions.
        </p>
      </div>
      <AudienceTable rows={rows} />
    </div>
  );
}
