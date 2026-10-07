import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  CreditCard,
  Inbox,
  Lightbulb,
  type LucideIcon,
  MessageCircle,
  Mic,
  PackageSearch,
  ShoppingBag,
  TrendingUp,
  Wifi,
} from 'lucide-react';
import { and, desc, eq, sql } from 'drizzle-orm';
import { insightReports, merchants, products } from '@shoppingmate/db/schema';
import { hasFeature } from '@shoppingmate/db/plans';
import { getDashboardSession } from '@/lib/session';
import { computeKpis, conversationsSince } from '@/lib/kpi-repo';
import { computeFunnel } from '@/lib/funnel-repo';
import { recentConversations } from '@/lib/conversations-repo';
import { bookingCounts, caseCounts } from '@/lib/cases-repo';
import { isServiceBusiness } from '@/lib/business-type';
import { formatMoney, merchantCurrency } from '@/lib/money';
import { planCredits } from '@/lib/plan-credits';
import { db } from '@/lib/db';
import { ConversationsTable } from '@/components/dashboard/ConversationsTable';
import { FunnelCard } from '@/components/dashboard/FunnelCard';
import { LivePanel } from '@/components/dashboard/LivePanel';
import { DashHeader, StatCard, pctDelta } from '@/components/dashboard/v2';
import { cn } from '@/lib/cn';

type Need = { icon: LucideIcon; tone: 'amber' | 'rose' | 'violet'; title: string; body: string; href: string; cta: string };

export default async function HomePage() {
  const hdrs = await headers();
  const session = await getDashboardSession({ headers: hdrs });
  if (!session?.merchant) redirect('/app/onboarding?step=2');

  const m = session.merchant;
  const merchantId = m.id;
  const [k7, k14, rows, productCountRow, merchantRow, currency, cases, used30] = await Promise.all([
    computeKpis({ merchantId, days: 7 }),
    computeKpis({ merchantId, days: 14 }),
    recentConversations({ merchantId, limit: 8 }),
    db.select({ count: sql<number>`count(*)::int` }).from(products).where(eq(products.merchantId, merchantId)),
    db.query.merchants.findFirst({ where: eq(merchants.id, merchantId) }),
    merchantCurrency(merchantId).catch(() => 'USD'),
    caseCounts(merchantId).catch(() => ({ open: 0, urgentOpen: 0 })),
    conversationsSince({ merchantId, days: 30 }).catch(() => 0),
  ]);

  const insightsOn = hasFeature({ id: merchantId, plan: m.plan }, 'insights');
  const report = insightsOn
    ? (
        await db
          .select({ fixes: insightReports.fixes })
          .from(insightReports)
          .where(and(eq(insightReports.merchantId, merchantId)))
          .orderBy(desc(insightReports.weekStart))
          .limit(1)
      )[0]
    : undefined;
  const openFixes = (report?.fixes ?? []).filter((f) => f.status !== 'done');

  const funnel = await computeFunnel({
    merchantId,
    days: 7,
    purchases: k7.assistedOrderCount + k7.influencedOrderCount,
  });
  // Clinics, restaurants, salons, services: bookings & enquiries, not orders.
  const service = isServiceBusiness(merchantRow);
  const bookings = service ? await bookingCounts(merchantId, 7).catch(() => ({ requests: 0, requestsPrev: 0, handled: 0 })) : null;

  // This week vs the 7 days before it.
  const sales = k7.assistedRevenueCents + k7.influencedRevenueCents;
  const salesPrev = k14.assistedRevenueCents + k14.influencedRevenueCents - sales;
  const orders = k7.assistedOrderCount + k7.influencedOrderCount;
  const ordersPrev = k14.assistedOrderCount + k14.influencedOrderCount - orders;
  const convos = k7.conversations;
  const convosPrev = k14.conversations - convos;

  const storeName = m.name || m.domain || 'your store';
  const answer =
    convos === 0
      ? bookings
        ? 'No conversations yet this week. As soon as visitors start talking to your assistant, their questions and booking requests show up here.'
        : 'No conversations yet this week. As soon as shoppers start talking to your assistant, the results show up here.'
      : bookings
        ? `Your assistant talked to ${convos} visitor${convos === 1 ? '' : 's'} this week and took ${bookings.requests} booking or quote request${bookings.requests === 1 ? '' : 's'} for your team.`
      : orders > 0
        ? `Your assistant talked to ${convos} shopper${convos === 1 ? '' : 's'} this week and helped close ${orders} order${orders === 1 ? '' : 's'} worth ${formatMoney(sales, currency)}.`
        : `Your assistant talked to ${convos} shopper${convos === 1 ? '' : 's'} this week. No orders traced back to a chat yet.`;

  // "Needs you" — only real, actionable signals.
  const needs: Need[] = [];
  if (cases.open > 0)
    needs.push({
      icon: Inbox,
      tone: cases.urgentOpen > 0 ? 'rose' : 'amber',
      title: `${cases.open} customer request${cases.open === 1 ? '' : 's'} waiting`,
      body: cases.urgentOpen > 0
        ? `${cases.urgentOpen} marked urgent — they're expecting a reply.`
        : service
          ? 'Customers asked to book or for a quote — call them back to confirm.'
          : 'Shoppers left their details and are waiting to hear back.',
      href: '/app/cases',
      cta: 'Reply',
    });
  const allowance = planCredits(m.plan).credits + (m.topupBalance ?? 0);
  const left = Math.max(0, allowance - used30);
  if (allowance > 0 && left / allowance <= 0.2)
    needs.push({
      icon: CreditCard,
      tone: left === 0 ? 'rose' : 'amber',
      title: left === 0 ? 'Out of conversations' : `Only ${left} conversations left this month`,
      body: left === 0 ? "You've used this month's conversations — top up or move up a plan." : 'Top up or move up a plan before you run out.',
      href: '/app/billing',
      cta: 'Top up',
    });
  if (openFixes.length > 0)
    needs.push({
      icon: Lightbulb,
      tone: 'violet',
      title: openFixes[0]!.title,
      body: openFixes.length > 1 ? `${openFixes.length} fixes suggested this week — start with this one.` : openFixes[0]!.impact,
      href: '/app/insights',
      cta: 'See fix',
    });
  const syncedAt = merchantRow?.catalogSyncedAt ? new Date(merchantRow.catalogSyncedAt) : null;
  const productCount = productCountRow[0]?.count ?? 0;
  // A service business has no product list to keep fresh.
  if (!service && (!syncedAt || Date.now() - syncedAt.getTime() > 3 * 86400_000))
    needs.push({
      icon: PackageSearch,
      tone: 'amber',
      title: syncedAt ? 'Product list is out of date' : "Your products haven't been loaded yet",
      body: 'Your assistant answers from your product list — refresh it so prices and stock are right.',
      href: '/app/settings',
      cta: 'Refresh',
    });
  if (merchantRow?.lastError?.startsWith('site_blocks_reader'))
    needs.push({
      icon: Wifi,
      tone: 'amber',
      title: "Your website is blocking our page reader",
      body: 'Your assistant works, but can’t learn your pages. Ask your host (or Cloudflare → Security → Bots) to allow “ShoppingmateBot”, or upload your FAQs and price lists in Knowledge.',
      href: '/app/knowledge',
      cta: 'Upload',
    });
  const ping = m.lastWidgetPing ? new Date(m.lastWidgetPing) : null;
  if (!ping || Date.now() - ping.getTime() > 2 * 86400_000)
    needs.push({
      icon: Wifi,
      tone: 'amber',
      title: "We haven't seen your assistant on your site lately",
      body: 'Check the line is still in your site — if your theme changed, it may have been removed.',
      href: '/app/settings',
      cta: 'Check',
    });

  return (
    <div className="flex flex-col gap-6">
      <DashHeader
        eyebrow={`This week · ${storeName}`}
        title={bookings ? 'Your business this week' : 'Your store this week'}
        description={answer}
        actions={
          bookings ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-signal/25 bg-signal-soft px-3 py-1.5 text-xs font-medium text-signal">
              <span className="h-1.5 w-1.5 rounded-full bg-signal" />
              Taking bookings &amp; enquiries
            </span>
          ) : (
            <span
              className={cn(
                'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium',
                productCount > 0 ? 'border-signal/25 bg-signal-soft text-signal' : 'border-amber-500/25 bg-amber-500/10 text-amber-500',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', productCount > 0 ? 'bg-signal' : 'bg-amber-500')} />
              {productCount > 0 ? `${productCount} products loaded` : 'No products loaded'}
            </span>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {bookings ? (
          <>
            <StatCard
              icon={CalendarCheck}
              tone="signal"
              label="Booking & quote requests"
              value={String(bookings.requests)}
              delta={pctDelta(bookings.requests, bookings.requestsPrev)}
              hint="Customers who asked to book or for a price, via your assistant"
              href="/app/cases"
            />
            <StatCard
              icon={Inbox}
              label="Waiting on you"
              value={String(cases.open)}
              hint={cases.open ? 'Call them back to confirm' : 'Everyone has heard back'}
              href="/app/cases"
            />
          </>
        ) : (
          <>
        <StatCard
          icon={TrendingUp}
          tone="signal"
          label="Sales after a chat"
          value={formatMoney(sales, currency)}
          delta={pctDelta(sales, salesPrev)}
          hint="Orders placed by shoppers who talked to your assistant"
          href="/app/revenue"
        />
        <StatCard
          icon={ShoppingBag}
          label="Orders"
          value={String(orders)}
          delta={pctDelta(orders, ordersPrev)}
          hint={`${k7.assistedOrderCount} placed with the assistant's help`}
          href="/app/audit"
        />
          </>
        )}
        <StatCard
          icon={MessageCircle}
          label="Conversations"
          value={String(convos)}
          delta={pctDelta(convos, convosPrev)}
          hint={bookings ? 'Visitors who talked or typed to your assistant' : 'Shoppers who talked or typed to your assistant'}
          href="/app/conversations"
        />
        <StatCard
          icon={Mic}
          label="By voice"
          value={`${Math.round(k7.voiceRatio * 100)}%`}
          hint={k7.voiceConversations ? `${k7.voiceConversations} of ${convos} chose to talk out loud` : 'No voice calls yet this week'}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <section className="card-v2 p-5 md:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">Needs you</h2>
            {needs.length > 0 && <span className="text-xs text-text-muted">{needs.length} to look at</span>}
          </div>
          {needs.length === 0 ? (
            <div className="flex items-center gap-3 rounded-2xl border border-signal/20 bg-signal-soft px-4 py-4">
              <CheckCircle2 className="h-5 w-5 flex-none text-signal" />
              <div>
                <p className="text-sm font-medium text-text-primary">All clear</p>
                <p className="text-[13px] text-text-secondary">Nothing needs your attention right now. Your assistant is on it.</p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {needs.slice(0, 4).map((n) => (
                <li key={n.title}>
                  <Link
                    href={n.href}
                    className="group flex items-start gap-3 rounded-2xl border border-border bg-surface p-3.5 transition-colors hover:border-border-strong hover:bg-surface-muted/50"
                  >
                    <span
                      className={cn(
                        'grid h-9 w-9 flex-none place-items-center rounded-xl',
                        n.tone === 'rose' && 'bg-rose-500/10 text-rose-500',
                        n.tone === 'amber' && 'bg-amber-500/10 text-amber-500',
                        n.tone === 'violet' && 'bg-violet/10 text-violet',
                      )}
                    >
                      <n.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-text-primary">{n.title}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-text-secondary">{n.body}</span>
                    </span>
                    <span className="mt-1 inline-flex flex-none items-center gap-1 text-[13px] font-medium text-text-secondary transition-colors group-hover:text-text-primary">
                      {n.cta}
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="flex flex-col gap-4">
          <LivePanel currency={currency} service={bookings ? { requestsThisWeek: bookings.requests } : undefined} />
          {bookings ? (
            <FunnelCard
              funnel={funnel}
              title="From chat to booking"
              subtitle="Last 7 days · how many visitors asked to book, and how many your team handled"
              steps={[
                { label: 'Talked to your assistant', value: funnel.conversations, rate: null },
                { label: 'Asked to book or for a quote', value: bookings.requests, rate: funnel.conversations ? bookings.requests / funnel.conversations : null },
                { label: 'Handled by your team', value: bookings.handled, rate: bookings.requests ? bookings.handled / bookings.requests : null },
              ]}
            />
          ) : (
            <FunnelCard funnel={funnel} />
          )}
        </div>
      </div>

      <ConversationsTable
        rows={rows}
        currency={currency}
        action={
          <Link href="/app/conversations" className="inline-flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary">
            See all <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      />
    </div>
  );
}
