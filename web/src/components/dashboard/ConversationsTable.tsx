import Link from 'next/link';
import { ChevronRight, MessageCircle, MessagesSquare, Mic } from 'lucide-react';
import type { ConversationRow } from '@/lib/conversations-repo';
import { formatMoney } from '@/lib/format-money';
import { Badge, EmptyState } from './v2';

function formatDuration(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m}m ${s}s` : `${m}m`;
}

function relTime(d: Date): string {
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}d ago`;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const OUTCOME = {
  purchased: { label: 'Ordered', tone: 'signal' as const },
  abandoned: { label: 'Left without buying', tone: 'neutral' as const },
  in_progress: { label: 'Still browsing', tone: 'violet' as const },
};

export function ConversationsTable({
  rows,
  currency = 'USD',
  title = 'Recent conversations',
  action,
}: {
  rows: ConversationRow[];
  currency?: string;
  title?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="card-v2 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 pb-3 pt-5 md:px-6">
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">{title}</h2>
        {action}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="No conversations yet"
          body="Once your line is on your site and shoppers start talking to your assistant, every conversation shows up here."
        />
      ) : (
        <div role="table" aria-label={title}>
          <div
            role="row"
            className="hidden grid-cols-[1.1fr_0.9fr_0.8fr_1.4fr_0.9fr_24px] gap-4 border-y border-border bg-surface-muted/50 px-6 py-2.5 text-[11.5px] font-medium uppercase tracking-wider text-text-muted md:grid"
          >
            <span role="columnheader">When</span>
            <span role="columnheader">How</span>
            <span role="columnheader">Length</span>
            <span role="columnheader">Result</span>
            <span role="columnheader" className="text-right">
              Sale
            </span>
            <span aria-hidden />
          </div>
          <ul className="divide-y divide-border">
            {rows.map((r, i) => {
              const o = OUTCOME[r.outcome] ?? OUTCOME.in_progress;
              return (
                // A session can be recorded twice (reconnects), so key by position too.
                <li key={`${r.id}-${i}`}>
                  <Link
                    href={`/app/conversations/${r.id}`}
                    className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3.5 transition-colors hover:bg-surface-muted/60 md:grid-cols-[1.1fr_0.9fr_0.8fr_1.4fr_0.9fr_24px] md:px-6"
                  >
                    <span className="text-sm font-medium tabular-nums text-text-primary">{relTime(r.startedAt)}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm text-text-secondary max-md:order-3">
                      {r.mode === 'voice' ? <Mic className="h-3.5 w-3.5" /> : <MessageCircle className="h-3.5 w-3.5" />}
                      <span className="capitalize">{r.mode === 'voice' ? 'voice' : 'chat'}</span>
                      <span className="text-text-muted md:hidden">· {formatDuration(r.durationSec)}</span>
                    </span>
                    <span className="hidden text-sm tabular-nums text-text-secondary md:block">
                      {formatDuration(r.durationSec)}
                    </span>
                    <span className="max-md:order-2 max-md:justify-self-end">
                      <Badge tone={o.tone}>{o.label}</Badge>
                    </span>
                    <span className="hidden text-right text-sm font-medium tabular-nums md:block">
                      {r.attributedCents ? (
                        <span className="text-signal">{formatMoney(r.attributedCents, currency)}</span>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </span>
                    <ChevronRight className="hidden h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5 md:block" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
