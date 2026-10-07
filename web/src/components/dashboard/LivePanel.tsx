'use client';
import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/format-money';

type Snapshot = {
  activeConversations: number;
  conversionsToday: number;
  revenueTodayCents: number;
};

export function LivePanel({ currency = 'USD' }: { currency?: string }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/live')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (alive && d) setSnap(d as Snapshot);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const cell = (value: string, label: string) => (
    <div className="min-w-0">
      <div className="font-display text-2xl font-semibold tabular-nums tracking-tight text-text-primary">{value}</div>
      <div className="mt-0.5 truncate text-xs text-text-muted">{label}</div>
    </div>
  );
  const active = snap?.activeConversations ?? 0;

  return (
    <section className="card-v2 relative overflow-hidden p-5 md:p-6">
      <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-signal/10 blur-2xl" aria-hidden />
      <div className="relative mb-4 flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          {active > 0 && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />}
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active > 0 ? 'bg-signal' : 'bg-text-muted/50'}`} />
        </span>
        <h2 className="font-display text-[17px] font-semibold tracking-[-0.015em]">Live now</h2>
        <span className="ml-auto text-[11px] text-text-muted">updates every 10s</span>
      </div>
      <div className="relative grid grid-cols-3 gap-4">
        {cell(snap ? String(snap.activeConversations) : '—', 'chatting now')}
        {cell(snap ? String(snap.conversionsToday) : '—', 'orders today')}
        {cell(snap ? formatMoney(snap.revenueTodayCents, currency) : '—', 'sales today')}
      </div>
    </section>
  );
}
