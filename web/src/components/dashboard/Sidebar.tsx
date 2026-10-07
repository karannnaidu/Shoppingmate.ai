'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  BookOpen,
  CreditCard,
  Globe,
  Home,
  Inbox,
  LifeBuoy,
  Lightbulb,
  type LucideIcon,
  Menu,
  MessageCircle,
  Receipt,
  Settings,
  Stethoscope,
  Target,
  Ticket,
  Users,
  X,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { ThemeToggle } from '@/components/ThemeToggle';
import { cn } from '@/lib/cn';

// Calmosis-only features (e.g. doctor consultations) gate on this merchant id.
const CALMOSIS_MERCHANT_ID = 'SM-2SCCLZ';

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };
type Group = { label?: string; items: Item[] };

function navGroups(merchantId?: string, openRequests = 0, opsAdmin = false, service = false): Group[] {
  const selling: Item[] = [
    { href: '/app/conversations', label: 'Conversations', icon: MessageCircle },
    { href: '/app/cases', label: service ? 'Bookings & requests' : 'Customer requests', icon: Inbox, badge: openRequests },
    // Consultations is a Calmosis-only feature — show the link only for that tenant.
    ...(merchantId === CALMOSIS_MERCHANT_ID
      ? [{ href: '/app/consultations', label: 'Consultations', icon: Stethoscope }]
      : []),
    // Clinics, restaurants, salons, services take bookings, not online orders.
    ...(service
      ? []
      : [
          { href: '/app/audit', label: 'Orders', icon: Receipt },
          { href: '/app/revenue', label: 'Revenue', icon: BarChart3 },
        ]),
  ];
  return [
    { items: [{ href: '/app', label: 'Home', icon: Home }] },
    { label: service ? 'Customers' : 'Selling', items: selling },
    {
      label: 'Understand',
      items: [
        { href: '/app/insights', label: 'Insights', icon: Lightbulb },
        { href: '/app/intents', label: service ? 'What visitors want' : 'What shoppers want', icon: Target },
        { href: '/app/audience', label: service ? 'Visitors' : 'Shoppers', icon: Users },
      ],
    },
    {
      label: 'Set up',
      items: [
        { href: '/app/site-graph', label: 'Your website', icon: Globe },
        { href: '/app/knowledge', label: 'Knowledge', icon: BookOpen },
        { href: '/app/settings', label: 'Settings', icon: Settings },
        { href: '/app/billing', label: 'Billing', icon: CreditCard },
        { href: '/app/help', label: 'Help & requests', icon: LifeBuoy },
      ],
    },
    // Internal: our team's view of every brand's tickets.
    ...(opsAdmin ? [{ label: 'shoppingmate team', items: [{ href: '/app/ops/tickets', label: 'Brand tickets', icon: Ticket }] }] : []),
  ];
}

export type SidebarStore = {
  name: string;
  plan: string;
  used: number;
  allowance: number;
};

function NavLinks({ groups, pathname, onNavigate }: { groups: Group[]; pathname: string; onNavigate?: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      {groups.map((g, gi) => (
        <div key={g.label ?? gi} className="flex flex-col gap-0.5">
          {g.label && (
            <p className="mb-1 px-3 font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-muted">{g.label}</p>
          )}
          {g.items.map((item) => {
            const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  'group relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors',
                  active
                    ? 'bg-surface-elevated text-text-primary shadow-[inset_0_1px_0_var(--highlight),var(--shadow-sm)] ring-1 ring-border'
                    : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
                )}
              >
                {active && <span className="absolute -left-3 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-violet" aria-hidden />}
                <item.icon
                  className={cn('h-4 w-4 flex-none', active ? 'text-violet' : 'text-text-muted group-hover:text-text-secondary')}
                />
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1.5 text-[11px] font-semibold tabular-nums text-black">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function StoreCard({ store }: { store: SidebarStore }) {
  const pct = store.allowance > 0 ? Math.min(100, Math.round((store.used / store.allowance) * 100)) : 0;
  const color = pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-signal';
  return (
    <Link href="/app/billing" className="card-v2 card-v2-hover block p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[13px] font-semibold text-text-primary">{store.name}</p>
        <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium capitalize text-text-secondary">
          {store.plan}
        </span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div className={cn('meter-in h-full rounded-full', color)} style={{ width: `${Math.max(pct, 3)}%` }} />
      </div>
      <p className="mt-2 text-[12px] text-text-muted">
        <span className="font-medium tabular-nums text-text-secondary">{store.used}</span> of{' '}
        <span className="tabular-nums">{store.allowance}</span> conversations this month
      </p>
    </Link>
  );
}

export function Sidebar({
  pathname,
  merchantId,
  store,
  openRequests = 0,
  opsAdmin = false,
  service = false,
}: {
  pathname: string;
  merchantId?: string;
  store?: SidebarStore;
  openRequests?: number;
  opsAdmin?: boolean;
  /** Bookings/enquiries business (clinic, restaurant, salon, services). */
  service?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const groups = navGroups(merchantId, openRequests, opsAdmin, service);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="sticky top-0 z-10 hidden h-screen w-64 flex-none flex-col border-r border-border bg-surface/70 px-3 pb-4 pt-5 backdrop-blur-xl md:flex">
        <Link href="/app" className="mb-6 px-3">
          <Logo />
        </Link>
        <div className="-mr-1 flex-1 overflow-y-auto pr-1">
          <NavLinks groups={groups} pathname={pathname} />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          {store && <StoreCard store={store} />}
          <div className="flex items-center justify-between px-1">
            <span className="text-[12px] text-text-muted">Help: hello@shoppingmate.ai</span>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface/80 px-4 py-3 backdrop-blur-xl md:hidden">
        <Link href="/app" aria-label="Home">
          <Logo />
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-xl border border-border bg-surface-elevated text-text-secondary transition-colors hover:text-text-primary"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <nav className="absolute left-0 top-0 flex h-full w-72 max-w-[85%] animate-[slideIn_200ms_ease-out] flex-col border-r border-border bg-surface px-3 pb-4 pt-4 shadow-xl">
            <div className="mb-5 flex items-center justify-between px-3">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-xl text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <NavLinks groups={groups} pathname={pathname} onNavigate={() => setOpen(false)} />
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {store && <StoreCard store={store} />}
              <div className="flex justify-end px-1">
                <ThemeToggle />
              </div>
            </div>
          </nav>
        </div>
      )}
    </>
  );
}
