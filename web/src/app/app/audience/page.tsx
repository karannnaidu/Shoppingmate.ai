import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listAudience } from '@/lib/audience-repo';
import { merchantCurrency } from '@/lib/money';
import { AudienceTable } from '@/components/dashboard/AudienceTable';
import { DashHeader } from '@/components/dashboard/v2';

export default async function AudiencePage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const [rows, currency] = await Promise.all([
    listAudience({ merchantId: session.merchant.id }),
    merchantCurrency(session.merchant.id).catch(() => 'USD'),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        title="Shoppers"
        description="Everyone who talked to your assistant and what they were after. Shoppers who came back are marked — they're often the closest to buying."
      />
      <AudienceTable rows={rows} currency={currency} />
    </div>
  );
}
