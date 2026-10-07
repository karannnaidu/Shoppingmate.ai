import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { getIntentInsights } from '@/lib/intent-repo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountedBars } from '@/components/dashboard/CountedBars';
import { Target } from 'lucide-react';
import { DashHeader, EmptyState } from '@/components/dashboard/v2';

export default async function IntentsPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const insights = await getIntentInsights({ merchantId: session.merchant.id, days: 30 });

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        title="What shoppers want"
        description={
          insights.total === 0
            ? 'What shoppers come looking for, what they need and what stops them — learned from their conversations.'
            : `What shoppers came for and what held them back, from ${insights.total} conversation${insights.total === 1 ? '' : 's'} in the last 30 days.`
        }
      />

      {insights.total === 0 ? (
        <div className="card-v2">
          <EmptyState
            icon={Target}
            title="Nothing to show yet"
            body="As shoppers talk to your assistant, we note what they wanted and why some didn't buy. It fills in after a few conversations."
          />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>What they came for</CardTitle>
            </CardHeader>
            <CardContent>
              <CountedBars rows={insights.distribution} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>What they asked for most</CardTitle>
            </CardHeader>
            <CardContent>
              <CountedBars rows={insights.topNeeds} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>What held them back</CardTitle>
            </CardHeader>
            <CardContent>
              <CountedBars rows={insights.topObjections} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Where they stopped</CardTitle>
            </CardHeader>
            <CardContent>
              <CountedBars
                rows={insights.dropStages}
                emptyLabel="No one has dropped off yet"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
