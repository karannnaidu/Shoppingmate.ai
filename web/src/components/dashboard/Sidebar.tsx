import Link from 'next/link';
import { cn } from '@/lib/cn';

const NAV = [
  { href: '/app', label: 'Home' },
  { href: '/app/conversations', label: 'Conversations' },
  { href: '/app/knowledge', label: 'Knowledge' },
  { href: '/app/settings', label: 'Settings' },
  { href: '/app/billing', label: 'Billing' },
];

export function Sidebar({ pathname }: { pathname: string }) {
  return (
    <nav className="flex flex-col gap-1 p-4 w-56 border-r border-zinc-200 h-screen sticky top-0">
      <div className="px-2 py-3 font-semibold tracking-tight">shoppingmate</div>
      {NAV.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/app' && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-3 py-2 text-sm font-medium',
              active ? 'bg-zinc-900 text-white' : 'text-zinc-700 hover:bg-zinc-100',
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
