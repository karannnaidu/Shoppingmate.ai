import type { Funnel } from '@/lib/funnel-repo';

const pct = (n: number) => `${Math.round(n * 100)}%`;

// "From chat to order": each step as a bar relative to conversations, with the
// step-to-step drop written out so an owner sees where people stop.
export function FunnelCard({ funnel }: { funnel: Funnel }) {
  const steps: { label: string; value: number; rate: number | null }[] = [
    { label: 'Talked to your assistant', value: funnel.conversations, rate: null },
    { label: 'Added to cart', value: funnel.cartAdds, rate: funnel.cartRate },
    { label: 'Reached checkout', value: funnel.checkoutReached, rate: funnel.checkoutRate },
    { label: 'Ordered', value: funnel.purchases, rate: funnel.purchaseRate },
  ];
  const max = Math.max(funnel.conversations, 1);
  const empty = funnel.conversations === 0;

  return (
    <section className="card-v2 p-5 md:p-6">
      <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">From chat to order</h2>
      <p className="mt-0.5 text-[13px] text-text-muted">Last 7 days · how far shoppers get after talking to your assistant</p>
      <ol className="mt-5 flex flex-col gap-4">
        {steps.map((s, i) => (
          <li key={s.label}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="text-text-secondary">{s.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-semibold tabular-nums text-text-primary">{s.value}</span>
                {/* Cart adds are counted per item, so a step can exceed the one
                    before it — only show the rate when it's a real share. */}
                {s.rate != null && !empty && s.rate <= 1 && (
                  <span className="text-xs tabular-nums text-text-muted">{pct(s.rate)} of previous</span>
                )}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="meter-in h-full rounded-full bg-gradient-to-r from-violet to-signal"
                style={{ width: `${empty ? 0 : Math.min(100, Math.max(3, (s.value / max) * 100))}%`, animationDelay: `${i * 120}ms` }}
              />
            </div>
          </li>
        ))}
      </ol>
      {empty && <p className="mt-4 text-[13px] text-text-muted">This fills in as shoppers talk to your assistant.</p>}
    </section>
  );
}
