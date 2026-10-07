import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import type { AudienceRow } from '@/lib/audience-repo';
import { formatMoney } from '@/lib/format-money';
import { Badge, EmptyState } from './v2';

function visitorLabel(r: AudienceRow): string {
  return r.name ?? `Shopper ${r.visitorId.replace(/^v_/, '').slice(0, 4).toUpperCase()}`;
}
function human(s: string): string {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function lastSeen(d: Date): string {
  const days = Math.floor((Date.now() - d.getTime()) / 86400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
const OUTCOME: Record<string, { label: string; tone: 'signal' | 'neutral' | 'violet' }> = {
  purchased: { label: 'Ordered', tone: 'signal' },
  abandoned: { label: 'Left without buying', tone: 'neutral' },
  in_progress: { label: 'Still browsing', tone: 'violet' },
};

export function AudienceTable({ rows, currency = 'USD' }: { rows: AudienceRow[]; currency?: string }) {
  if (rows.length === 0) {
    return (
      <div className="card-v2">
        <EmptyState
          icon={Users}
          title="No shoppers yet"
          body="Everyone who talks to your assistant appears here, with what they were looking for — so you can follow up with the ones who were close."
        />
      </div>
    );
  }
  return (
    <section className="card-v2 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50 text-left text-[11.5px] font-medium uppercase tracking-wider text-text-muted">
              <th className="px-5 py-2.5 font-medium">Shopper</th>
              <th className="px-3 py-2.5 font-medium">Visits</th>
              <th className="px-3 py-2.5 font-medium">Interested in</th>
              <th className="px-3 py-2.5 font-medium">Spent</th>
              <th className="px-3 py-2.5 font-medium">Last time</th>
              <th className="px-3 py-2.5 font-medium">Last seen</th>
              <th className="px-5 py-2.5" aria-hidden />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const o = r.lastOutcome ? OUTCOME[r.lastOutcome] : undefined;
              return (
                <tr key={r.visitorId} className="group transition-colors hover:bg-surface-muted/50">
                  <td className="px-5 py-3">
                    <Link href={`/app/audience/${r.visitorId}`} className="font-medium text-text-primary hover:underline">
                      {visitorLabel(r)}
                    </Link>
                    {r.city && <span className="block text-xs text-text-muted">{r.city}</span>}
                  </td>
                  <td className="px-3 py-3">
                    <span className="tabular-nums">{r.sessionCount}</span>
                    {r.sessionCount > 1 && (
                      <span className="ml-2">
                        <Badge tone="violet">Came back</Badge>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">{r.topIntents.slice(0, 2).map(human).join(' · ') || '—'}</td>
                  <td className="px-3 py-3 tabular-nums">
                    {r.lifetimeValueCents > 0 ? formatMoney(r.lifetimeValueCents, currency) : <span className="text-text-muted">—</span>}
                  </td>
                  <td className="px-3 py-3">{o ? <Badge tone={o.tone}>{o.label}</Badge> : <span className="text-text-muted">—</span>}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-text-secondary">{lastSeen(r.lastSeen)}</td>
                  <td className="px-5 py-3 text-right">
                    <Link href={`/app/audience/${r.visitorId}`} aria-label={`Open ${visitorLabel(r)}`}>
                      <ChevronRight className="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
