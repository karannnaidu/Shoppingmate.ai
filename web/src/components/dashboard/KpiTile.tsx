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
        <p className="text-sm text-zinc-500">{label}</p>
        <p className="text-3xl font-semibold mt-1 tabular-nums">{value}</p>
        {pct && (
          <p className={cn('text-xs mt-2', delta != null && delta >= 0 ? 'text-emerald-600' : 'text-red-600')}>
            {arrow} {pct} vs prev period
          </p>
        )}
        {hint && <p className="text-xs text-zinc-500 mt-2">{hint}</p>}
      </CardContent>
    </Card>
  );
}
