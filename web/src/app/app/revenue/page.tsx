import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { BarChart3, ShoppingBag, Sparkles, TrendingUp } from 'lucide-react';
import { getDashboardSession } from '@/lib/session';
import { listRevenueRows } from '@/lib/revenue-repo';
import { formatMoney, merchantCurrency } from '@/lib/money';
import { Badge, DashHeader, EmptyState, StatCard } from '@/components/dashboard/v2';
import { cn } from '@/lib/cn';
import { LocalTime } from '@/components/dashboard/LocalTime';

const RANGES = [7, 30, 90];
const WHEN_FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const { days: daysParam } = await searchParams;
  const parsed = Number(daysParam ?? '7');
  const days = Number.isFinite(parsed) && parsed > 0 ? Math.min(Math.floor(parsed), 90) : 7;
  const [rows, storeCurrency] = await Promise.all([
    listRevenueRows({ merchantId: session.merchant.id, days }),
    merchantCurrency(session.merchant.id).catch(() => 'USD'),
  ]);

  const currency = rows[0]?.currency ?? storeCurrency;
  const total = rows.reduce((s, r) => s + r.totalCents, 0);
  const assisted = rows.filter((r) => r.kind === 'assisted');
  const recommendedLines = rows.flatMap((r) => r.lineItems).filter((li) => li.wasRecommended).length;

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        title="Revenue"
        description={`Sales from shoppers who talked to your assistant, last ${days} days. Products your assistant recommended are starred.`}
        actions={
          <nav className="inline-flex gap-1 rounded-xl border border-border bg-surface-muted/60 p-1" aria-label="Date range">
            {RANGES.map((d) => (
              <Link
                key={d}
                href={`/app/revenue?days=${d}`}
                aria-current={d === days ? 'page' : undefined}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  d === days
                    ? 'bg-surface-elevated text-text-primary shadow-[inset_0_1px_0_var(--highlight),var(--shadow-sm)]'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                {d} days
              </Link>
            ))}
          </nav>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={TrendingUp} tone="signal" label="Sales after a chat" value={formatMoney(total, currency)} hint={`${rows.length} order${rows.length === 1 ? '' : 's'}`} />
        <StatCard icon={ShoppingBag} label="Placed with your assistant" value={String(assisted.length)} hint="Your assistant filled the cart or checkout" />
        <StatCard icon={Sparkles} label="Recommended items sold" value={String(recommendedLines)} hint="Products your assistant suggested" />
      </div>

      <section className="card-v2 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState icon={BarChart3} title={`No sales traced to a chat in the last ${days} days`} body="When a shopper who talked to your assistant places an order, it shows up here with what they bought." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-left text-[11.5px] font-medium uppercase tracking-wider text-text-muted">
                  <th className="px-5 py-2.5 font-medium">When</th>
                  <th className="px-3 py-2.5 font-medium">Order</th>
                  <th className="px-3 py-2.5 font-medium">How</th>
                  <th className="px-3 py-2.5 font-medium">Items</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={`${row.orderId}-${row.kind}`} className="transition-colors hover:bg-surface-muted/50">
                    <td className="whitespace-nowrap px-5 py-3 text-text-secondary">
                      <LocalTime iso={row.occurredAt.toISOString()} options={WHEN_FMT} />
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-text-secondary">{row.orderId}</td>
                    <td className="px-3 py-3">
                      <Badge tone={row.kind === 'assisted' ? 'signal' : 'violet'}>
                        {row.kind === 'assisted' ? 'With your assistant' : 'After a chat'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {row.lineItems.map((li, i) => (
                          <span
                            key={i}
                            className={cn(
                              'rounded-md px-1.5 py-0.5 text-xs',
                              li.wasRecommended ? 'bg-signal-soft font-medium text-signal' : 'bg-surface-muted text-text-secondary',
                            )}
                          >
                            {li.wasRecommended && '★ '}
                            {li.sku} × {li.quantity}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular-nums">{formatMoney(row.totalCents, row.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
