export function CountedBars({
  title,
  rows,
  emptyLabel,
}: {
  title: string;
  rows: { key: string; count: number }[];
  emptyLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.count), 1);
  return (
    <div>
      <h2 className="mb-1 font-display text-lg font-semibold text-text-primary">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-text-secondary">{emptyLabel ?? 'No data yet'}</p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="text-text-secondary">{r.key}</span>
                <span className="font-medium text-text-primary tabular-nums">{r.count}</span>
              </div>
              <div className="h-2 rounded-full bg-surface-muted">
                <div
                  className="h-2 rounded-full bg-violet transition-all"
                  style={{ width: `${Math.max(2, (r.count / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
