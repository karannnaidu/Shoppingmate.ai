import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { merchants, razorpayEvents } from '@shoppingmate/db/schema';
import { desc, eq } from 'drizzle-orm';
import { computeKpis } from '@/lib/kpi-repo';
import { razorpay } from '@/lib/razorpay';
import { PLAN_CREDITS } from '@/lib/plan-credits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge, DashHeader, Meter } from '@/components/dashboard/v2';
import { cn } from '@/lib/cn';

// One-time credit packs at $0.30/credit.
const TOPUPS = [
  { key: 'topup_100', label: '100', price: 30 },
  { key: 'topup_500', label: '500', price: 150 },
  { key: 'topup_1000', label: '1,000', price: 300 },
];

const PLAN_PERKS: Record<string, string> = {
  starter: 'Voice + chat, customer requests, full dashboard',
  growth: 'Everything in Starter + Store Insights and weekly fixes',
  scale: 'Everything in Growth + shopper journeys and exports',
};

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
  const plan = PLAN_CREDITS[session.merchant.plan] ?? PLAN_CREDITS.starter!;

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
    <div className="flex max-w-4xl flex-col gap-6">
      <DashHeader
        title="Billing"
        description="Your plan, how many conversations you've used, and top-ups. One conversation is one shopper's visit — voice or chat, same price."
      />

      {/* Plan + usage */}
      <section className="card-v2 relative overflow-hidden p-6">
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet/10 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">Your plan</p>
            <p className="mt-1.5 flex items-center gap-2.5 font-display text-2xl font-semibold tracking-[-0.02em]">
              <span className="capitalize">{session.merchant.plan}</span>
              <Badge tone={subscribed ? 'signal' : 'amber'}>{subscribed ? 'Active' : 'Not started'}</Badge>
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              ${plan.price}/month · {allowance} conversations a month
            </p>
          </div>
          {subscribed ? (
            <form action="/api/billing/cancel" method="post">
              <Button type="submit" variant="outline" size="sm">Cancel subscription</Button>
            </form>
          ) : (
            <form action="/api/billing/checkout-session" method="post">
              <Button type="submit">Start my subscription</Button>
            </form>
          )}
        </div>

        <div className="relative mt-6">
          <div className="mb-2 flex items-baseline justify-between text-sm">
            <span className="text-text-secondary">
              <strong className="font-display text-xl font-semibold tabular-nums text-text-primary">{used}</strong> of {allowance} used this month
            </span>
            <span className="tabular-nums text-text-muted">{pct}%</span>
          </div>
          <Meter value={used} max={allowance} />
          <p className="mt-2.5 text-[13px] text-text-secondary">
            <strong className="tabular-nums text-text-primary">{remaining}</strong> left
            {topupBalance > 0 && (
              <>
                {' '}(including <strong className="tabular-nums text-text-primary">{topupBalance}</strong> from top-ups)
              </>
            )}
            .{remaining === 0 && ' Your assistant is paused until you top up or your plan renews.'}
          </p>
        </div>
        <p className="relative mt-4 border-t border-border pt-4 text-xs text-text-muted">
          {subscribed
            ? 'Cancelling takes effect at the end of this billing period. To switch plans, cancel and start the new plan.'
            : 'Start your subscription to switch your assistant on.'}
        </p>
      </section>

      {/* Plans */}
      <section>
        <h2 className="mb-3 font-display text-[17px] font-semibold tracking-[-0.015em]">Plans</h2>
        <div className="grid gap-3 md:grid-cols-3">
          {Object.entries(PLAN_CREDITS).map(([key, p]) => {
            const current = key === session.merchant!.plan;
            return (
              <div
                key={key}
                className={cn('card-v2 p-5', current && 'ring-2 ring-violet/60')}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium capitalize">{key}</p>
                  {current && <Badge tone="violet">Current</Badge>}
                </div>
                <p className="mt-3 font-display text-3xl font-semibold tabular-nums tracking-tight">
                  ${p.price}
                  <span className="text-sm font-normal text-text-muted"> /mo</span>
                </p>
                <p className="mt-1 text-sm text-text-secondary">{p.credits.toLocaleString()} conversations</p>
                <p className="mt-3 flex items-start gap-2 text-[13px] text-text-secondary">
                  <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-signal" />
                  {PLAN_PERKS[key]}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Top up */}
      <section className="card-v2 p-6">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">Top up conversations</h2>
        <p className="mt-0.5 text-[13px] text-text-muted">One-time purchase at $0.30 per conversation. Top-ups never expire.</p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {TOPUPS.map((t, i) => (
            <form key={t.key} action="/api/billing/topup" method="post">
              <input type="hidden" name="topup_key" value={t.key} />
              <button
                type="submit"
                className={cn(
                  'card-v2 card-v2-hover flex w-full flex-col items-start p-4 text-left',
                  i === 1 && 'ring-1 ring-signal/40',
                )}
              >
                <span className="flex w-full items-center justify-between">
                  <span className="font-display text-xl font-semibold tabular-nums">+{t.label}</span>
                  {i === 1 && <Badge tone="signal">Popular</Badge>}
                </span>
                <span className="mt-0.5 text-sm text-text-secondary">conversations</span>
                <span className="mt-3 text-sm font-semibold tabular-nums">${t.price}</span>
              </button>
            </form>
          ))}
        </div>
      </section>

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
