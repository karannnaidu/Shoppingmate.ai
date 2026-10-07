export function CountedBars({
  title,
  rows,
  emptyLabel,
}: {
  /** Optional — omit when the surrounding card already has a title. */
  title?: string;
  rows: { key: string; count: number }[];
  emptyLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      {title && <h2 className="mb-1 font-display text-lg font-semibold text-text-primary">{title}</h2>}
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{emptyLabel ?? 'No data yet'}</p>
      ) : (
        <div className="mt-1 flex flex-col gap-3.5">
          {rows.map((r, i) => (
            <div key={r.key}>
              <div className="mb-1.5 flex justify-between gap-3 text-sm">
                <span className="text-text-secondary first-letter:uppercase">{r.key.replace(/_/g, ' ')}</span>
                <span className="font-semibold tabular-nums text-text-primary">{r.count}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="meter-in h-full rounded-full bg-gradient-to-r from-violet to-violet/60"
                  style={{ width: `${Math.max(2, (r.count / max) * 100)}%`, animationDelay: `${i * 60}ms` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
