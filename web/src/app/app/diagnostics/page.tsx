import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { alerts } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default async function DiagnosticsPage({ searchParams }: { searchParams: Promise<{ alert?: string }> }) {
  const sp = await searchParams;
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const alertRow = sp.alert ? await db.query.alerts.findFirst({ where: eq(alerts.id, sp.alert) }) : null;

  if (!alertRow || alertRow.merchantId !== session.merchant.id) {
    return (
      <div className="max-w-2xl flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Diagnostics</h1>
        <p className="text-sm text-zinc-500">Open this page from a banner alert to see details.</p>
      </div>
    );
  }

  const payload = alertRow.payload as Record<string, unknown>;

  return (
    <div className="max-w-2xl flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Diagnostics</h1>
      <Card>
        <CardHeader><CardTitle>{alertRow.kind}</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {alertRow.kind === 'override_failing' && (
            <>
              <p className="text-sm">
                Selector <code>{String(payload.selector_key)}</code> is failing on <code>{String(payload.url ?? 'unknown')}</code>.
              </p>
              {payload.suggested ? (
                <p className="text-sm">Suggested fix: <code>{String(payload.suggested)}</code></p>
              ) : (
                <p className="text-sm text-zinc-500">No suggestion available — write your own selector via Settings &rarr; Persona.</p>
              )}
              <div className="flex gap-2">
                <form action={`/api/alerts/${alertRow.id}/accept`} method="post">
                  <Button type="submit">Accept</Button>
                </form>
                <Button variant="outline" type="button" disabled>Reject + write your own (v1.1+)</Button>
              </div>
            </>
          )}
          {alertRow.kind === 'smoke_failing' && (
            <p className="text-sm">Your widget can&apos;t add items to cart. Re-sync your catalog or contact support.</p>
          )}
          {alertRow.kind === 'catalog_drift' && (
            <p className="text-sm">Your catalog hasn&apos;t synced in 24h. Click &quot;Re-sync now&quot; on the banner.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
