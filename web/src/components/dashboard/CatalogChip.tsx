import Link from 'next/link';
import { cn } from '@/lib/cn';

export function CatalogChip({ syncedAt, productCount }: { syncedAt: Date | null; productCount: number }) {
  const hours = syncedAt ? (Date.now() - syncedAt.getTime()) / 3600000 : Infinity;
  const tone = hours > 24 ? 'red' : hours > 6 ? 'amber' : 'green';
  const label = !syncedAt
    ? 'Catalog never synced'
    : hours > 24
      ? `Catalog stale — ${Math.floor(hours)}h ago`
      : `Synced ${formatAgo(syncedAt)} — ${productCount} products`;
  return (
    <Link
      href="/app/settings"
      className={cn(
        'inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border font-medium transition-colors',
        tone === 'green' && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/15',
        tone === 'amber' && 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/15',
        tone === 'red' && 'bg-rose-500/10 border-rose-500/30 text-rose-500 hover:bg-rose-500/15',
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full animate-pulse', tone === 'green' ? 'bg-emerald-500' : tone === 'amber' ? 'bg-amber-500' : 'bg-rose-500')} />
      {label}
    </Link>
  );
}

function formatAgo(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)} h ago`;
}
