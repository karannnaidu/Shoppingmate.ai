'use client';
import { useEffect, useState } from 'react';

type Snapshot = {
  activeConversations: number;
  conversionsToday: number;
  revenueTodayCents: number;
};

export function LivePanel() {
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

  const money = (c: number) => `$${(c / 100).toFixed(0)}`;
  const cell = (value: string, label: string) => (
    <div>
      <div className="text-2xl font-semibold text-text-primary">{value}</div>
      <div className="text-xs text-text-secondary">{label}</div>
    </div>
  );

  return (
    <div className="rounded-lg border border-border bg-surface/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
        </span>
        <h2 className="font-display text-lg font-semibold text-text-primary">Live now</h2>
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        {cell(snap ? String(snap.activeConversations) : '—', 'Active chats')}
        {cell(snap ? String(snap.conversionsToday) : '—', 'Orders today')}
        {cell(snap ? money(snap.revenueTodayCents) : '—', 'Revenue today')}
      </div>
    </div>
  );
}
