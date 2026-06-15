import type { Funnel } from '@/lib/funnel-repo';

const pct = (n: number) => `${Math.round(n * 100)}%`;

export function FunnelCard({ funnel }: { funnel: Funnel }) {
  const steps: { label: string; value: number; rate: number | null }[] = [
    { label: 'Conversations', value: funnel.conversations, rate: null },
    { label: 'Added to cart', value: funnel.cartAdds, rate: funnel.cartRate },
    { label: 'Reached checkout', value: funnel.checkoutReached, rate: funnel.checkoutRate },
    { label: 'Purchased', value: funnel.purchases, rate: funnel.purchaseRate },
  ];
  const max = Math.max(funnel.conversations, 1);

  return (
    <div className="rounded-lg border border-border bg-surface/60 p-5">
      <h2 className="mb-1 font-display text-lg font-semibold text-text-primary">Bot-driven funnel · 7d</h2>
      <p className="mb-4 text-xs text-text-secondary">
        How far the assistant moves visitors: conversation → cart → checkout → purchase.
      </p>
      <div className="flex flex-col gap-3">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex justify-between text-sm">
              <span className="text-text-secondary">{s.label}</span>
              <span className="font-medium text-text-primary">
                {s.value}
                {s.rate != null ? ` · ${pct(s.rate)}` : ''}
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted">
              <div
                className="h-2 rounded-full bg-violet transition-all"
                style={{ width: `${Math.max(2, (s.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
