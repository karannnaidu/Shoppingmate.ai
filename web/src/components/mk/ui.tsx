'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Phone } from 'lucide-react';
import { cn } from '@/lib/cn';

// Marketing primitives (2026-10-31 redesign). White canvas, near-black ink and
// ONE accent (violet) used only for actions and highlights.

export const OLIVIA_AVATAR = '/widget/personas/concierge.png';

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('mx-auto w-full max-w-[1200px] px-5 sm:px-8', className)}>{children}</div>;
}

export function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('mb-4 text-[15px] font-medium text-[var(--mk-accent)]', className)}>{children}</p>
  );
}

export function H2({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn('mk-h2 text-balance text-[clamp(34px,5vw,64px)] text-[#0b0b10]', className)}>{children}</h2>;
}

export function Lead({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn('text-[clamp(17px,1.6vw,20px)] leading-[1.55] text-[#4a4a55]', className)}>{children}</p>;
}

type BtnProps = { href?: string; onClick?: () => void; children: React.ReactNode; className?: string; size?: 'md' | 'lg' };

export function AccentButton({ href, onClick, children, className, size = 'lg' }: BtnProps) {
  const cls = cn(
    'group inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[var(--mk-accent)] font-semibold text-white shadow-[var(--mk-glow)] transition-[transform,filter] duration-200 hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mk-accent)]',
    size === 'lg' ? 'h-14 px-7 text-[17px]' : 'h-11 px-5 text-[15px]',
    className,
  );
  const inner = (
    <>
      {children}
      <ArrowRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
    </>
  );
  return href ? (
    <Link href={href} className={cls}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}

export function InkButton({ href, onClick, children, className, size = 'md' }: BtnProps) {
  const cls = cn(
    'inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b0b10] font-medium text-white transition-[transform,background] duration-200 hover:bg-[#23232b] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0b0b10]',
    size === 'lg' ? 'h-14 px-7 text-[17px]' : 'h-10 px-4 text-[14px]',
    className,
  );
  return href ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/** Opens the live Olivia call on this page (the widget listens for this event). */
export function openOlivia(mode: 'call' | 'chat' = 'call') {
  window.dispatchEvent(new CustomEvent('shoppingmate:open', { detail: { mode } }));
}

export function TalkButton({ className, label = 'Talk to Olivia now' }: { className?: string; label?: string }) {
  return (
    <button
      type="button"
      onClick={() => openOlivia('call')}
      className={cn(
        'inline-flex h-14 items-center justify-center gap-3 rounded-2xl border border-[#e8e8ee] bg-white px-6 text-[17px] font-semibold text-[#0b0b10] shadow-[0_1px_2px_rgba(11,11,16,0.05)] transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[#cfcfd8] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mk-accent)]',
        className,
      )}
    >
      <span className="relative grid h-8 w-8 place-items-center rounded-full bg-[#16a34a] text-white">
        <Phone className="h-4 w-4" aria-hidden />
        <span className="absolute inset-0 rounded-full ring-4 ring-[#16a34a]/20" aria-hidden />
      </span>
      {label}
    </button>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-[22px] border border-[#ececf2] bg-white shadow-[var(--mk-panel-shadow)]', className)}>
      {children}
    </div>
  );
}

export function ExampleTag({ className }: { className?: string }) {
  return (
    <span className={cn('rounded-full bg-[#f2f2f6] px-2 py-0.5 text-[11px] font-medium text-[#6e6e7a]', className)}>
      Example
    </span>
  );
}

/** Fades content up the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn('mk-reveal', inView && 'is-in', className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/**
 * Phones: a swipeable row with scroll-snap, a peek of the next card and dots
 * that follow the swipe. From `lg` up it is a plain grid (pass the grid classes
 * via `desktopClass`). `startIndex` centres a card on first paint (no page jump).
 */
export function Carousel({
  children,
  desktopClass,
  itemClass = 'w-[86%] sm:w-[58%]',
  startIndex = 0,
  label,
  spans,
}: {
  children: React.ReactNode[];
  desktopClass: string;
  itemClass?: string;
  startIndex?: number;
  label: string;
  /** Per-card desktop grid classes, e.g. lg:col-span-4. */
  spans?: string[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(startIndex);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const first = el.children[startIndex] as HTMLElement | undefined;
    if (first && startIndex > 0 && window.matchMedia('(max-width: 1023px)').matches) {
      el.scrollLeft = first.offsetLeft - (el.clientWidth - first.clientWidth) / 2;
    }
    const onScroll = () => {
      const kids = Array.from(el.children) as HTMLElement[];
      const mid = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestD = Infinity;
      kids.forEach((k, i) => {
        const d = Math.abs(k.offsetLeft + k.clientWidth / 2 - mid);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      });
      setActive(best);
    };
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [startIndex]);
  return (
    <div>
      <div
        ref={ref}
        role="region"
        aria-label={label}
        className={cn(
          '-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] sm:-mx-8 sm:px-8 [&::-webkit-scrollbar]:hidden',
          'lg:mx-0 lg:overflow-visible lg:px-0 lg:pb-0',
          desktopClass,
        )}
      >
        {children.map((c, i) => (
          <div key={i} className={cn('shrink-0 snap-center lg:w-auto lg:shrink', itemClass, spans?.[i])}>
            {c}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-center gap-1.5 lg:hidden" aria-hidden>
        {children.map((_, i) => (
          <span key={i} className={cn('h-1.5 rounded-full transition-all duration-300', i === active ? 'w-6 bg-[#0b0b10]' : 'w-1.5 bg-[#d6d6de]')} />
        ))}
      </div>
    </div>
  );
}
