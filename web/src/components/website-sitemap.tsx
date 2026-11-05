'use client';

// "Your website" sitemap: every page the assistant found, folder by folder,
// with a switch to keep a whole folder or a single page OUT of what the
// assistant knows. Owner language only — no "crawl", "KB", "extract".
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { buildSitemapTree, isPathExcluded, normalizeExclusion, type SitemapPage } from '@shoppingmate/shared/sitemap';
import { Button } from '@/components/ui/button';

export type PageStatus = 'read' | 'reading' | 'not_found' | 'failed' | 'not_read';

export type SitemapEntry = { url: string; status: PageStatus; inCatalog: boolean };

const STATUS: Record<PageStatus | 'skipped', { text: string; tone: string }> = {
  read: { text: 'Learned', tone: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' },
  reading: { text: 'Reading…', tone: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300' },
  skipped: { text: 'Skipped', tone: 'bg-surface-muted text-text-secondary' },
  not_found: { text: 'Page not found', tone: 'bg-surface-muted text-text-secondary' },
  failed: { text: "Couldn't read", tone: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' },
  not_read: { text: 'Not read yet', tone: 'bg-surface-muted text-text-secondary' },
};

function Badge({ status }: { status: PageStatus | 'skipped' }) {
  const s = STATUS[status];
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${s.tone}`}>{s.text}</span>;
}

export function WebsiteSitemap({
  entries,
  initialExcluded,
}: {
  entries: SitemapEntry[];
  initialExcluded: string[];
}) {
  const router = useRouter();
  const [excluded, setExcluded] = useState<string[]>(initialExcluded);
  const [saving, startSaving] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const byUrl = useMemo(() => new Map(entries.map((e) => [e.url, e])), [entries]);
  const tree = useMemo(() => buildSitemapTree(entries.map((e) => e.url)), [entries]);
  const dirty = [...excluded].sort().join('|') !== [...initialExcluded].sort().join('|');

  const folderSkipped = (folder: string) => excluded.includes(folder);
  const pageSkipped = (p: SitemapPage) => isPathExcluded(p.path, excluded);
  const statusOf = (p: SitemapPage): PageStatus | 'skipped' =>
    pageSkipped(p) ? 'skipped' : (byUrl.get(p.url)?.status ?? 'not_read');

  function toggleFolder(folder: string) {
    setMessage(null);
    setExcluded((cur) => {
      if (cur.includes(folder)) return cur.filter((x) => x !== folder);
      // Skipping the folder supersedes any single-page skips inside it.
      const base = folder.replace(/\/$/, '');
      return [...cur.filter((x) => !(x === base || x.startsWith(`${base}/`))), folder];
    });
  }

  function togglePage(p: SitemapPage) {
    setMessage(null);
    const rule = normalizeExclusion(p.path, false);
    if (!rule) return;
    setExcluded((cur) => (cur.includes(rule) ? cur.filter((x) => x !== rule) : [...cur, rule]));
  }

  function save() {
    startSaving(async () => {
      const res = await fetch('/api/site-graph/exclusions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ excluded }),
      });
      const out = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        reread?: boolean;
        readInProgress?: boolean;
        error?: string;
      };
      if (!res.ok || !out.ok) {
        setMessage(out.error ?? 'Could not save — please try again.');
        return;
      }
      setMessage(
        out.reread
          ? 'Saved. Skipped pages are removed; pages you turned back on are being read again now.'
          : out.readInProgress
            ? 'Saved. Skipped pages are removed when the current read finishes; pages you turned back on are picked up on your next read.'
            : 'Saved. Your assistant has stopped using the pages you skipped.',
      );
      router.refresh();
    });
  }

  const q = filter.trim().toLowerCase();
  const matches = (p: SitemapPage) => !q || p.path.toLowerCase().includes(q);

  const pageRow = (p: SitemapPage, disabled = false) => {
    const skipped = pageSkipped(p);
    const entry = byUrl.get(p.url);
    return (
      <li key={p.url} className="flex items-center gap-3 py-1.5">
        <input
          type="checkbox"
          className="h-4 w-4 shrink-0 accent-violet-600"
          checked={!skipped}
          disabled={disabled || saving}
          onChange={() => togglePage(p)}
          aria-label={`Let the assistant learn from ${p.path}`}
        />
        <a
          href={p.url}
          target="_blank"
          rel="noreferrer"
          className={`min-w-0 flex-1 truncate text-sm ${skipped ? 'text-text-secondary line-through' : 'text-text-primary'} hover:underline`}
        >
          {p.path === '/' ? 'Home page (/)' : p.path}
        </a>
        {entry?.inCatalog && !skipped ? (
          <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
            Product
          </span>
        ) : null}
        <Badge status={statusOf(p)} />
      </li>
    );
  };

  const total = tree.topLevel.length + tree.folders.reduce((n, f) => n + f.pages.length + (f.index ? 1 : 0), 0);
  const allPages = [...tree.topLevel, ...tree.folders.flatMap((f) => [...(f.index ? [f.index] : []), ...f.pages])];
  const learned = allPages.filter((p) => statusOf(p) === 'read').length;
  const skippedCount = allPages.filter((p) => pageSkipped(p)).length;

  return (
    <div className="card-v2 p-6">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold text-text-primary">Pages on your website</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {learned} of {total} pages learned{skippedCount > 0 ? ` · ${skippedCount} skipped` : ''}. Untick a folder or
            page to keep it out of what your assistant knows.
          </p>
        </div>
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a page…"
          className="mt-2 w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm sm:mt-0 sm:w-56"
        />
      </div>

      {total === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">No pages yet — press “Re-read my pages” above.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {tree.topLevel.some(matches) ? (
            <details open className="rounded-md border border-border">
              <summary className="cursor-pointer select-none px-4 py-2.5 text-sm font-medium text-text-primary">
                Main pages <span className="text-text-secondary">({tree.topLevel.length})</span>
              </summary>
              <ul className="border-t border-border px-4 py-1">{tree.topLevel.filter(matches).map((p) => pageRow(p))}</ul>
            </details>
          ) : null}

          {tree.folders.map((f) => {
            const pages = [...(f.index ? [f.index] : []), ...f.pages];
            const visible = pages.filter(matches);
            if (q && visible.length === 0) return null;
            const skipped = folderSkipped(f.folder);
            const folderLearned = pages.filter((p) => statusOf(p) === 'read').length;
            return (
              <details key={f.folder} open={Boolean(q)} className="rounded-md border border-border">
                <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-2.5">
                  <input
                    type="checkbox"
                    className="h-4 w-4 shrink-0 accent-violet-600"
                    checked={!skipped}
                    disabled={saving}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleFolder(f.folder)}
                    aria-label={`Let the assistant learn from everything in ${f.folder}`}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate text-sm font-medium ${skipped ? 'text-text-secondary line-through' : 'text-text-primary'}`}
                  >
                    {f.folder}
                  </span>
                  <span className="shrink-0 text-xs text-text-secondary">
                    {skipped ? `${pages.length} pages skipped` : `${folderLearned} of ${pages.length} learned`}
                  </span>
                </summary>
                <ul className="border-t border-border px-4 py-1 pl-11">{visible.map((p) => pageRow(p, skipped))}</ul>
              </details>
            );
          })}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={!dirty || saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </Button>
        {dirty && !saving ? (
          <button
            type="button"
            className="text-sm text-text-secondary hover:underline"
            onClick={() => {
              setExcluded(initialExcluded);
              setMessage(null);
            }}
          >
            Undo
          </button>
        ) : null}
        {message ? (
          <p className="text-sm text-text-secondary" role="status">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
