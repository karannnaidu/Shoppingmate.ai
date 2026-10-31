'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/cn';

// Multi-page site: every tab is its own page.
const LINKS = [
  { href: '/features', label: 'Features' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/platforms', label: 'Platforms' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/faq', label: 'FAQ' },
  { href: '/changelog', label: 'Changelog' },
];

function Wordmark() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="shoppingmate home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/shoppingmate-icon.png" alt="" className="h-7 w-7 rounded-lg object-cover" />
      <span className="text-[16px] font-semibold tracking-[-0.02em] text-[#0b0b10]">shoppingmate</span>
    </Link>
  );
}

// Floating glass pill (Fastlane-style): it tightens and lifts once you scroll.
export function MkNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center px-3 pt-3 sm:pt-4">
      <nav
        aria-label="Main"
        className={cn(
          'pointer-events-auto flex w-full items-center justify-between gap-4 rounded-full border px-3 py-2 pl-5 transition-all duration-300',
          scrolled
            ? 'max-w-[1000px] border-[#e8e8ee] bg-white/80 shadow-[0_10px_40px_-12px_rgba(11,11,16,0.25)] backdrop-blur-xl'
            : 'max-w-[1200px] border-transparent bg-white/0',
        )}
      >
        <Wordmark />
        <ul className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                aria-current={pathname === l.href ? 'page' : undefined}
                className={cn(
                  'rounded-full px-3 py-2 text-[14px] font-medium transition-colors hover:text-[#0b0b10]',
                  pathname === l.href ? 'bg-[#f2f2f6] text-[#0b0b10]' : 'text-[#4a4a55]',
                )}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-1.5">
          <Link href="/login" className="hidden rounded-full px-3 py-2 text-[14px] font-medium text-[#4a4a55] hover:text-[#0b0b10] sm:inline-flex">
            Log in
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-10 items-center rounded-full bg-[#0b0b10] px-4 text-[14px] font-medium text-white transition-colors hover:bg-[#23232b]"
          >
            Get started
          </Link>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="grid h-10 w-10 place-items-center rounded-full text-[#0b0b10] hover:bg-[#f2f2f6] lg:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>
      {open && (
        <div
          className="pointer-events-auto fixed inset-x-3 top-[72px] rounded-3xl border border-[#e8e8ee] bg-white p-3 shadow-[0_24px_60px_-20px_rgba(11,11,16,0.35)] lg:hidden"
          style={{ animation: 'mk-rise 0.25s ease both' }}
        >
          {[...LINKS, { href: '/login', label: 'Log in' }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              aria-current={pathname === l.href ? 'page' : undefined}
              className={cn('block rounded-2xl px-4 py-3.5 text-[17px] font-medium text-[#0b0b10] hover:bg-[#f5f5f7]', pathname === l.href && 'bg-[#f5f5f7]')}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
