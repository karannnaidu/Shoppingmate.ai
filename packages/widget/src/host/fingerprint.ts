// Nav PRD Phase 2 — template recognition + drift detection.
//
// A template's `skeleton` is the set of normalized "role|name" keys present on
// EVERY sampled page of that template (computed by the crawler with this same
// module via window.__shoppingmateNav__). At runtime we compute the live page's
// keys and the coverage of each template's skeleton:
//   coverage >= MATCH  → this page IS that template (cache hit)
//   URL matches the template's pattern but coverage < MATCH → the site changed (drift)

export const MATCH_THRESHOLD = 0.7;
const MIN_SKELETON = 4; // too few shared keys → can't judge drift reliably

export type SiteTemplate = {
  id: string;
  pageType: string;
  urlPattern: string;
  skeleton: string[];
  recipes: Array<{ action: string; role: string; name: string; signal?: string }>;
};

export type TemplateMatch = {
  template: SiteTemplate | null;
  coverage: number;
  /** Template whose URL pattern matches this page but whose skeleton doesn't. */
  drift: { template: SiteTemplate; coverage: number } | null;
};

/** Normalize a snapshot line's role + name into a structural key. */
export function keyFor(role: string, name: string): string | null {
  const n = name
    .toLowerCase()
    .replace(/[₹$£€]|rs\.?|inr|usd/g, ' ')
    .replace(/\d+([.,]\d+)?/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  if (n.length < 2) return null;
  if (role === 'text') return null; // prices / free text are never structural
  return `${role}|${n}`;
}

/** Structural keys from a snapshot text (lines like `[e12] button "Add to cart" (disabled)`). */
export function keysFromSnapshot(text: string): string[] {
  const out = new Set<string>();
  for (const line of text.split('\n')) {
    const m = /^\[e\d+\] ([a-z]+) "([^"]*)"/.exec(line);
    if (!m) continue;
    const k = keyFor(m[1] as string, m[2] as string);
    if (k) out.add(k);
  }
  return [...out];
}

/** Intersection of key sets — the skeleton shared by all samples of a template. */
export function skeletonOf(samples: string[][]): string[] {
  if (samples.length === 0) return [];
  let acc = new Set(samples[0]);
  for (const s of samples.slice(1)) {
    const next = new Set(s);
    acc = new Set([...acc].filter((k) => next.has(k)));
  }
  return [...acc].sort();
}

export function coverageOf(skeleton: string[], live: Set<string>): number {
  if (skeleton.length === 0) return 0;
  let hit = 0;
  for (const k of skeleton) if (live.has(k)) hit += 1;
  return hit / skeleton.length;
}

function urlMatches(pattern: string, path: string): boolean {
  try {
    return new RegExp(pattern).test(path);
  } catch {
    return false;
  }
}

export function matchTemplate(
  keys: string[],
  path: string,
  templates: SiteTemplate[],
): TemplateMatch {
  const live = new Set(keys);
  let best: { t: SiteTemplate; c: number } | null = null;
  let drift: TemplateMatch['drift'] = null;
  for (const t of templates) {
    if (t.skeleton.length < MIN_SKELETON) continue;
    const c = coverageOf(t.skeleton, live);
    const byUrl = urlMatches(t.urlPattern, path);
    // URL match gives a small tie-break boost; structure decides.
    const score = c + (byUrl ? 0.05 : 0);
    if (c >= MATCH_THRESHOLD && (!best || score > best.c)) best = { t, c: score };
    if (byUrl && c < MATCH_THRESHOLD && (!drift || c < drift.coverage))
      drift = { template: t, coverage: c };
  }
  if (best) return { template: best.t, coverage: Math.min(1, best.c), drift: null };
  return { template: null, coverage: 0, drift };
}
