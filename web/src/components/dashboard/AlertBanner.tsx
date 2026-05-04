'use client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

type AlertProps = {
  id: string;
  kind: 'override_failing' | 'smoke_failing' | 'catalog_drift' | 'payment_failed';
  severity: 'info' | 'warning' | 'critical';
  payload: Record<string, unknown>;
};

const SEVERITY_STYLES: Record<AlertProps['severity'], string> = {
  info: 'bg-cyan/10 border-cyan/30 text-cyan',
  warning: 'bg-amber-500/10 border-amber-500/30 text-amber-500',
  critical: 'bg-rose-500/10 border-rose-500/30 text-rose-500',
};

export function AlertBanner({ alert }: { alert: AlertProps | null }) {
  if (!alert) return null;

  let copy: React.ReactNode;
  let action: React.ReactNode;

  switch (alert.kind) {
    case 'override_failing': {
      const key = (alert.payload.selector_key as string) ?? 'unknown';
      copy = <>Your <code className="rounded bg-foreground/10 px-1 font-mono text-xs">{key}</code> selector is failing — accept the suggested fix?</>;
      action = (
        <form action={`/api/alerts/${alert.id}/accept`} method="post">
          <Button size="sm" type="submit">Accept fix</Button>
        </form>
      );
      break;
    }
    case 'smoke_failing':
      copy = <>Your widget can&apos;t add items to cart. Catalog or selectors are broken.</>;
      action = <a href={`/app/diagnostics?alert=${alert.id}`} className="text-sm font-medium underline-offset-4 hover:underline">View details</a>;
      break;
    case 'catalog_drift':
      copy = <>Your catalog hasn&apos;t synced in 24h.</>;
      action = (
        <form action="/api/merchant/resync" method="post">
          <Button size="sm" type="submit" variant="outline">Re-sync now</Button>
        </form>
      );
      break;
    case 'payment_failed':
      copy = <>Your last invoice failed. Update payment to keep your widget live.</>;
      action = <a href="/app/billing" className="text-sm font-medium underline-offset-4 hover:underline">Update payment</a>;
      break;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn('flex items-center justify-between gap-4 border-b px-6 py-3', SEVERITY_STYLES[alert.severity])}
    >
      <div className="text-sm">{copy}</div>
      <div>{action}</div>
    </div>
  );
}
