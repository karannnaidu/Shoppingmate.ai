import type { SiteTemplate } from './fingerprint.js';

// Nav PRD Phase 2 — per-session template cache + drift reporting. The widget
// fetches the merchant's template site map ONCE per session (shared, cached
// server-side) and reports drift at most once per template per session.

type NavContext = { apiBase: string; merchantId: string; sessionId: string };

let ctx: NavContext | null = null;
let templatesPromise: Promise<SiteTemplate[]> | null = null;
const reported = new Set<string>();

export function setNavContext(next: NavContext | null): void {
  ctx = next;
  templatesPromise = null;
  reported.clear();
}

export function loadTemplates(fetchFn: typeof fetch = fetch): Promise<SiteTemplate[]> {
  if (!ctx) return Promise.resolve([]);
  if (!templatesPromise) {
    const { apiBase, merchantId } = ctx;
    templatesPromise = fetchFn(`${apiBase}/v1/site-templates/${encodeURIComponent(merchantId)}`)
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((j: { templates?: SiteTemplate[] }) => (Array.isArray(j.templates) ? j.templates : []))
      .catch(() => []);
  }
  return templatesPromise;
}

export function reportTemplateSignal(
  kind: 'drift' | 'verify',
  templateId: string,
  coverage: number,
  fetchFn: typeof fetch = fetch,
): void {
  if (!ctx) return;
  const key = `${kind}:${templateId}`;
  if (reported.has(key)) return;
  reported.add(key);
  const { apiBase, merchantId, sessionId } = ctx;
  void fetchFn(`${apiBase}/v1/site-templates/${encodeURIComponent(merchantId)}/signal`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, templateId, coverage, sessionId, path: location.pathname }),
    keepalive: true,
  }).catch(() => {});
}
