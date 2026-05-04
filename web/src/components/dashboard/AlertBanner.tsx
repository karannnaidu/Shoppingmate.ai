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
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  critical: 'bg-red-50 border-red-200 text-red-900',
};

export function AlertBanner({ alert }: { alert: AlertProps | null }) {
  if (!alert) return null;

  let copy: React.ReactNode;
  let action: React.ReactNode;

  switch (alert.kind) {
    case 'override_failing': {
      const key = (alert.payload.selector_key as string) ?? 'unknown';
      copy = <>Your <code className="px-1 bg-white/50 rounded">{key}</code> selector is failing — accept the suggested fix?</>;
      action = (
        <form action={`/api/alerts/${alert.id}/accept`} method="post">
          <Button size="sm" type="submit">Accept fix</Button>
        </form>
      );
      break;
    }
    case 'smoke_failing':
      copy = <>Your widget can&apos;t add items to cart. Catalog or selectors are broken.</>;
      action = <a href={`/app/diagnostics?alert=${alert.id}`} className="underline text-sm font-medium">View details</a>;
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
      action = <a href="/app/billing" className="underline text-sm font-medium">Update payment</a>;
      break;
  }

  return (
    <div className={cn('flex items-center justify-between gap-4 border-b px-6 py-3', SEVERITY_STYLES[alert.severity])}>
      <div className="text-sm">{copy}</div>
      <div>{action}</div>
    </div>
  );
}
