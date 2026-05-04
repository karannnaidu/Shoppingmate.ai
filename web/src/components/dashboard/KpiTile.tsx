import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/cn';

export function KpiTile({
  label, value, delta, hint,
}: { label: string; value: string; delta?: number | null; hint?: string }) {
  const arrow = delta == null ? null : delta >= 0 ? '↑' : '↓';
  const pct = delta == null ? null : `${(Math.abs(delta) * 100).toFixed(0)}%`;
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs uppercase tracking-wide text-text-muted font-medium">{label}</p>
        <p className="font-display text-3xl font-semibold mt-2 tabular-nums tracking-tight text-text-primary">{value}</p>
        {pct && (
          <p className={cn('text-xs mt-2 font-medium tabular-nums', delta != null && delta >= 0 ? 'text-emerald-500' : 'text-rose-500')}>
            {arrow} {pct} vs prev period
          </p>
        )}
        {hint && <p className="text-xs text-text-secondary mt-2">{hint}</p>}
      </CardContent>
    </Card>
  );
}
