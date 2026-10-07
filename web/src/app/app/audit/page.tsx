import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ChevronRight, Receipt } from 'lucide-react';
import { getDashboardSession } from '@/lib/session';
import { listConversions } from '@/lib/audit-repo';
import { formatMoney } from '@/lib/money';
import { Badge, DashHeader, EmptyState } from '@/components/dashboard/v2';

// conversion_events.match_source: 'shopify_webhook' | 'gtag' | 'cod'
const SOURCE: Record<string, string> = {
  shopify_webhook: 'Shopify',
  gtag: 'Your checkout page',
  cod: 'Cash on delivery',
};

export default async function AuditPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const rows = await listConversions({ merchantId: session.merchant.id, days: 30 });
  const total = rows.reduce((s, r) => s + r.totalCents, 0);
  const currency = rows[0]?.currency ?? 'USD';

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        title="Orders"
        description={
          rows.length === 0
            ? 'Every order your assistant helped with in the last 30 days, linked to the conversation behind it.'
            : `${rows.length} order${rows.length === 1 ? '' : 's'} worth ${formatMoney(total, currency)} in the last 30 days. Open one to read the conversation behind it.`
        }
      />

      <section className="card-v2 overflow-hidden">
        {rows.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No orders recorded yet"
            body="When a shopper who talked to your assistant buys — on your checkout or by cash on delivery — the order appears here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50 text-left text-[11.5px] font-medium uppercase tracking-wider text-text-muted">
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-3 py-2.5 font-medium">Order</th>
                  <th className="px-3 py-2.5 font-medium">How</th>
                  <th className="px-3 py-2.5 font-medium">Recorded from</th>
                  <th className="px-3 py-2.5 font-medium">Items</th>
                  <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                  <th className="px-5 py-2.5" aria-label="Conversation" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="transition-colors hover:bg-surface-muted/50">
                    <td className="whitespace-nowrap px-5 py-3 text-text-secondary">
                      {r.occurredAt.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-3 py-3 font-mono text-xs text-text-secondary">{r.orderId}</td>
                    <td className="px-3 py-3">
                      <Badge tone={r.attributionKind === 'assisted' ? 'signal' : 'violet'}>
                        {r.attributionKind === 'assisted' ? 'With your assistant' : 'After a chat'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-text-secondary">{SOURCE[r.matchSource] ?? r.matchSource}</td>
                    <td className="px-3 py-3 tabular-nums text-text-secondary">{r.lineItems?.length ?? 0}</td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatMoney(r.totalCents, r.currency)}</td>
                    <td className="px-5 py-3 text-right">
                      {r.sessionId ? (
                        <Link
                          href={`/app/conversations/${r.sessionId}`}
                          className="inline-flex items-center gap-0.5 text-sm font-medium text-text-secondary hover:text-text-primary"
                        >
                          Chat <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>
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
