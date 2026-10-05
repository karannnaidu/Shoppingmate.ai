import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { merchants, razorpayEvents } from '@shoppingmate/db/schema';
import { desc, eq } from 'drizzle-orm';
import { computeKpis } from '@/lib/kpi-repo';
import { razorpay } from '@/lib/razorpay';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Monthly credit allowance per plan. 1 conversation = 1 credit (text or voice).
// Sized at ~$0.10/convo cost → ~65-67% margin. See
// docs/superpowers/specs/2026-10-05-dashboard-billing-credit-model-design.md
const PLAN_CREDITS: Record<string, { credits: number; price: number }> = {
  starter: { credits: 100, price: 30 },
  growth: { credits: 350, price: 99 },
  scale: { credits: 1000, price: 299 },
};

// One-time credit packs at $0.30/credit.
const TOPUPS = [
  { key: 'topup_100', label: '100', price: 30 },
  { key: 'topup_500', label: '500', price: 150 },
  { key: 'topup_1000', label: '1,000', price: 300 },
];

// Map a Razorpay event type → a human label + outcome for the transactions list.
const TXN_META: Record<string, { label: string; ok: boolean | null }> = {
  'subscription.activated': { label: 'Subscription started', ok: true },
  'subscription.charged': { label: 'Renewal', ok: true },
  'payment_link.paid': { label: 'Top-up', ok: true },
  'payment.captured': { label: 'Payment', ok: true },
  'payment.failed': { label: 'Payment', ok: false },
  'subscription.pending': { label: 'Payment pending', ok: false },
  'subscription.cancelled': { label: 'Subscription cancelled', ok: null },
  'subscription.completed': { label: 'Subscription completed', ok: null },
};

function txnAmountCents(payload: unknown): number | null {
  const p = (payload as { payload?: Record<string, { entity?: { amount?: unknown } }> } | null)?.payload;
  const amt =
    p?.payment?.entity?.amount ?? p?.payment_link?.entity?.amount ?? p?.invoice?.entity?.amount ?? null;
  return typeof amt === 'number' ? amt : null;
}

export default async function BillingPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  const kpis = await computeKpis({ merchantId: session.merchant.id, days: 30 });
  const plan = PLAN_CREDITS[session.merchant.plan] ?? PLAN_CREDITS.starter;

  const allowance = plan.credits;
  const used = kpis.conversations;
  const topupBalance = m?.topupBalance ?? 0;
  const remaining = Math.max(0, allowance + topupBalance - used);
  const pct = allowance > 0 ? Math.min(100, Math.round((used / allowance) * 100)) : 0;
  const subscribed = Boolean(m?.razorpaySubscriptionId);

  let invoices: Array<{ id: string; created: number; total: number; status: string | null; pdf: string | null }> = [];
  if (m?.razorpaySubscriptionId) {
    const list = (await razorpay.invoices.all({ subscription_id: m.razorpaySubscriptionId, count: 12 })) as {
      items: Array<{ id: string; created_at: number; amount: number; status: string | null; short_url: string | null }>;
    };
    invoices = list.items.map((inv) => ({ id: inv.id, created: inv.created_at, total: inv.amount, status: inv.status, pdf: inv.short_url ?? null }));
  }

  const txns = await db
    .select({ id: razorpayEvents.id, type: razorpayEvents.type, receivedAt: razorpayEvents.receivedAt, payload: razorpayEvents.payload })
    .from(razorpayEvents)
    .where(eq(razorpayEvents.merchantId, session.merchant.id))
    .orderBy(desc(razorpayEvents.receivedAt))
    .limit(50);

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-text-primary">Billing</h1>

      {/* Plan + credit usage */}
      <Card>
        <CardHeader>
          <CardTitle>
            <span className="capitalize">{session.merchant.plan}</span> — ${plan.price}/mo · {allowance} credits/mo
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="flex justify-between text-sm text-text-secondary mb-1">
              <span>{used} / {allowance} credits used this cycle</span>
              <span className="tabular-nums text-text-primary">{pct}%</span>
            </div>
            <div className="h-2 bg-surface-muted rounded-full overflow-hidden">
              <div className={`h-full ${pct >= 100 ? 'bg-rose-500' : 'bg-foreground'}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              1 conversation = 1 credit (text or voice). Top-up balance:{' '}
              <strong className="text-text-primary tabular-nums">{topupBalance}</strong> ·{' '}
              <strong className="text-text-primary tabular-nums">{remaining}</strong> credits remaining.
              {remaining === 0 && ' — assistant paused until you top up or your cycle renews.'}
            </p>
          </div>
          {subscribed ? (
            <form action="/api/billing/cancel" method="post">
              <Button type="submit" variant="outline">Cancel subscription</Button>
            </form>
          ) : (
            <form action="/api/billing/checkout-session" method="post">
              <Button type="submit">Subscribe</Button>
            </form>
          )}
          <p className="text-xs text-text-secondary">
            {subscribed
              ? 'Cancels at the end of the current billing period. To change plans, cancel and re-subscribe.'
              : 'Start your subscription to activate the assistant.'}
          </p>
        </CardContent>
      </Card>

      {/* Buy credits */}
      <Card>
        <CardHeader><CardTitle>Buy credits</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {TOPUPS.map((t) => (
            <form key={t.key} action="/api/billing/topup" method="post">
              <input type="hidden" name="topup_key" value={t.key} />
              <Button type="submit" variant="outline" className="w-full flex flex-col h-auto py-3">
                <span className="font-semibold">{t.label} credits</span>
                <span className="text-xs text-text-secondary">${t.price}</span>
              </Button>
            </form>
          ))}
          <p className="col-span-full text-xs text-text-secondary">One-time purchase. Credits are added to your balance and carry over.</p>
        </CardContent>
      </Card>

      {/* Invoices */}
      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="px-0">
          {invoices.length === 0 ? (
            <p className="px-6 py-4 text-sm text-text-secondary">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-text-muted">
                <tr className="border-b border-border"><th className="px-6 py-2 text-left font-medium">Date</th><th className="text-left font-medium">Amount</th><th className="text-left font-medium">Status</th><th className="text-left font-medium">PDF</th></tr>
              </thead>
              <tbody className="text-text-primary">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                    <td className="px-6 py-2 tabular-nums">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                    <td className="tabular-nums">${(inv.total / 100).toFixed(2)}</td>
                    <td className="text-text-secondary">{inv.status}</td>
                    <td>{inv.pdf ? <a href={inv.pdf} className="text-violet hover:underline">Download</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Transactions — every attempt, success + failure (collapsible, scrollable) */}
      <Card>
        <CardHeader><CardTitle>Transactions</CardTitle></CardHeader>
        <CardContent className="px-0">
          <details>
            <summary className="px-6 py-2 cursor-pointer select-none text-sm text-text-secondary">
              {txns.length} payment attempt{txns.length === 1 ? '' : 's'} — click to expand
            </summary>
            <div className="max-h-72 overflow-y-auto border-t border-border">
              {txns.length === 0 ? (
                <p className="px-6 py-4 text-sm text-text-secondary">No transactions yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody className="text-text-primary">
                    {txns.map((tx) => {
                      const meta = TXN_META[tx.type] ?? { label: tx.type, ok: null };
                      const cents = txnAmountCents(tx.payload);
                      return (
                        <tr key={tx.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                          <td className="px-6 py-2 tabular-nums text-text-secondary whitespace-nowrap">{new Date(tx.receivedAt).toLocaleDateString()}</td>
                          <td className="py-2">{meta.label}</td>
                          <td className="py-2 tabular-nums">{cents != null ? `$${(cents / 100).toFixed(2)}` : '—'}</td>
                          <td className="py-2 pr-6 text-right">
                            {meta.ok === true && <span className="text-emerald-500">✓ success</span>}
                            {meta.ok === false && <span className="text-rose-500">✗ failed</span>}
                            {meta.ok === null && <span className="text-text-secondary">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
