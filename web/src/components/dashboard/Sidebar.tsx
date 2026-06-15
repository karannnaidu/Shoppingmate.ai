import Link from 'next/link';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';

// Calmosis-only features (e.g. doctor consultations) gate on this merchant id.
const CALMOSIS_MERCHANT_ID = 'SM-2SCCLZ';

const BASE_NAV = [
  { href: '/app', label: 'Home' },
  { href: '/app/conversations', label: 'Conversations' },
  { href: '/app/audit', label: 'Audit' },
  { href: '/app/knowledge', label: 'Knowledge' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/billing', label: 'Billing' },
];

export function Sidebar({ pathname, merchantId }: { pathname: string; merchantId?: string }) {
  // Consultations is a Calmosis-only feature — show the link only for that tenant.
  const nav =
    merchantId === CALMOSIS_MERCHANT_ID
      ? [
          BASE_NAV[0],
          BASE_NAV[1],
          { href: '/app/consultations', label: 'Consultations' },
          ...BASE_NAV.slice(2),
        ]
      : BASE_NAV;

  return (
    <nav className="relative z-10 flex flex-col gap-1 p-4 w-60 border-r border-border bg-surface/60 backdrop-blur-sm h-screen sticky top-0">
      <Link href="/app" className="px-2 py-3 mb-2">
        <Logo />
      </Link>
      {nav.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/app' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
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
    </nav>
  );
}
