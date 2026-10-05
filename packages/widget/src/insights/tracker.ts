import { accessibleName } from '../host/ax-tree.js';
import { keyFor } from '../host/fingerprint.js';
import { isOwnNode } from '../host/snapshot.js';
import { loadTemplates } from '../host/templates.js';

// Nav PRD Phase 8 — Store Insights tracker. Privacy + cost by design:
//  • aggregates IN THE BROWSER and sends ONE summary per pageview (pagehide /
//    SPA route change), never raw click or mouse streams;
//  • never reads input values or keystrokes — form fields are reported by NAME;
//  • off unless the merchant is entitled (server config), the session is in the
//    sample, and consent allows analytics.

export type InsightsConfig = { enabled: boolean; sampleRate: number };

export type PageSummary = {
  v: 1;
  merchantId: string;
  sessionId: string;
  visitorId: string | null;
  path: string;
  pageType: string;
  device: 'mobile' | 'tablet' | 'desktop';
  source: string;
  newVisitor: boolean;
  dwellMs: number;
  maxScroll: number; // 0..100
  attention: number[]; // seconds per 10 vertical bands
  cells: Record<string, number>; // "x,y" (10×10 page grid) → clicks
  elements: Record<string, number>; // structural key → clicks (top 20)
  rage: number;
  dead: number;
  errorClicks: number;
  deadTargets: string[];
  rageTargets: string[];
  abandonedFields: string[];
  lcp: number | null;
  cls: number;
  inp: number | null;
  jsErrors: number;
  botEngaged: boolean;
  cartIncreased: boolean;
  qa: boolean;
};

const BANDS = 10;
const CART_COUNT_SELECTOR =
  '[data-cart-count],#cart-icon-bubble,.cart-count,.cart-count-bubble,[class*="cart-count"],[class*="CartCount"]';

// ── consent ─────────────────────────────────────────────────────────────────
type W = Record<string, unknown> & {
  Shopify?: { customerPrivacy?: { analyticsProcessingAllowed?: () => boolean } };
  OnetrustActiveGroups?: string;
  Cookiebot?: { consent?: { statistics?: boolean }; hasResponse?: boolean };
};

/** null = no consent signal present; true/false = explicit signal. */
export function consentSignal(w: W = window as unknown as W): boolean | null {
  try {
    if ((navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl)
      return false;
    const sp = w.Shopify?.customerPrivacy?.analyticsProcessingAllowed;
    if (typeof sp === 'function') return Boolean(sp());
    if (typeof w.OnetrustActiveGroups === 'string') return w.OnetrustActiveGroups.includes('C0002');
    if (w.Cookiebot?.hasResponse) return Boolean(w.Cookiebot.consent?.statistics);
  } catch {
    /* treat as no signal */
  }
  return null;
}

/** UK/EU visitors need an explicit yes; elsewhere no-signal means allowed. */
export function consentAllows(signal: boolean | null, timeZone: string): boolean {
  if (signal !== null) return signal;
  return !/^Europe\//.test(timeZone);
}

// ── helpers ─────────────────────────────────────────────────────────────────
export function deviceOf(width: number): PageSummary['device'] {
  return width < 768 ? 'mobile' : width < 1024 ? 'tablet' : 'desktop';
}

export function sourceOf(search: string, referrer: string, host: string): string {
  const utm = new URLSearchParams(search).get('utm_source');
  if (utm) return utm.toLowerCase().slice(0, 40);
  if (!referrer) return 'direct';
  try {
    const r = new URL(referrer).hostname.replace(/^www\./, '');
    if (r === host.replace(/^www\./, '')) return 'internal';
    if (/google\./.test(r)) return 'google';
    if (/facebook|fb\.|instagram/.test(r)) return 'meta';
    return r.slice(0, 40);
  } catch {
    return 'direct';
  }
}

export function pageTypeFor(
  path: string,
  templates: Array<{ pageType: string; urlPattern: string }>,
): string {
  if (/\/(thank|order-confirm|order-success|checkouts\/.*\/thank_you)/i.test(path))
    return 'purchase';
  if (/\/checkout/i.test(path)) return 'checkout';
  if (/^\/cart\/?$/i.test(path)) return 'cart';
  for (const t of templates) {
    try {
      if (new RegExp(t.urlPattern).test(path)) return t.pageType;
    } catch {
      /* bad pattern */
    }
  }
  if (path === '/' || path === '') return 'home';
  return 'other';
}

function docHeight(): number {
  return Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight ?? 0,
    window.innerHeight,
    1,
  );
}

function cartCount(): number | null {
  const n = Number(
    (document.querySelector(CART_COUNT_SELECTOR)?.textContent ?? '').replace(/\D/g, ''),
  );
  return Number.isFinite(n) && document.querySelector(CART_COUNT_SELECTOR) !== null ? n : null;
}

function elementKey(target: Element | null): string | null {
  const el = target?.closest?.(
    'a,button,input,select,textarea,summary,[role="button"],[role="link"],[role="tab"]',
  ) as HTMLElement | null;
  if (!el) return null;
  const role =
    el.tagName === 'A'
      ? 'link'
      : el.tagName === 'BUTTON'
        ? 'button'
        : (el.getAttribute('role') ?? el.tagName.toLowerCase());
  return keyFor(role, accessibleName(el) || el.getAttribute('name') || '');
}

// ── tracker ─────────────────────────────────────────────────────────────────
type Ctx = {
  apiBase: string;
  merchantId: string;
  sessionId: string;
  visitorId: string | null;
  config: InsightsConfig;
};

// A VISIT spans page loads in the same tab (multi-page stores reload the widget,
// and with it the widget's own session, on every page). It ends after 30 min of
// inactivity. Kept in sessionStorage: per tab, gone when the tab closes.
const VISIT_KEY = 'sm_ins_visit';
const VISIT_IDLE_MS = 30 * 60 * 1000;
type Visit = { id: string; last: number; isNew: boolean; bot: boolean; qa: boolean };

export function currentVisit(
  now = Date.now(),
  seed: () => string = () => Math.random().toString(36).slice(2),
): Visit {
  let v: Visit | null = null;
  try {
    v = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? 'null') as Visit | null;
  } catch {
    v = null;
  }
  if (!v || now - v.last > VISIT_IDLE_MS) {
    let isNew = false;
    try {
      isNew = !localStorage.getItem('sm_seen');
      localStorage.setItem('sm_seen', '1');
    } catch {
      /* storage blocked */
    }
    v = { id: `v_${seed()}${now.toString(36)}`, last: now, isNew, bot: false, qa: false };
  }
  v.last = now;
  try {
    sessionStorage.setItem(VISIT_KEY, JSON.stringify(v));
  } catch {
    /* storage blocked → visit is per page */
  }
  return v;
}

function patchVisit(p: Partial<Visit>): void {
  try {
    const v = JSON.parse(sessionStorage.getItem(VISIT_KEY) ?? 'null') as Visit | null;
    if (v) sessionStorage.setItem(VISIT_KEY, JSON.stringify({ ...v, ...p }));
  } catch {
    /* ignore */
  }
}

let botEngaged = false;
export function markBotEngaged(): void {
  botEngaged = true;
  patchVisit({ bot: true });
}

export function inSample(rate: number, sessionId: string): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  let h = 0;
  for (const ch of sessionId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (h % 1000) / 1000 < rate;
}

export function startInsights(ctx: Ctx): (() => void) | null {
  if (!ctx.config?.enabled) return null;
  const visit = currentVisit();
  if (!inSample(ctx.config.sampleRate, visit.id)) return null;
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    } catch {
      return '';
    }
  })();
  if (!consentAllows(consentSignal(), tz)) return null;

  let templates: Array<{ pageType: string; urlPattern: string }> = [];
  void loadTemplates().then((t) => {
    templates = t;
  });
  // QA/synthetic traffic: headless UA, or ?sm_qa anywhere in the visit (sticky).
  const qa =
    visit.qa ||
    /ShoppingmateBot|HeadlessChrome/.test(navigator.userAgent) ||
    new URLSearchParams(location.search).has('sm_qa');
  if (qa && !visit.qa) patchVisit({ qa: true });
  const firstVisit = visit.isNew;
  if (visit.bot) botEngaged = true;
  const source = (() => {
    try {
      const s =
        sessionStorage.getItem('sm_src') ??
        sourceOf(location.search, document.referrer, location.hostname);
      sessionStorage.setItem('sm_src', s);
      return s;
    } catch {
      return sourceOf(location.search, document.referrer, location.hostname);
    }
  })();

  let page = fresh();
  function fresh() {
    return {
      path: location.pathname,
      start: Date.now(),
      maxScroll: 0,
      attention: new Array<number>(BANDS).fill(0),
      cells: {} as Record<string, number>,
      elements: {} as Record<string, number>,
      rage: 0,
      dead: 0,
      errorClicks: 0,
      deadTargets: [] as string[],
      rageTargets: [] as string[],
      focused: new Set<string>(),
      submitted: false,
      lcp: null as number | null,
      cls: 0,
      inp: null as number | null,
      jsErrors: 0,
      cartStart: cartCount(),
      recent: [] as Array<{ t: number; x: number; y: number }>,
      lastClickAt: 0,
      sent: false,
    };
  }

  const onScroll = () => {
    const pct = Math.min(
      100,
      Math.round(((window.scrollY + window.innerHeight) / docHeight()) * 100),
    );
    if (pct > page.maxScroll) page.maxScroll = pct;
  };
  const tick = window.setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    const band = Math.min(
      BANDS - 1,
      Math.floor(((window.scrollY + window.innerHeight / 2) / docHeight()) * BANDS),
    );
    page.attention[band] = (page.attention[band] ?? 0) + 1;
  }, 1000);

  const onClick = (e: MouseEvent) => {
    if (isOwnNode(e.target as Node)) return;
    const now = Date.now();
    const x = Math.min(
      9,
      Math.floor(
        ((e.clientX + window.scrollX) / Math.max(document.documentElement.scrollWidth, 1)) * 10,
      ),
    );
    const y = Math.min(9, Math.floor(((e.clientY + window.scrollY) / docHeight()) * 10));
    const cell = `${x},${y}`;
    page.cells[cell] = (page.cells[cell] ?? 0) + 1;
    const key = elementKey(e.target as Element);
    if (key) page.elements[key] = (page.elements[key] ?? 0) + 1;
    // Rage: 3+ clicks within 700 ms in ~the same spot.
    page.recent = page.recent.filter(
      (c) => now - c.t < 700 && Math.abs(c.x - e.clientX) < 30 && Math.abs(c.y - e.clientY) < 30,
    );
    page.recent.push({ t: now, x: e.clientX, y: e.clientY });
    if (page.recent.length === 3) {
      page.rage += 1;
      if (key && page.rageTargets.length < 5) page.rageTargets.push(key);
    }
    // Dead: the tap had no effect within 800 ms. Background animations
    // (twinkles, carousels) mutate styles constantly, so only count effects
    // that a tap causes: navigation, content added/removed, or a change on
    // the tapped element's own branch (e.g. aria-expanded, a class toggle).
    page.lastClickAt = now;
    const href = location.href;
    const tapped = e.target instanceof Element ? e.target : null;
    // "Near the tap" = the tapped control (or its direct parent). Ancestors only
    // count through STATE attributes (aria-*, open, hidden) — hero sections with
    // animated decoration would otherwise make every tap look effective.
    const control = tapped?.closest(
      'a,button,label,summary,[role="button"],[role="tab"],[role="option"]',
    );
    const branch = control ?? tapped?.parentElement ?? tapped;
    const activeBefore = document.activeElement;
    let changed = false;
    const overlay = (n: Node) =>
      n instanceof HTMLElement &&
      (n.matches('dialog,[role="dialog"],[aria-modal="true"],[role="alert"],[role="status"]') ||
        /fixed|sticky/.test(getComputedStyle(n).position));
    const mo = new MutationObserver((recs) => {
      for (const r of recs) {
        if (isOwnNode(r.target)) continue;
        if (branch?.contains(r.target)) {
          changed = true;
          return;
        }
        if (
          r.type === 'attributes' &&
          branch &&
          (r.target as Node).contains?.(branch) &&
          /^(aria-|open$|hidden$)/.test(r.attributeName ?? '')
        ) {
          changed = true;
          return;
        }
        if (r.type === 'childList' && [...r.addedNodes].some(overlay)) {
          changed = true;
          return;
        }
      }
    });
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    window.setTimeout(() => {
      mo.disconnect();
      const focusMoved =
        document.activeElement !== activeBefore && document.activeElement !== document.body;
      if (!changed && !focusMoved && location.href === href && page.path === location.pathname) {
        page.dead += 1;
        // Non-controls (a product title, an image) are the classic "looks
        // tappable" problem — name them by their visible text.
        const label =
          key ??
          (() => {
            const t = (tapped?.textContent ?? tapped?.getAttribute('alt') ?? '')
              .replace(/\s+/g, ' ')
              .trim()
              .toLowerCase();
            return t ? `text|${t.slice(0, 30)}` : null;
          })();
        if (label && page.deadTargets.length < 5 && !page.deadTargets.includes(label))
          page.deadTargets.push(label);
      }
    }, 800);
  };
  const onError = (ev: ErrorEvent) => {
    if (/shoppingmate|widget\/v1/.test(`${ev.filename ?? ''}`)) return; // our own errors aren't the store's
    page.jsErrors += 1;
    if (Date.now() - page.lastClickAt < 1000) page.errorClicks += 1;
  };
  const onFocus = (e: FocusEvent) => {
    const el = e.target as HTMLElement | null;
    if (!el || isOwnNode(el) || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
    const type = (el.getAttribute('type') ?? '').toLowerCase();
    if (type === 'hidden' || type === 'password') return;
    const name = (
      el.getAttribute('name') ||
      el.id ||
      el.getAttribute('placeholder') ||
      el.tagName
    ).slice(0, 40);
    page.focused.add(name);
  };
  const onSubmit = () => {
    page.submitted = true;
  };

  let po: PerformanceObserver[] = [];
  try {
    const lcp = new PerformanceObserver((l) => {
      const last = l.getEntries().at(-1);
      if (last) page.lcp = Math.round(last.startTime);
    });
    lcp.observe({ type: 'largest-contentful-paint', buffered: true });
    const cls = new PerformanceObserver((l) => {
      for (const e of l.getEntries() as Array<
        PerformanceEntry & { value?: number; hadRecentInput?: boolean }
      >) {
        if (!e.hadRecentInput) page.cls += e.value ?? 0;
      }
    });
    cls.observe({ type: 'layout-shift', buffered: true });
    const inp = new PerformanceObserver((l) => {
      for (const e of l.getEntries()) page.inp = Math.max(page.inp ?? 0, Math.round(e.duration));
    });
    inp.observe({
      type: 'event',
      buffered: true,
      durationThreshold: 40,
    } as PerformanceObserverInit);
    po = [lcp, cls, inp];
  } catch {
    /* older browsers: vitals stay null */
  }

  const send = () => {
    if (page.sent) return;
    page.sent = true;
    patchVisit({ last: Date.now() });
    const elements = Object.fromEntries(
      Object.entries(page.elements)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20),
    );
    const end = cartCount();
    const summary: PageSummary = {
      v: 1,
      merchantId: ctx.merchantId,
      sessionId: visit.id, // the VISIT (spans page loads), not the widget session
      visitorId: ctx.visitorId,
      path: page.path,
      pageType: pageTypeFor(page.path, templates),
      device: deviceOf(window.innerWidth),
      source,
      newVisitor: firstVisit,
      dwellMs: Date.now() - page.start,
      maxScroll: page.maxScroll,
      attention: page.attention,
      cells: page.cells,
      elements,
      rage: page.rage,
      dead: page.dead,
      errorClicks: page.errorClicks,
      deadTargets: page.deadTargets,
      rageTargets: page.rageTargets,
      abandonedFields: page.submitted ? [] : [...page.focused].slice(0, 10),
      lcp: page.lcp,
      cls: Math.round(page.cls * 1000) / 1000,
      inp: page.inp,
      jsErrors: page.jsErrors,
      botEngaged,
      cartIncreased: page.cartStart !== null && end !== null && end > page.cartStart,
      qa,
    };
    const body = JSON.stringify(summary);
    const url = `${ctx.apiBase}/v1/insights/pageview`;
    try {
      if (!navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) {
        void fetch(url, {
          method: 'POST',
          body,
          keepalive: true,
          headers: { 'content-type': 'text/plain' },
        }).catch(() => {});
      }
    } catch {
      /* best-effort */
    }
  };

  // SPA route changes end one pageview and start the next.
  const routeChanged = () => {
    if (location.pathname === page.path) return;
    send();
    page = fresh();
    onScroll();
  };
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function (...args) {
    const r = origPush.apply(this, args as Parameters<History['pushState']>);
    window.setTimeout(routeChanged, 0);
    return r;
  };
  history.replaceState = function (...args) {
    const r = origReplace.apply(this, args as Parameters<History['replaceState']>);
    window.setTimeout(routeChanged, 0);
    return r;
  };
  // pagehide + visibility→hidden cover tab close, app switch (mobile) and bfcache.
  const onPageHide = () => send();

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('popstate', routeChanged);
  window.addEventListener('pagehide', onPageHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') send();
  });
  document.addEventListener('click', onClick, true);
  document.addEventListener('focusin', onFocus, true);
  document.addEventListener('submit', onSubmit, true);
  window.addEventListener('error', onError);
  onScroll();

  return () => {
    send();
    window.clearInterval(tick);
    for (const o of po) o.disconnect();
    history.pushState = origPush;
    history.replaceState = origReplace;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('popstate', routeChanged);
    window.removeEventListener('pagehide', onPageHide);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('focusin', onFocus, true);
    document.removeEventListener('submit', onSubmit, true);
    window.removeEventListener('error', onError);
  };
}
