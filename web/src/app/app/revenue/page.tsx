import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { listRevenueRows } from '@/lib/revenue-repo';

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const { days: daysParam } = await searchParams;
  const parsed = Number(daysParam ?? '7');
  const days = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 90) : 7;
  const rows = await listRevenueRows({ merchantId: session.merchant.id, days });

  const usd = (cents: number, ccy: string) => `${ccy === 'USD' ? '$' : ccy + ' '}${(cents / 100).toFixed(2)}`;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight">Revenue</h1>
      <p className="text-text-muted">Attributed orders over the last {days} days. Recommended SKUs are marked.</p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-default text-left text-text-muted">
            <th className="py-2">When</th>
            <th>Order</th>
            <th>Kind</th>
            <th>Total</th>
            <th>Line items</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.orderId}-${row.kind}`} className="border-b border-border-subtle">
              <td className="py-2">{row.occurredAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
              <td className="font-mono">{row.orderId}</td>
              <td>
                <span className={row.kind === 'assisted' ? 'rounded bg-emerald-100 px-2 py-0.5 text-emerald-700' : 'rounded bg-sky-100 px-2 py-0.5 text-sky-700'}>
                  {row.kind}
                </span>
              </td>
              <td>{usd(row.totalCents, row.currency)}</td>
              <td>
                {row.lineItems.map((li, i) => (
                  <span key={i} className={li.wasRecommended ? 'mr-2 font-medium text-emerald-700' : 'mr-2'}>
                    {li.wasRecommended && '★ '}
                    {li.sku} × {li.quantity}
                  </span>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && <p className="text-text-muted">No attributed orders in the last {days} days yet.</p>}
    </div>
  );
}
