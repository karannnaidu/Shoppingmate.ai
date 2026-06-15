import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listConversions } from '@/lib/audit-repo';

export default async function AuditPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const rows = await listConversions({ merchantId: session.merchant.id, days: 30 });
  const money = (c: number, cur: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: cur || 'USD' }).format(c / 100);
  const total = rows.reduce((s, r) => s + r.totalCents, 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">
          Audit · conversions ledger
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Every order the assistant influenced or placed in the last 30 days. Click a row to open the
          conversation transcript.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface/60 p-8 text-center text-text-secondary">
          No conversions recorded yet. Orders the assistant drives (Shopify, gtag, or COD) appear here.
        </div>
      ) : (
        <>
          <div className="text-sm text-text-secondary">
            {rows.length} order{rows.length === 1 ? '' : 's'} ·{' '}
            <span className="font-medium text-text-primary">
              {money(total, rows[0]?.currency ?? 'USD')}
            </span>{' '}
            attributed
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-left text-text-secondary">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Order</th>
                  <th className="px-4 py-2 font-medium">Attribution</th>
                  <th className="px-4 py-2 font-medium">Source</th>
                  <th className="px-4 py-2 font-medium">Items</th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Transcript</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-surface-muted/50">
                    <td className="px-4 py-2 text-text-secondary">
                      {r.occurredAt.toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.orderId}</td>
                    <td className="px-4 py-2 capitalize">{r.attributionKind}</td>
                    <td className="px-4 py-2 text-xs uppercase tracking-wide">{r.matchSource}</td>
                    <td className="px-4 py-2">{r.lineItems?.length ?? 0}</td>
                    <td className="px-4 py-2 text-right font-medium">{money(r.totalCents, r.currency)}</td>
                    <td className="px-4 py-2">
                      {r.sessionId ? (
                        <Link
                          href={`/app/conversations/${r.sessionId}`}
                          className="text-violet hover:underline"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-text-secondary">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
