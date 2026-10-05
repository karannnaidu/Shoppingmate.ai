// Nav Phase 2 — "How your pages work": the store layouts the assistant has
// learned, in owner language (no jargon), with a re-scan button.

type TemplateRow = {
  pageType: string;
  status: string;
  scannedAt: Date | null;
  scanTrigger: string | null;
  recipes: Array<{ action: string; name: string }>;
  sampleCount: number;
};

const PAGE_NAMES: Record<string, string> = {
  home: 'Home page',
  pdp: 'Product pages',
  plp: 'Shop / collection pages',
  collection: 'Collection pages',
  faq: 'FAQ page',
  policy: 'Policy pages',
  other: 'Other pages',
};

const ACTION_NAMES: Record<string, string> = {
  add_to_cart: 'add to cart',
  buy_now: 'buy now',
  checkout: 'go to checkout',
  quantity: 'change quantity',
  variant: 'pick a size / option',
  subscribe: 'subscribe',
  search: 'search products',
};

export function timeAgo(d: Date | null, now = new Date()): string {
  if (!d) return 'not checked yet';
  const mins = Math.round((now.getTime() - d.getTime()) / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function statusLabel(t: TemplateRow): { text: string; tone: string } {
  if (t.status === 'scanning') return { text: 'Checking now', tone: 'text-amber-600' };
  if (t.status === 'stale') return { text: 'Changed — re-checking', tone: 'text-amber-600' };
  return { text: 'Up to date', tone: 'text-emerald-600' };
}

export function SiteTemplatesCard({ templates, rescanQueued }: { templates: TemplateRow[]; rescanQueued: boolean }) {
  const autoFixed = templates.filter((t) => t.scanTrigger === 'drift' || t.scanTrigger === 'verify');
  return (
    <div className="rounded-lg border border-border bg-surface p-6">
      <h2 className="font-display text-lg font-semibold text-text-primary">How your pages work</h2>
      <p className="mt-1 text-sm text-text-secondary">
        Your assistant learns the layout of each kind of page once, so it can find buttons and help shoppers faster.
        When your site changes, it notices and re-learns automatically.
      </p>

      {rescanQueued && (
        <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Re-scan started — this usually takes a few minutes.
        </p>
      )}
      {autoFixed.length > 0 && (
        <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
          We noticed your {autoFixed.map((t) => (PAGE_NAMES[t.pageType] ?? t.pageType).toLowerCase()).join(', ')}{' '}
          changed and re-checked {autoFixed.length === 1 ? 'it' : 'them'} automatically.
        </p>
      )}

      {templates.length === 0 ? (
        <p className="mt-4 text-sm text-text-secondary">
          No pages learned yet. Press &ldquo;Re-scan my site&rdquo; and your assistant will study your home, shop and
          product pages.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {templates.map((t) => {
            const s = statusLabel(t);
            const can = t.recipes.map((r) => ACTION_NAMES[r.action] ?? r.action);
            return (
              <li key={t.pageType} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium text-text-primary">{PAGE_NAMES[t.pageType] ?? t.pageType}</p>
                  <p className="text-sm text-text-secondary">
                    {can.length > 0 ? `Knows how to: ${can.join(', ')}` : 'Knows the layout'} · checked{' '}
                    {timeAgo(t.scannedAt)}
                  </p>
                </div>
                <span className={`text-sm font-medium ${s.tone}`}>{s.text}</span>
              </li>
            );
          })}
        </ul>
      )}

      <form action="/api/site-templates/rescan" method="post" className="mt-6">
        <button
          type="submit"
          className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2"
        >
          Re-scan my site
        </button>
      </form>
    </div>
  );
}
