import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { getIntentInsights } from '@/lib/intent-repo';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CountedBars } from '@/components/dashboard/CountedBars';

export default async function IntentsPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const insights = await getIntentInsights({ merchantId: session.merchant.id, days: 30 });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
          Customer intent · last 30 days
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          {insights.total} conversation{insights.total === 1 ? '' : 's'} analyzed.
        </p>
      </div>

      {insights.total === 0 ? (
        <div className="rounded-lg border border-border bg-surface/60 p-8 text-center text-text-secondary">
          No conversations with captured intent yet.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Intent distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <CountedBars title="What visitors came for" rows={insights.distribution} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top needs</CardTitle>
            </CardHeader>
            <CardContent>
              <CountedBars title="Most-mentioned needs" rows={insights.topNeeds} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Top objections</CardTitle>
            </CardHeader>
            <CardContent>
              <CountedBars title="What held visitors back" rows={insights.topObjections} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Drop-off stage</CardTitle>
            </CardHeader>
            <CardContent>
              <CountedBars
                title="Where abandoners left"
                rows={insights.dropStages}
                emptyLabel="No abandonment data"
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
