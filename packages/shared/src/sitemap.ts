// Website sitemap helpers shared by the crawler (worker) and the dashboard's
// "Your website" page (web). Pure — no env, no DB — so the web bundle can
// import it via `@shoppingmate/shared/sitemap`.

/** Path of a URL (or a bare path) without a trailing slash; root stays "/". */
export function pagePath(urlOrPath: string): string {
  let path = urlOrPath;
  try {
    path = new URL(urlOrPath).pathname;
  } catch {
    /* already a path */
  }
  if (!path.startsWith('/')) path = `/${path}`;
  const trimmed = path.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

/** The comparable identity of a page: host (no www) + path, no trailing slash,
 *  no query/hash. `/about` and `/about/` are the same page. */
export function pageKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase().replace(/^www\./, '')}${pagePath(u.pathname)}`;
  } catch {
    return pagePath(url);
  }
}

/** Normalise an owner-entered exclusion: always leading "/", folders keep (or
 *  gain) their trailing "/", pages lose it. Empty / root input returns null —
 *  skipping the whole site is never what an owner means. */
export function normalizeExclusion(raw: string, asFolder: boolean): string | null {
  const p = pagePath(raw.trim());
  if (p === '/') return null;
  return asFolder ? `${p}/` : p;
}

/** True when the page falls under an excluded folder ("/blog/" covers /blog
 *  and everything below it) or is an excluded page. */
export function isPathExcluded(urlOrPath: string, excluded: readonly string[]): boolean {
  if (excluded.length === 0) return false;
  const path = pagePath(urlOrPath);
  for (const raw of excluded) {
    if (raw.endsWith('/')) {
      const folder = raw.replace(/\/+$/, '');
      if (folder && (path === folder || path.startsWith(`${folder}/`))) return true;
    } else if (pagePath(raw) === path) {
      return true;
    }
  }
  return false;
}

export type SitemapPage = { url: string; path: string };
export type SitemapFolder = {
  /** "/blog/" */
  folder: string;
  /** Human label, e.g. "blog". */
  label: string;
  /** The folder's own page (/blog/), when the site has one. */
  index: SitemapPage | null;
  pages: SitemapPage[];
};
export type SitemapTree = {
  /** Pages directly under the site root that have no sub-pages (/, /about, /faq). */
  topLevel: SitemapPage[];
  folders: SitemapFolder[];
};

/** Group URLs by their first path segment: a segment with sub-pages becomes a
 *  folder (its own page is the folder index); single pages stay top-level.
 *  Duplicate spellings (/about vs /about/) collapse to the first seen. */
export function buildSitemapTree(urls: readonly string[]): SitemapTree {
  const seen = new Set<string>();
  const pages: SitemapPage[] = [];
  for (const url of urls) {
    const path = pagePath(url);
    if (seen.has(path)) continue;
    seen.add(path);
    pages.push({ url, path });
  }
  const childrenBySegment = new Map<string, SitemapPage[]>();
  for (const p of pages) {
    const parts = p.path.split('/').filter(Boolean);
    if (parts.length >= 2) {
      const seg = parts[0]!;
      const list = childrenBySegment.get(seg) ?? [];
      list.push(p);
      childrenBySegment.set(seg, list);
    }
  }
  const topLevel: SitemapPage[] = [];
  const indexBySegment = new Map<string, SitemapPage>();
  for (const p of pages) {
    const parts = p.path.split('/').filter(Boolean);
    if (parts.length === 1 && childrenBySegment.has(parts[0]!)) indexBySegment.set(parts[0]!, p);
    else if (parts.length <= 1) topLevel.push(p);
  }
  const folders: SitemapFolder[] = [...childrenBySegment.entries()]
    .map(([seg, list]) => ({
      folder: `/${seg}/`,
      label: seg,
      index: indexBySegment.get(seg) ?? null,
      pages: [...list].sort((a, b) => a.path.localeCompare(b.path)),
    }))
    .sort((a, b) => a.folder.localeCompare(b.folder));
  topLevel.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)));
  return { topLevel, folders };
}
