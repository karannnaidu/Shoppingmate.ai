import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

// V2 dashboard building blocks. Owner-first: every page opens with a title and
// one sentence on what it's for; every number carries a plain-English hint.

export function DashHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: string;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">{eyebrow}</p>}
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-[-0.03em] text-text-primary md:text-[2rem]">
          {title}
        </h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  delta,
  href,
  tone = 'default',
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  /** Pre-formatted change vs the previous period, e.g. "+18%" / "−3". */
  delta?: { text: string; good: boolean } | null;
  href?: string;
  tone?: 'default' | 'signal';
}) {
  const body = (
    <div
      className={cn(
        'card-v2 group relative h-full overflow-hidden p-4 sm:p-5',
        href && 'card-v2-hover',
      )}
    >
      {tone === 'signal' && (
        <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-signal/15 blur-2xl" aria-hidden />
      )}
      <div className="relative flex items-center gap-2 text-[13px] font-medium text-text-secondary">
        <span
          className={cn(
            'grid h-7 w-7 place-items-center rounded-lg',
            tone === 'signal' ? 'bg-signal-soft text-signal' : 'bg-surface-muted text-text-secondary',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        {label}
      </div>
      <div className="relative mt-4 flex items-baseline gap-2">
        <span className="font-display text-[1.6rem] font-semibold leading-none tracking-[-0.03em] tabular-nums text-text-primary sm:text-[2rem]">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums',
              delta.good ? 'bg-signal-soft text-signal' : 'bg-rose-500/10 text-rose-500',
            )}
          >
            {delta.text}
          </span>
        )}
      </div>
      {hint && <p className="relative mt-2 text-[13px] leading-snug text-text-muted max-sm:hidden">{hint}</p>}
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-[1.25rem] focus-visible:outline-offset-4">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Section({
  title,
  description,
  action,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('card-v2 p-5 md:p-6', className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em] text-text-primary">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <div className="relative grid h-12 w-12 place-items-center rounded-2xl border border-border bg-surface-muted text-text-muted">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-4 font-medium text-text-primary">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-relaxed text-text-secondary">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const BADGE_TONES = {
  neutral: 'border-border bg-surface-muted text-text-secondary',
  signal: 'border-signal/25 bg-signal-soft text-signal',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  rose: 'border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400',
  violet: 'border-violet/25 bg-violet/10 text-violet',
} as const;

export function Badge({ tone = 'neutral', children }: { tone?: keyof typeof BADGE_TONES; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] font-medium', BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function Meter({ value, max, tone = 'auto' }: { value: number; max: number; tone?: 'auto' | 'violet' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const color =
    tone === 'violet' ? 'bg-violet' : pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : 'bg-signal';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('meter-in h-full rounded-full', color)} style={{ width: `${Math.max(pct, 2)}%` }} />
    </div>
  );
}

/** "+18%" style delta between two periods; null when there's no baseline. */
export function pctDelta(now: number, prev: number): { text: string; good: boolean } | null {
  if (prev <= 0) return null;
  const d = (now - prev) / prev;
  if (Math.abs(d) < 0.005) return { text: '±0%', good: true };
  return { text: `${d > 0 ? '+' : '−'}${Math.round(Math.abs(d) * 100)}%`, good: d > 0 };
}
