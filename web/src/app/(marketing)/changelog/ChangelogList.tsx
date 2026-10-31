'use client';
import { useState } from 'react';
import { Link2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Container, Reveal } from '@/components/mk/ui';
import type { ChangeKind, Release } from '@/content/changelog';

const KIND: Record<ChangeKind, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-[var(--mk-accent-soft)] text-[var(--mk-accent)]' },
  improved: { label: 'Improved', cls: 'bg-[#eff6ff] text-[#1d4ed8]' },
  fixed: { label: 'Fixed', cls: 'bg-[#ecfdf3] text-[#15803d]' },
};
const FILTERS: Array<{ key: 'all' | ChangeKind; label: string }> = [
  { key: 'all', label: 'All updates' },
  { key: 'new', label: 'New' },
  { key: 'improved', label: 'Improved' },
  { key: 'fixed', label: 'Fixed' },
];

const fmt = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

export function ChangelogList({ releases }: { releases: Release[] }) {
  const [filter, setFilter] = useState<'all' | ChangeKind>('all');
  const shown = releases
    .map((r) => ({ ...r, changes: filter === 'all' ? r.changes : r.changes.filter((c) => c.kind === filter) }))
    .filter((r) => r.changes.length > 0);

  return (
    <section className="pb-20 sm:pb-28">
      <Container>
        <div className="sticky top-[76px] z-10 -mx-5 mb-6 flex gap-2 overflow-x-auto bg-white/85 px-5 py-3 backdrop-blur-md sm:top-[84px] sm:mx-0 sm:px-0" role="tablist" aria-label="Filter updates">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'shrink-0 rounded-full border px-4 py-2 text-[14px] font-medium transition-colors',
                filter === f.key ? 'border-[#0b0b10] bg-[#0b0b10] text-white' : 'border-[#e8e8ee] bg-white text-[#4a4a55] hover:text-[#0b0b10]',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ol className="relative">
          {shown.map((r, i) => (
            <li key={r.date} id={r.date} className="scroll-mt-40 border-t border-[#ececf2] py-10 sm:py-14 md:grid md:grid-cols-[220px_minmax(0,1fr)] md:gap-10">
              <div className="mb-4 md:mb-0">
                <div className="md:sticky md:top-[150px]">
                  <time dateTime={r.date} className="text-[14px] font-medium text-[#6e6e7a]">
                    {fmt(r.date)}
                  </time>
                  {i === 0 && filter === 'all' && (
                    <span className="ml-2 rounded-full bg-[#16a34a]/10 px-2 py-0.5 text-[11.5px] font-semibold text-[#15803d]">Latest</span>
                  )}
                </div>
              </div>
              <Reveal>
                <a href={`#${r.date}`} className="group inline-flex items-start gap-2">
                  <h2 className="mk-h2 text-balance text-[clamp(24px,3vw,34px)] text-[#0b0b10]">{r.title}</h2>
                  <Link2 className="mt-2 h-4 w-4 shrink-0 text-[#c4c4cf] opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
                </a>
                <p className="mt-3 max-w-[680px] text-[16.5px] leading-[1.6] text-[#4a4a55]">{r.summary}</p>
                <ul className="mt-6 flex flex-col gap-3.5">
                  {r.changes.map((c) => (
                    <li key={c.text} className="flex gap-3">
                      <span className={cn('mt-0.5 h-fit shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold', KIND[c.kind].cls)}>{KIND[c.kind].label}</span>
                      <span className="text-[15.5px] leading-[1.55] text-[#0b0b10]">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
