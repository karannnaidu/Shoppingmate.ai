'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';

// Calmosis-only features (e.g. doctor consultations) gate on this merchant id.
const CALMOSIS_MERCHANT_ID = 'SM-2SCCLZ';

const BASE_NAV = [
  { href: '/app', label: 'Home' },
  { href: '/app/conversations', label: 'Conversations' },
  { href: '/app/intents', label: 'Intents' },
  { href: '/app/audience', label: 'Audience' },
  { href: '/app/audit', label: 'Audit' },
  { href: '/app/cases', label: 'Customer requests' },
  { href: '/app/knowledge', label: 'Knowledge' },
  { href: '/app/site-graph', label: 'Your website' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/billing', label: 'Billing' },
];

function navItems(merchantId?: string) {
  // Consultations is a Calmosis-only feature — show the link only for that tenant.
  return merchantId === CALMOSIS_MERCHANT_ID
    ? [BASE_NAV[0], BASE_NAV[1], { href: '/app/consultations', label: 'Consultations' }, ...BASE_NAV.slice(2)]
    : BASE_NAV;
}

function NavLinks({
  nav,
  pathname,
  onNavigate,
}: {
  nav: { href: string; label: string }[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {nav.map((item) => {
        const active = pathname === item.href || (item.href !== '/app' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-foreground text-background'
                : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function Sidebar({ pathname, merchantId }: { pathname: string; merchantId?: string }) {
  const [open, setOpen] = useState(false);
  const nav = navItems(merchantId);

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="relative z-10 hidden md:flex flex-col gap-1 p-4 w-60 border-r border-border bg-surface/60 backdrop-blur-sm h-screen sticky top-0">
        <Link href="/app" className="px-2 py-3 mb-2">
          <Logo />
        </Link>
        <NavLinks nav={nav} pathname={pathname} />
      </nav>

      {/* Mobile top bar */}
      <div className="md:hidden relative z-10 flex items-center justify-between border-b border-border bg-surface/60 backdrop-blur-sm px-4 py-3">
        <Link href="/app" aria-label="Home">
          <Logo />
        </Link>
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className="rounded-md p-2 text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <nav className="absolute left-0 top-0 h-full w-64 max-w-[80%] flex flex-col gap-1 p-4 border-r border-border bg-surface shadow-xl animate-[slideIn_180ms_ease-out]">
            <div className="flex items-center justify-between px-2 py-3 mb-2">
              <Logo />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <NavLinks nav={nav} pathname={pathname} onNavigate={() => setOpen(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
