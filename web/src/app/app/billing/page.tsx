import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getDashboardSession } from '@/lib/session';
import { db } from '@/lib/db';
import { merchants } from '@shoppingmate/db/schema';
import { eq } from 'drizzle-orm';
import { computeKpis } from '@/lib/kpi-repo';
import { stripe } from '@/lib/stripe';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { saveAutoRecharge } from './actions';

const PLAN_QUOTA: Record<string, { conversations: number; price: number }> = {
  starter: { conversations: 100, price: 30 },
  growth: { conversations: 500, price: 99 },
  scale: { conversations: 2000, price: 299 },
  pro: { conversations: 10000, price: 999 },
};

const TOPUPS = [
  { key: 'topup_50', label: '50', price: 19 },
  { key: 'topup_200', label: '200', price: 59 },
  { key: 'topup_1000', label: '1,000', price: 199 },
  { key: 'topup_5000', label: '5,000', price: 799 },
];

export default async function BillingPage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const m = await db.query.merchants.findFirst({ where: eq(merchants.id, session.merchant.id) });
  const kpis = await computeKpis({ merchantId: session.merchant.id, days: 30 });
  const quota = PLAN_QUOTA[session.merchant.plan] ?? PLAN_QUOTA.starter;

  let invoices: Array<{ id: string; created: number; total: number; status: string | null; pdf: string | null }> = [];
  if (m?.stripeCustomerId) {
    const list = await stripe.invoices.list({ customer: m.stripeCustomerId, limit: 12 });
    invoices = list.data.map((inv) => ({ id: inv.id, created: inv.created, total: inv.total, status: inv.status, pdf: inv.invoice_pdf ?? null }));
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <h1 className="text-2xl font-semibold">Billing</h1>

      <Card>
        <CardHeader><CardTitle>{session.merchant.plan} — ${quota.price}/mo</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{kpis.conversations} / {quota.conversations} conversations used this period</span>
              <span>{((kpis.conversations / quota.conversations) * 100).toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-zinc-900" style={{ width: `${Math.min(100, (kpis.conversations / quota.conversations) * 100)}%` }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span>{(kpis.voiceRatio * 100).toFixed(0)}% voice {kpis.voiceRatio > 0.2 && '— surcharge active'}</span>
              <span>{kpis.voiceRatio > 0.2 ? `$0.30 × ${kpis.voiceConversations} = $${(kpis.voiceConversations * 0.3).toFixed(2)}` : '—'}</span>
            </div>
            <div className="h-2 bg-zinc-100 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500" style={{ width: `${Math.min(100, kpis.voiceRatio * 100 / 0.4 * 100)}%` }} />
            </div>
          </div>
          <form action="/api/billing/portal-session" method="post">
            <Button type="submit">Manage billing</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Top-up packs</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {TOPUPS.map((t) => (
            <form key={t.key} action="/api/billing/topup" method="post">
              <input type="hidden" name="topup_key" value={t.key} />
              <Button type="submit" variant="outline" className="w-full flex flex-col h-auto py-3">
                <span className="font-semibold">{t.label}</span>
                <span className="text-xs text-zinc-500">${t.price}</span>
              </Button>
            </form>
          ))}
          <p className="col-span-full text-xs text-zinc-500">Top-up balance: <strong>{m?.topupBalance ?? 0}</strong></p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Auto-recharge</CardTitle></CardHeader>
        <CardContent>
          <form action={saveAutoRecharge} className="flex flex-col gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" name="enabled" defaultChecked={m?.autoRechargeEnabled ?? false} />
              Enable auto-recharge
            </label>
            <label className="flex flex-col gap-1">
              <span>Trigger when fewer than</span>
              <input name="threshold" type="number" min={1} max={1000} defaultValue={m?.autoRechargeThreshold ?? 10} className="border rounded px-2 py-1 w-32" />
              <span className="text-xs text-zinc-500">conversations remaining</span>
            </label>
            <label className="flex flex-col gap-1">
              <span>Recharge with</span>
              <select name="pack_size" defaultValue={m?.autoRechargePackSize ?? 200} className="border rounded px-2 py-1 w-40">
                <option value={50}>50 ($19)</option>
                <option value={200}>200 ($59)</option>
                <option value={1000}>1,000 ($199)</option>
                <option value={5000}>5,000 ($799)</option>
              </select>
            </label>
            <Button type="submit" className="self-start">Save</Button>
            <p className="text-xs text-zinc-500">Hard cap: 3 auto-recharges per billing period.</p>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Invoices</CardTitle></CardHeader>
        <CardContent className="px-0">
          {invoices.length === 0 ? (
            <p className="px-6 py-4 text-sm text-zinc-500">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-zinc-500">
                <tr className="border-b"><th className="px-6 py-2 text-left">Date</th><th className="text-left">Amount</th><th className="text-left">Status</th><th className="text-left">PDF</th></tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b last:border-0">
                    <td className="px-6 py-2">{new Date(inv.created * 1000).toLocaleDateString()}</td>
                    <td>${(inv.total / 100).toFixed(2)}</td>
                    <td>{inv.status}</td>
                    <td>{inv.pdf ? <a href={inv.pdf} className="underline">Download</a> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
