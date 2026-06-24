# Bucket B — Demo-Undeniable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Sage on `shoppingmate.ai` into an active tour guide that navigates, scrolls, highlights, clicks, and voices the exact Starter price verbatim — all gated to the demo merchant (`SM-XPK2EN`).

**Architecture:** Five new agent tools (`site.navigate`, `site.scroll_to`, `site.highlight`, `site.click`, `pricing.quote`) dispatched server-side; `site.*` tools round-trip through the LiveKit data channel to the widget which runs an AX-tree-driven host-action executor; `pricing.quote` returns a server-formatted speech string protected end-to-end by an exact-substring allow-list bypass in `stripPrices` + `geminiSession.speak`. A tour state machine drives three interruptible beats (features → persona swap → pricing+signup).

**Tech Stack:** TypeScript across the monorepo (`packages/agent`, `packages/widget`, `apps/voice-agent`, `web`), vitest, Drizzle (no schema changes), LiveKit Agents JS, Gemini 2.5 Flash Live, Next.js 16 (web marketing). Bundle ceiling: widget stays under 120 KB gzip.

**Spec:** `docs/superpowers/specs/2026-05-19-bucket-b-demo-undeniable-design.md`

---

## File Structure

**New files (agent):**
- `packages/agent/src/pricing/plans.ts` — plan catalog (id, name, priceCents, conv counts, currency)
- `packages/agent/src/pricing/speech.ts` — `numberToWords` + `formatPlanSpeech` + canonical speech-token derivation
- `packages/agent/src/demo-tour.ts` — tour state machine (beats + interruption)
- `packages/agent/src/host-actions.ts` — host-action types (`HostAction`, `HostActionResult`, `HostActionRequest`)

**New files (widget):**
- `packages/widget/src/host/ax-tree.ts` — AccName 1.2 resolver + scoring
- `packages/widget/src/host/actions.ts` — `executeHostAction` dispatcher (navigate/scroll/highlight/click)
- `packages/widget/src/host/overlay.ts` — pulse-ring overlay element + auto-removal
- `packages/widget/src/ui/soft-prompt.ts` — 5s silent-mount tour-offer bubble

**New files (voice-agent):**
- `apps/voice-agent/src/personaSwap.ts` — Beat 2 voice-id hot-swap helper (re-issues `transport.open()` with new voiceId)

**New files (docs):**
- `docs/runbooks/2026-05-19-bucket-b-acceptance.md` — 8-step manual smoke

**Modified (agent):**
- `packages/agent/src/tools.ts` — add 5 demo-gated tool defs; dispatch table proxies `site.*` to caller-supplied `dispatchHostAction` (new dep) and `pricing.quote` to `formatPlanSpeech`
- `packages/agent/src/postprocess.ts` — extend `stripPrices(text, allowedSpeechTokens?)` with exact-substring bypass
- `packages/agent/src/runtime.ts` — populate `session.allowedSpeechTokens` from `pricing.quote` results; pass to `stripPrices`; accept new `dispatchHostAction` dep; demo-gate the tool surface
- `packages/agent/src/types.ts` — extend `SessionState` with `allowedSpeechTokens: string[]`; add `host_action` AgentEvent variant
- `packages/agent/src/index.ts` — re-export new modules
- `packages/agent/src/state.ts` — initialize `allowedSpeechTokens: []` on session create; persist in Redis

**Modified (voice-agent):**
- `apps/voice-agent/src/geminiSession.ts` — accept per-session allowed-tokens set; `speak()` bypasses numeric check on exact substring match
- `apps/voice-agent/src/bridge.ts` — implement `dispatchHostAction`: publish to data channel, await result keyed by callId, 5s timeout

**Modified (widget):**
- `packages/widget/src/transport/codec.ts` — encode/decode new `host_action_request` (agent→widget) and `host_action_result` (widget→agent) frames
- `packages/widget/src/transport/livekit.ts` — surface host-action data-channel callback
- `packages/widget/src/widget.ts` — wire host-action executor + soft prompt; publish results back

**Modified (web marketing site):**
- `web/src/components/Features.tsx` — section + per-card `aria-label` + `data-tour-stop`
- `web/src/components/Pricing.tsx` — section + per-tier-card `aria-label` + `data-tour-stop` (Starter card needs `data-tour-stop="starter-plan-card"`)
- `web/src/components/Cta.tsx` — signup button `aria-label="Sign up"` + `data-tour-stop="signup"`
- `web/src/components/HowItWorks.tsx` — section labels
- `web/src/components/Platforms.tsx` (only if a "personas" surface lives here; otherwise add to whichever component has the persona showcase)

---

## Task 1: ARIA labels — Features section

**Files:**
- Modify: `web/src/components/Features.tsx`

- [ ] **Step 1: Read the current component**

Read `web/src/components/Features.tsx` end-to-end to identify the wrapping `<section>` and the individual feature card containers (likely a `.map` over an array of objects).

- [ ] **Step 2: Edit — add section-level markers**

Wrap the existing `<section>` (or top-level container) with:

```tsx
<section
  id="features"
  aria-label="Features"
  data-tour-stop="features"
  className="..."  // keep existing
>
```

Then on each rendered card inside the `.map`, add:
```tsx
<div
  aria-label={`${item.title} card`}
  data-tour-stop={item.tourId /* e.g. 'voice', 'personas', 'install' */}
  className="..."  // keep existing
>
```

If the existing data array doesn't have a `tourId` field, add one to each item: `'voice'`, `'personas'`, `'install'` (in render order).

- [ ] **Step 3: Verify no visual regression**

Run `cd web && pnpm vitest run` — expect green. The change is pure markup; no test files target it directly.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Features.tsx
git commit -m "feat(web): add aria-label + data-tour-stop to Features for Bucket B tour"
```

---

## Task 2: ARIA labels — Pricing section

**Files:**
- Modify: `web/src/components/Pricing.tsx`

- [ ] **Step 1: Edit — section wrapper**

Find the existing `<section id="pricing" ...>` at line 73 and extend:

```tsx
<section
  id="pricing"
  aria-label="Plan grid"
  data-tour-stop="pricing"
  className="relative py-24 md:py-32"
>
```

- [ ] **Step 2: Edit — per-tier card markers**

On each `<motion.div key={t.name} ...>` (line 84), add:

```tsx
<motion.div
  key={t.name}
  aria-label={`${t.name} plan card`}
  data-tour-stop={`${t.name.toLowerCase()}-plan-card`}
  ... existing props
>
```

This yields `data-tour-stop="starter-plan-card"`, `"growth-plan-card"`, `"enterprise-plan-card"`.

- [ ] **Step 3: Run tests**

```bash
cd web && pnpm vitest run
```

Expect green.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Pricing.tsx
git commit -m "feat(web): add aria-label + data-tour-stop to Pricing tiers for Bucket B"
```

---

## Task 3: ARIA labels — Cta + remaining marketing components

**Files:**
- Modify: `web/src/components/Cta.tsx`
- Modify: `web/src/components/Hero.tsx` (if it contains primary signup CTA)
- Modify: `web/src/components/Nav.tsx` (if it has a top-bar Sign up button)

- [ ] **Step 1: Cta.tsx — annotate signup button**

Read Cta.tsx; find the primary `<Link href="/signup">`. Add:
```tsx
<Link
  href="/signup"
  aria-label="Sign up"
  data-tour-stop="signup"
  ...
>
```

If there is more than one signup link in `Cta.tsx`, mark only the primary (largest/highlighted) one.

- [ ] **Step 2: Hero.tsx — annotate signup link if present**

Read Hero.tsx; if it contains a `<Link href="/signup">` button, add:
```tsx
aria-label="Sign up"
data-tour-stop="signup-hero"
```

(Different `data-tour-stop` value so the tour can prefer the canonical CTA button.)

- [ ] **Step 3: Nav.tsx — annotate top-bar signup if present**

Same treatment with `data-tour-stop="signup-nav"`.

- [ ] **Step 4: Run tests**

```bash
cd web && pnpm vitest run
```

Expect green.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Cta.tsx web/src/components/Hero.tsx web/src/components/Nav.tsx
git commit -m "feat(web): add aria-label + data-tour-stop to signup CTAs"
```

---

## Task 4: Widget — AX-tree resolver (failing test first)

**Files:**
- Create: `packages/widget/src/host/ax-tree.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/widget/src/host/ax-tree.test.ts
/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach } from 'vitest';
import { resolveIntent } from './ax-tree.js';

function mount(html: string): void {
  document.body.innerHTML = html;
}

describe('resolveIntent()', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('returns the element whose aria-label exactly matches the intent tokens', () => {
    mount(`
      <button aria-label="Sign up" data-tour-stop="signup">Sign up</button>
      <button aria-label="Sign in" data-tour-stop="signin">Sign in</button>
    `);
    const el = resolveIntent('signup button');
    expect(el).not.toBeNull();
    expect(el?.getAttribute('data-tour-stop')).toBe('signup');
  });

  it('returns the section whose data-tour-stop matches the intent verbatim', () => {
    mount(`
      <section aria-label="Plan grid" data-tour-stop="pricing"></section>
      <section aria-label="Features" data-tour-stop="features"></section>
    `);
    expect(resolveIntent('plan grid')?.getAttribute('data-tour-stop')).toBe('pricing');
    expect(resolveIntent('features section')?.getAttribute('data-tour-stop')).toBe('features');
  });

  it('returns null when best score is below threshold 0.4', () => {
    mount(`<button aria-label="Submit form">Submit</button>`);
    expect(resolveIntent('starter plan card')).toBeNull();
  });

  it('prefers visible elements over hidden ones', () => {
    mount(`
      <div aria-label="Starter plan card" style="display:none" data-tour-stop="starter-hidden"></div>
      <div aria-label="Starter plan card" data-tour-stop="starter-visible"></div>
    `);
    expect(resolveIntent('starter plan card')?.getAttribute('data-tour-stop')).toBe(
      'starter-visible',
    );
  });

  it('falls back to text content when no aria-label is present', () => {
    mount(`<a href="/pricing">Pricing</a>`);
    const el = resolveIntent('pricing link');
    expect(el?.tagName).toBe('A');
  });

  it('scores token overlap via Jaccard similarity, stopwords filtered', () => {
    mount(`
      <button aria-label="Sign up now">Sign up now</button>
      <button aria-label="Sign in">Sign in</button>
    `);
    const el = resolveIntent('the sign up button');
    expect(el?.textContent).toContain('Sign up');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd packages/widget && pnpm vitest run src/host/ax-tree.test.ts
```

Expect FAIL with `Cannot find module './ax-tree.js'`.

- [ ] **Step 3: Implement `resolveIntent`**

Create `packages/widget/src/host/ax-tree.ts`:

```ts
// W3C AccName 1.2-inspired accessible-name + intent resolver.
// No external deps. Used by host-action tools (site.scroll_to, site.highlight,
// site.click, site.navigate) to map a free-text intent (e.g. "starter plan
// card") to a real HTMLElement on the host page.

const STOPWORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'on', 'in', 'and', 'or',
  'section', 'button', 'link', 'card', 'tile', 'now',
]);

const ROLE_KEYWORDS: Array<{ keyword: string; matchTag: RegExp; matchRole?: string }> = [
  { keyword: 'button', matchTag: /^(button)$/i, matchRole: 'button' },
  { keyword: 'link', matchTag: /^(a)$/i, matchRole: 'link' },
  { keyword: 'card', matchTag: /^(article|div|section)$/i },
  { keyword: 'section', matchTag: /^(section|main|article)$/i },
];

const MIN_SCORE = 0.4;

type Candidate = {
  element: HTMLElement;
  role: string;
  name: string;
  visible: boolean;
};

export function resolveIntent(intent: string): HTMLElement | null {
  const intentTokens = tokenize(intent);
  if (intentTokens.size === 0) return null;
  const candidates = collectCandidates(document.body);
  let best: { c: Candidate; score: number } | null = null;
  for (const c of candidates) {
    if (!c.visible) continue;
    const score = scoreCandidate(c, intent, intentTokens);
    if (score < MIN_SCORE) continue;
    if (!best || score > best.score) best = { c, score };
  }
  return best?.c.element ?? null;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 0 && !STOPWORDS.has(t)),
  );
}

function collectCandidates(root: HTMLElement): Candidate[] {
  const out: Candidate[] = [];
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = tw.currentNode;
  while (node) {
    if (node instanceof HTMLElement) {
      const name = accessibleName(node);
      if (name) {
        out.push({
          element: node,
          role: node.getAttribute('role') ?? node.tagName.toLowerCase(),
          name,
          visible: isVisible(node),
        });
      }
    }
    node = tw.nextNode();
  }
  return out;
}

function accessibleName(el: HTMLElement): string {
  // AccName 1.2 (subset): aria-labelledby → aria-label → <label for> → alt/title → text
  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const parts = labelledby
      .split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent?.trim() ?? '')
      .filter(Boolean);
    if (parts.length > 0) return parts.join(' ');
  }
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel.trim();
  if (el.id) {
    const associated = document.querySelector(`label[for="${cssEscape(el.id)}"]`);
    if (associated?.textContent) return associated.textContent.trim();
  }
  const alt = el.getAttribute('alt') ?? el.getAttribute('title');
  if (alt) return alt.trim();
  const text = (el.textContent ?? '').trim();
  if (text && text.length < 200) return text;
  return '';
}

function isVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const style = el.ownerDocument.defaultView?.getComputedStyle(el);
  if (!style) return true;
  if (style.display === 'none' || style.visibility === 'hidden') return false;
  if (style.opacity === '0') return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}

function scoreCandidate(c: Candidate, intent: string, intentTokens: Set<string>): number {
  const nameTokens = tokenize(c.name);
  if (nameTokens.size === 0) return 0;
  // Jaccard similarity over token sets
  let intersect = 0;
  for (const t of intentTokens) if (nameTokens.has(t)) intersect++;
  const union = new Set([...intentTokens, ...nameTokens]).size;
  const jaccard = union === 0 ? 0 : intersect / union;
  // Role match bonus
  let roleBonus = 0;
  const intentLower = intent.toLowerCase();
  for (const rk of ROLE_KEYWORDS) {
    if (!intentLower.includes(rk.keyword)) continue;
    if (rk.matchTag.test(c.element.tagName) || c.role === rk.matchRole) {
      roleBonus = 0.15;
      break;
    }
  }
  // data-tour-stop direct match — strong signal
  const stopId = c.element.getAttribute('data-tour-stop');
  let stopBonus = 0;
  if (stopId) {
    const stopTokens = tokenize(stopId.replace(/-/g, ' '));
    let stopHits = 0;
    for (const t of intentTokens) if (stopTokens.has(t)) stopHits++;
    if (stopHits > 0) stopBonus = 0.2 * (stopHits / intentTokens.size);
  }
  return Math.min(1, jaccard + roleBonus + stopBonus);
}

function cssEscape(s: string): string {
  return s.replace(/(["\\])/g, '\\$1');
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
cd packages/widget && pnpm vitest run src/host/ax-tree.test.ts
```

Expect all six tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/host/ax-tree.ts packages/widget/src/host/ax-tree.test.ts
git commit -m "feat(widget): add AX-tree resolveIntent() for host-action tools"
```

---

## Task 5: Widget — pulse-ring overlay element

**Files:**
- Create: `packages/widget/src/host/overlay.ts`
- Create: `packages/widget/src/host/overlay.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/widget/src/host/overlay.test.ts
/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { showPulseRing } from './overlay.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

describe('showPulseRing()', () => {
  it('attaches an overlay positioned over the target element', () => {
    const target = document.createElement('div');
    target.getBoundingClientRect = () =>
      ({ x: 10, y: 20, width: 100, height: 50, top: 20, left: 10, right: 110, bottom: 70 }) as DOMRect;
    document.body.appendChild(target);
    showPulseRing(target, 2000);
    const ring = document.querySelector('[data-shoppingmate-pulse-ring]') as HTMLElement;
    expect(ring).not.toBeNull();
    expect(ring.style.position).toBe('fixed');
  });

  it('auto-removes the overlay after duration_ms', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    showPulseRing(target, 1500);
    expect(document.querySelector('[data-shoppingmate-pulse-ring]')).not.toBeNull();
    vi.advanceTimersByTime(1600);
    expect(document.querySelector('[data-shoppingmate-pulse-ring]')).toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/widget && pnpm vitest run src/host/overlay.test.ts
```

- [ ] **Step 3: Implement overlay**

Create `packages/widget/src/host/overlay.ts`:

```ts
// Pulse-ring overlay attached at document body root (not inside Shadow DOM)
// so it can position itself anywhere on the host page. Auto-removes after
// duration_ms. Pointer-events none — never blocks the visitor.

const RING_ATTR = 'data-shoppingmate-pulse-ring';

export function showPulseRing(target: HTMLElement, durationMs: number): () => void {
  const rect = target.getBoundingClientRect();
  const ring = document.createElement('div');
  ring.setAttribute(RING_ATTR, '');
  Object.assign(ring.style, {
    position: 'fixed',
    left: `${rect.left - 6}px`,
    top: `${rect.top - 6}px`,
    width: `${rect.width + 12}px`,
    height: `${rect.height + 12}px`,
    borderRadius: '14px',
    boxShadow: '0 0 0 3px rgba(139,92,246,0.85), 0 0 24px rgba(139,92,246,0.55)',
    pointerEvents: 'none',
    zIndex: '2147483646', // just below max so widget tray stays on top
    animation: 'shoppingmate-pulse 1.2s ease-in-out infinite',
    transition: 'opacity 250ms ease',
  } satisfies Partial<CSSStyleDeclaration>);
  ensureKeyframes();
  document.body.appendChild(ring);
  let removed = false;
  const remove = () => {
    if (removed) return;
    removed = true;
    ring.style.opacity = '0';
    setTimeout(() => ring.remove(), 250);
  };
  setTimeout(remove, durationMs);
  return remove;
}

let kfInjected = false;
function ensureKeyframes(): void {
  if (kfInjected) return;
  kfInjected = true;
  const style = document.createElement('style');
  style.textContent = `@keyframes shoppingmate-pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.04); opacity: 0.85; }
  }`;
  document.head.appendChild(style);
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd packages/widget && pnpm vitest run src/host/overlay.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/host/overlay.ts packages/widget/src/host/overlay.test.ts
git commit -m "feat(widget): add pulse-ring overlay for site.highlight tool"
```

---

## Task 6: Widget — host action executor

**Files:**
- Create: `packages/widget/src/host/actions.ts`
- Create: `packages/widget/src/host/actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/widget/src/host/actions.test.ts
/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { executeHostAction } from './actions.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('executeHostAction()', () => {
  it('navigates to a same-origin path via window.location.href', async () => {
    const assignSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { href: 'https://shoppingmate.ai/', assign: assignSpy, origin: 'https://shoppingmate.ai', pathname: '/' },
      writable: true,
    });
    const r = await executeHostAction({ type: 'navigate', path: '/pricing' });
    expect(r).toEqual({ ok: true });
    expect(assignSpy).toHaveBeenCalledWith('/pricing');
  });

  it('returns not_found when AX-tree resolver finds no element', async () => {
    document.body.innerHTML = '<div></div>';
    const r = await executeHostAction({ type: 'scroll_to', intent: 'starter plan card' });
    expect(r).toEqual({ ok: false, reason: 'not_found' });
  });

  it('scrolls into view when intent resolves', async () => {
    const el = document.createElement('section');
    el.setAttribute('aria-label', 'Plan grid');
    el.scrollIntoView = vi.fn();
    document.body.appendChild(el);
    const r = await executeHostAction({ type: 'scroll_to', intent: 'plan grid' });
    expect(r).toEqual({ ok: true });
    expect(el.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  });

  it('clicks the resolved element', async () => {
    const btn = document.createElement('button');
    btn.setAttribute('aria-label', 'Sign up');
    btn.setAttribute('data-tour-stop', 'signup');
    const clickSpy = vi.fn();
    btn.click = clickSpy;
    document.body.appendChild(btn);
    const r = await executeHostAction({ type: 'click', intent: 'signup button' });
    expect(r).toEqual({ ok: true });
    expect(clickSpy).toHaveBeenCalledOnce();
  });

  it('rejects cross-origin navigation', async () => {
    const r = await executeHostAction({ type: 'navigate', path: 'https://evil.example.com' });
    expect(r).toEqual({ ok: false, reason: 'cross_origin' });
  });

  it('highlights the resolved element via pulse ring', async () => {
    const el = document.createElement('div');
    el.setAttribute('aria-label', 'Starter plan card');
    document.body.appendChild(el);
    const r = await executeHostAction({ type: 'highlight', intent: 'starter plan card', durationMs: 1500 });
    expect(r).toEqual({ ok: true });
    expect(document.querySelector('[data-shoppingmate-pulse-ring]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/widget && pnpm vitest run src/host/actions.test.ts
```

- [ ] **Step 3: Implement executor**

Create `packages/widget/src/host/actions.ts`:

```ts
import { resolveIntent } from './ax-tree.js';
import { showPulseRing } from './overlay.js';

export type HostAction =
  | { type: 'navigate'; path: string }
  | { type: 'scroll_to'; intent: string }
  | { type: 'highlight'; intent: string; durationMs?: number }
  | { type: 'click'; intent: string };

export type HostActionResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' };

export async function executeHostAction(action: HostAction): Promise<HostActionResult> {
  switch (action.type) {
    case 'navigate':
      return navigate(action.path);
    case 'scroll_to':
      return scrollTo(action.intent);
    case 'highlight':
      return highlight(action.intent, action.durationMs ?? 2000);
    case 'click':
      return click(action.intent);
  }
}

function navigate(path: string): HostActionResult {
  try {
    const url = new URL(path, window.location.href);
    if (url.origin !== window.location.origin) {
      return { ok: false, reason: 'cross_origin' };
    }
    window.location.assign(url.pathname + url.search + url.hash);
    return { ok: true };
  } catch {
    return { ok: false, reason: 'route_not_found' };
  }
}

function scrollTo(intent: string): HostActionResult {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  return { ok: true };
}

function highlight(intent: string, durationMs: number): HostActionResult {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  showPulseRing(el, durationMs);
  return { ok: true };
}

function click(intent: string): HostActionResult {
  const el = resolveIntent(intent);
  if (!el) return { ok: false, reason: 'not_found' };
  if (!el.isConnected) return { ok: false, reason: 'stale_target' };
  el.click();
  return { ok: true };
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd packages/widget && pnpm vitest run src/host/actions.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/host/actions.ts packages/widget/src/host/actions.test.ts
git commit -m "feat(widget): add executeHostAction dispatcher (navigate/scroll/highlight/click)"
```

---

## Task 7: Agent — plan catalog constants

**Files:**
- Create: `packages/agent/src/pricing/plans.ts`

- [ ] **Step 1: Create the catalog**

```ts
// packages/agent/src/pricing/plans.ts
// Single source of truth for pricing voiced by Sage on shoppingmate.ai.
// Bucket B v0.1 ships these inline. Bucket C will load from
// merchants.config.pricing instead. Keep this file boring and exhaustive —
// every value here gets read verbatim to the visitor.

export type Plan = {
  id: 'starter' | 'growth' | 'enterprise';
  displayName: string;
  priceCents: number | null; // null = "custom"
  convCount: number | null; // null = "unmetered" or N/A
  currency: 'USD';
};

export const PLANS: Plan[] = [
  { id: 'starter',    displayName: 'Starter',    priceCents: 3000,   convCount: 100,   currency: 'USD' },
  { id: 'growth',     displayName: 'Growth',     priceCents: 6000,   convCount: 500,   currency: 'USD' },
  { id: 'enterprise', displayName: 'Enterprise', priceCents: null,   convCount: null,  currency: 'USD' },
];

export function findPlan(id: string): Plan | null {
  return PLANS.find((p) => p.id === id) ?? null;
}
```

> **Note for engineer:** prices/conv counts here MUST match what's rendered in `web/src/components/Pricing.tsx`. If you change one, change both in the same commit.

- [ ] **Step 2: Commit**

```bash
git add packages/agent/src/pricing/plans.ts
git commit -m "feat(agent): add pricing plan catalog for pricing.quote tool"
```

---

## Task 8: Agent — pricing speech formatter

**Files:**
- Create: `packages/agent/src/pricing/speech.test.ts`
- Create: `packages/agent/src/pricing/speech.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent/src/pricing/speech.test.ts
import { describe, expect, it } from 'vitest';
import { formatPlanSpeech, numberToWords } from './speech.js';
import { findPlan } from './plans.js';

describe('numberToWords()', () => {
  it.each([
    [0, 'zero'],
    [1, 'one'],
    [12, 'twelve'],
    [30, 'thirty'],
    [99, 'ninety-nine'],
    [100, 'one hundred'],
    [299, 'two hundred ninety-nine'],
    [500, 'five hundred'],
    [799, 'seven hundred ninety-nine'],
    [2000, 'two thousand'],
    [9999, 'nine thousand nine hundred ninety-nine'],
  ])('%d → %s', (n, expected) => {
    expect(numberToWords(n)).toBe(expected);
  });

  it('throws for out-of-range', () => {
    expect(() => numberToWords(-1)).toThrow();
    expect(() => numberToWords(10000)).toThrow();
  });
});

describe('formatPlanSpeech()', () => {
  it('renders the Starter plan with words, never digits', () => {
    const starter = findPlan('starter')!;
    const speech = formatPlanSpeech(starter);
    expect(speech).toBe('Starter is thirty dollars per month for one hundred conversations.');
    expect(speech).not.toMatch(/\d/);
    expect(speech).not.toMatch(/[\$€£¥₹]/);
  });

  it('renders the Growth plan', () => {
    expect(formatPlanSpeech(findPlan('growth')!)).toBe(
      'Growth is sixty dollars per month for five hundred conversations.',
    );
  });

  it('handles plans with no price (Enterprise) by speaking "custom pricing"', () => {
    expect(formatPlanSpeech(findPlan('enterprise')!)).toBe(
      'Enterprise is custom pricing — talk to our team for a quote.',
    );
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/agent && pnpm vitest run src/pricing/speech.test.ts
```

- [ ] **Step 3: Implement**

Create `packages/agent/src/pricing/speech.ts`:

```ts
import type { Plan } from './plans.js';

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
  'sixteen', 'seventeen', 'eighteen', 'nineteen',
];

const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function numberToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) {
    throw new Error(`numberToWords: out-of-range ${n}`);
  }
  if (n < 20) return ONES[n];
  if (n < 100) {
    const t = TENS[Math.floor(n / 10)];
    const o = n % 10;
    return o === 0 ? t : `${t}-${ONES[o]}`;
  }
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rest = n % 100;
    return rest === 0 ? `${ONES[h]} hundred` : `${ONES[h]} hundred ${numberToWords(rest)}`;
  }
  const th = Math.floor(n / 1000);
  const rest = n % 1000;
  return rest === 0 ? `${ONES[th]} thousand` : `${ONES[th]} thousand ${numberToWords(rest)}`;
}

export function formatPlanSpeech(plan: Plan): string {
  if (plan.priceCents === null) {
    return `${plan.displayName} is custom pricing — talk to our team for a quote.`;
  }
  const dollars = Math.round(plan.priceCents / 100);
  const priceWords = numberToWords(dollars);
  if (plan.convCount === null) {
    return `${plan.displayName} is ${priceWords} dollars per month.`;
  }
  const convWords = numberToWords(plan.convCount);
  return `${plan.displayName} is ${priceWords} dollars per month for ${convWords} conversations.`;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd packages/agent && pnpm vitest run src/pricing/speech.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/pricing/speech.ts packages/agent/src/pricing/speech.test.ts
git commit -m "feat(agent): add formatPlanSpeech + numberToWords for pricing.quote tool"
```

---

## Task 9: Agent — extend stripPrices with allow-list bypass

**Files:**
- Modify: `packages/agent/src/postprocess.ts`
- Modify: `packages/agent/src/postprocess.test.ts`

- [ ] **Step 1: Add failing tests for bypass behavior**

Append to `packages/agent/src/postprocess.test.ts`:

```ts
describe('stripPrices() with allowed speech tokens', () => {
  it('passes through an exact-substring match of an allowed token', () => {
    const allowed = new Set([
      'Starter is thirty dollars per month for one hundred conversations.',
    ]);
    const input =
      'Great question. Starter is thirty dollars per month for one hundred conversations. Want to sign up?';
    const { text, hits } = stripPrices(input, allowed);
    expect(text).toBe(input.replace(/\s{2,}/g, ' ').trim());
    expect(hits.length).toBe(0);
  });

  it('still strips a free-form LLM rephrase that does not match', () => {
    const allowed = new Set([
      'Starter is thirty dollars per month for one hundred conversations.',
    ]);
    const { text, hits } = stripPrices('Starter costs $30 a month.', allowed);
    expect(text).toBe('Starter costs the price on the card a month.');
    expect(hits.length).toBeGreaterThan(0);
  });

  it('treats undefined allowedSpeechTokens as the legacy behavior (no bypass)', () => {
    const { text } = stripPrices('It is $30.');
    expect(text).toBe('It is the price on the card.');
  });

  it('handles multiple allowed tokens in the same string', () => {
    const allowed = new Set([
      'Starter is thirty dollars per month for one hundred conversations.',
      'Growth is sixty dollars per month for five hundred conversations.',
    ]);
    const input =
      'Two options: Starter is thirty dollars per month for one hundred conversations. Or Growth is sixty dollars per month for five hundred conversations.';
    const { text, hits } = stripPrices(input, allowed);
    expect(text).toBe(input);
    expect(hits.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/agent && pnpm vitest run src/postprocess.test.ts
```

Expect failures referencing the new bypass behavior.

- [ ] **Step 3: Extend `stripPrices` signature**

Replace the `stripPrices` function body in `packages/agent/src/postprocess.ts`:

```ts
export function stripPrices(
  input: string,
  allowedSpeechTokens?: Set<string>,
): { text: string; hits: PriceHit[] } {
  // Build a mask: characters covered by an allowed token are protected from scrub.
  const mask = new Uint8Array(input.length);
  if (allowedSpeechTokens && allowedSpeechTokens.size > 0) {
    for (const token of allowedSpeechTokens) {
      if (!token) continue;
      let i = 0;
      while (i < input.length) {
        const j = input.indexOf(token, i);
        if (j < 0) break;
        for (let k = j; k < j + token.length; k++) mask[k] = 1;
        i = j + token.length;
      }
    }
  }

  // Walk patterns: if a match falls entirely inside an allowed span, skip it.
  let text = input;
  const hits: PriceHit[] = [];
  for (const { pattern, re } of PRICE_PATTERNS) {
    text = text.replace(re, (matched, offset: number) => {
      if (isMaskedSpan(mask, offset, matched.length)) return matched;
      hits.push({ pattern, matched });
      return 'the price on the card';
    });
  }
  text = text.replace(/ {2,}/g, ' ').trim();
  return { text, hits };
}

function isMaskedSpan(mask: Uint8Array, start: number, len: number): boolean {
  for (let i = start; i < start + len; i++) {
    if (mask[i] !== 1) return false;
  }
  return len > 0;
}
```

> **Tricky:** the offset arg in `String.prototype.replace` callback maps to the position in the ORIGINAL string at the time of replace, but successive replacements can shift offsets. Since we use four separate `re.replace` calls in sequence, the mask we built off the original `input` becomes stale after the first pass. Fix: rebuild the mask off the running `text` at the start of each loop iteration.

Replace the function body with this corrected version:

```ts
export function stripPrices(
  input: string,
  allowedSpeechTokens?: Set<string>,
): { text: string; hits: PriceHit[] } {
  let text = input;
  const hits: PriceHit[] = [];
  for (const { pattern, re } of PRICE_PATTERNS) {
    const mask = buildMask(text, allowedSpeechTokens);
    text = text.replace(re, (matched, offset: number) => {
      if (isMaskedSpan(mask, offset, matched.length)) return matched;
      hits.push({ pattern, matched });
      return 'the price on the card';
    });
  }
  text = text.replace(/ {2,}/g, ' ').trim();
  return { text, hits };
}

function buildMask(s: string, allowed?: Set<string>): Uint8Array {
  const mask = new Uint8Array(s.length);
  if (!allowed || allowed.size === 0) return mask;
  for (const token of allowed) {
    if (!token) continue;
    let i = 0;
    while (i <= s.length - token.length) {
      const j = s.indexOf(token, i);
      if (j < 0) break;
      for (let k = j; k < j + token.length; k++) mask[k] = 1;
      i = j + token.length;
    }
  }
  return mask;
}

function isMaskedSpan(mask: Uint8Array, start: number, len: number): boolean {
  for (let i = start; i < start + len; i++) {
    if (mask[i] !== 1) return false;
  }
  return len > 0;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd packages/agent && pnpm vitest run src/postprocess.test.ts
```

All existing + 4 new tests should be green.

- [ ] **Step 5: Commit**

```bash
git add packages/agent/src/postprocess.ts packages/agent/src/postprocess.test.ts
git commit -m "feat(agent): stripPrices() respects an allow-list of canonical speech tokens"
```

---

## Task 10: Voice-agent — geminiSession bypass

**Files:**
- Modify: `apps/voice-agent/src/geminiSession.ts`
- Modify: `apps/voice-agent/src/geminiSession.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `apps/voice-agent/src/geminiSession.test.ts`:

```ts
describe('createGeminiSession allow-list bypass', () => {
  it('passes through speak() text that exactly contains an allowed token', async () => {
    const t = mockTransport();
    const s = createGeminiSession({
      transport: t,
      voiceId: 'kore',
      systemInstruction: 'x',
      allowedSpeechTokens: new Set([
        'Starter is thirty dollars per month for one hundred conversations.',
      ]),
    });
    await s.open();
    await s.speak('Starter is thirty dollars per month for one hundred conversations.');
    expect(t.speak).toHaveBeenCalledOnce();
  });

  it('still rejects an LLM rephrase that contains digits/currency', async () => {
    const t = mockTransport();
    const s = createGeminiSession({
      transport: t,
      voiceId: 'kore',
      systemInstruction: 'x',
      allowedSpeechTokens: new Set([
        'Starter is thirty dollars per month for one hundred conversations.',
      ]),
    });
    await s.open();
    await expect(s.speak('Starter costs $30 a month.')).rejects.toThrow(/numeric/i);
  });

  it('updateAllowedSpeechTokens() replaces the set at runtime', async () => {
    const t = mockTransport();
    const s = createGeminiSession({ transport: t, voiceId: 'kore', systemInstruction: 'x' });
    await s.open();
    s.updateAllowedSpeechTokens(new Set(['Growth is sixty dollars per month for five hundred conversations.']));
    await s.speak('Growth is sixty dollars per month for five hundred conversations.');
    expect(t.speak).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd apps/voice-agent && pnpm vitest run src/geminiSession.test.ts
```

- [ ] **Step 3: Implement bypass**

Replace `apps/voice-agent/src/geminiSession.ts` contents:

```ts
export type GeminiTransportEvent =
  | { type: 'final_transcript'; text: string }
  | { type: 'bot_text_partial'; text: string }
  | { type: 'bot_text'; text: string }
  | { type: 'audio_out'; bytes: Uint8Array }
  | { type: 'speech_started' }
  | { type: 'speech_ended' }
  | { type: 'error'; error: Error };

export type GeminiTransport = {
  open: (cfg: { voiceId: string; systemInstruction: string }) => Promise<void>;
  pushAudio: (frame: Uint8Array) => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  close: () => Promise<void>;
  onEvent: (cb: (e: GeminiTransportEvent) => void) => void;
};

export type GeminiSession = {
  open: () => Promise<void>;
  pushAudio: (frame: Uint8Array) => void;
  speak: (text: string) => Promise<void>;
  interrupt: () => void;
  close: () => Promise<void>;
  onEvent: (cb: (e: GeminiTransportEvent) => void) => void;
  updateAllowedSpeechTokens: (tokens: Set<string>) => void;
};

const NUMERIC_PRICE = /[\$€£¥₹]|\b\d/;

export function createGeminiSession(opts: {
  transport: GeminiTransport;
  voiceId: string;
  systemInstruction: string;
  allowedSpeechTokens?: Set<string>;
}): GeminiSession {
  const { transport, voiceId, systemInstruction } = opts;
  let allowed = new Set(opts.allowedSpeechTokens ?? []);
  return {
    open: () => transport.open({ voiceId, systemInstruction }),
    pushAudio: (f) => transport.pushAudio(f),
    speak: async (text) => {
      if (NUMERIC_PRICE.test(text) && !isFullyCoveredByAllowed(text, allowed)) {
        throw new Error(
          `geminiSession.speak() refused numeric content (defense-in-depth on no-numeric-prices invariant): "${text}"`,
        );
      }
      await transport.speak(text);
    },
    interrupt: () => transport.interrupt(),
    close: () => transport.close(),
    onEvent: (cb) => transport.onEvent(cb),
    updateAllowedSpeechTokens: (tokens) => {
      allowed = new Set(tokens);
    },
  };
}

function isFullyCoveredByAllowed(text: string, allowed: Set<string>): boolean {
  if (allowed.size === 0) return false;
  // Build a mask of allowed spans, then check that every digit/currency char
  // in `text` falls inside one. This lets the visitor hear narration like
  // "Starter is thirty dollars per month for one hundred conversations. Want
  // me to sign you up?" — the digits ban only kicks in for content outside
  // the canonical span.
  const mask = new Uint8Array(text.length);
  for (const token of allowed) {
    if (!token) continue;
    let i = 0;
    while (i <= text.length - token.length) {
      const j = text.indexOf(token, i);
      if (j < 0) break;
      for (let k = j; k < j + token.length; k++) mask[k] = 1;
      i = j + token.length;
    }
  }
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (NUMERIC_PRICE.test(ch) && mask[i] !== 1) return false;
  }
  return true;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd apps/voice-agent && pnpm vitest run src/geminiSession.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/geminiSession.ts apps/voice-agent/src/geminiSession.test.ts
git commit -m "feat(voice-agent): geminiSession.speak() honors allowed-speech-tokens allow-list"
```

---

## Task 11: Agent — host-action + pricing-quote types

**Files:**
- Create: `packages/agent/src/host-actions.ts`
- Modify: `packages/agent/src/types.ts`

- [ ] **Step 1: Create host-action types**

```ts
// packages/agent/src/host-actions.ts
// Cross-process types shared by runtime (server) and widget (browser).
// Kept in a dedicated module so the codec in packages/widget/src/transport
// can import them without pulling the full agent runtime.

export type HostAction =
  | { type: 'navigate'; path: string }
  | { type: 'scroll_to'; intent: string }
  | { type: 'highlight'; intent: string; durationMs?: number }
  | { type: 'click'; intent: string };

export type HostActionResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' | 'timeout' };

export type HostActionRequest = {
  type: 'host_action_request';
  callId: string;
  action: HostAction;
};

export type HostActionResponse = {
  type: 'host_action_result';
  callId: string;
  result: HostActionResult;
};

export type PricingQuote = {
  planId: string;
  speech: string; // server-formatted, never rephrased
  card: {
    name: string;
    priceFormatted: string;
    convCount: number | null;
  };
};
```

- [ ] **Step 2: Extend `SessionState` and `AgentEvent`**

Modify `packages/agent/src/types.ts`. After the existing `AgentEvent` union, add `host_action` and (for chat path) keep parity with widget codec:

```ts
export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'say'; text: string }
  | { type: 'cards'; items: CardItem[] }
  | { type: 'tool_result'; toolName: string; ok: boolean; summary?: string }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number }
  | { type: 'end_of_turn' }
  | { type: 'session_closed'; reason: 'user' | 'cap' | 'error' }
  // Bucket B: host-page action requests (demo merchant only).
  | { type: 'host_action'; callId: string; action: HostAction }
  // Bucket B: persona swap (Beat 2 of the tour).
  | { type: 'persona_swap'; personaId: string };
```

Add the import at the top:
```ts
import type { HostAction } from './host-actions.js';
```

And extend `SessionState`:
```ts
export type SessionState = {
  sessionId: string;
  merchantId: string;
  cartToken: string | null;
  history: AnthropicMessage[];
  turnCount: number;
  voiceMs: number;
  totalMs: number;
  startedAt: number;
  lastTurnAt: number;
  mode: Mode;
  // Bucket B: canonical speech tokens (e.g. server-formatted prices) that
  // postprocess.stripPrices is permitted to pass through verbatim. Cleared at
  // session end.
  allowedSpeechTokens: string[];
};
```

- [ ] **Step 3: Update `state.ts` to seed the new field**

Open `packages/agent/src/state.ts`. Find `createSession` (or equivalent). Add `allowedSpeechTokens: []` to the initial object. Also ensure save/load round-trips preserve it (the Redis JSON serialization should already cover it).

- [ ] **Step 4: Re-export from `index.ts`**

Add to `packages/agent/src/index.ts`:
```ts
export type {
  HostAction,
  HostActionResult,
  HostActionRequest,
  HostActionResponse,
  PricingQuote,
} from './host-actions.js';
export { PLANS, findPlan, type Plan } from './pricing/plans.js';
export { formatPlanSpeech, numberToWords } from './pricing/speech.js';
```

- [ ] **Step 5: Run agent test suite to catch compile errors**

```bash
cd packages/agent && pnpm vitest run
```

Expect all previously-green tests to remain green; new types unused (yet) so no failures.

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/host-actions.ts packages/agent/src/types.ts packages/agent/src/state.ts packages/agent/src/index.ts
git commit -m "feat(agent): introduce HostAction types + allowedSpeechTokens on SessionState"
```

---

## Task 12: Agent — add 5 demo-gated tools to the surface

**Files:**
- Modify: `packages/agent/src/tools.ts`
- Modify: `packages/agent/src/tools.test.ts`

- [ ] **Step 1: Read existing tests to follow established patterns**

Read `packages/agent/src/tools.test.ts` to learn the dispatch-test fixture style.

- [ ] **Step 2: Write failing tests for the new tools**

Append to `packages/agent/src/tools.test.ts`:

```ts
describe('buildToolSurface (demo-merchant gate)', () => {
  it('exposes site.* + pricing.quote tools only when merchant.id === SHOPPINGMATE_DEMO_MERCHANT_ID', () => {
    const demo = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as any;
    const tools = buildToolSurface(demo);
    const names = tools.map((t) => t.function.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'site.navigate',
        'site.scroll_to',
        'site.highlight',
        'site.click',
        'pricing.quote',
      ]),
    );
  });

  it('hides site.* + pricing.quote from non-demo merchants', () => {
    const real = { id: 'M-FOO123', name: 'Real Brand', domain: 'real.example' } as any;
    const tools = buildToolSurface(real);
    const names = tools.map((t) => t.function.name);
    expect(names).not.toEqual(expect.arrayContaining(['site.navigate']));
    expect(names).not.toEqual(expect.arrayContaining(['pricing.quote']));
  });
});

describe('dispatchTool (Bucket B tools)', () => {
  it('pricing.quote returns the canonical speech string for Starter', async () => {
    const fakeAdapter: any = {};
    const ctx: any = {};
    const r = await dispatchTool(fakeAdapter, ctx, 'pricing.quote', { plan_id: 'starter' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const v = r.value as any;
      expect(v.speech).toBe(
        'Starter is thirty dollars per month for one hundred conversations.',
      );
      expect(v.planId).toBe('starter');
      expect(v.card.name).toBe('Starter');
    }
  });

  it('pricing.quote returns not_found for an unknown plan', async () => {
    const r = await dispatchTool({} as any, {} as any, 'pricing.quote', { plan_id: 'mystery' });
    expect(r.ok).toBe(false);
  });
});
```

- [ ] **Step 3: Run — expect fail**

```bash
cd packages/agent && pnpm vitest run src/tools.test.ts
```

- [ ] **Step 4: Add the demo gate constant**

At the top of `packages/agent/src/tools.ts`, add:

```ts
import { findPlan } from './pricing/plans.js';
import { formatPlanSpeech } from './pricing/speech.js';

export const SHOPPINGMATE_DEMO_MERCHANT_ID =
  process.env.SHOPPINGMATE_DEMO_MERCHANT_ID ?? 'SM-XPK2EN';
```

- [ ] **Step 5: Extend `buildToolSurface`**

Replace the function body:

```ts
export function buildToolSurface(merchant: Merchant): ToolDef[] {
  const base: ToolDef[] = [
    // ... keep all 7 existing tools exactly as they are
  ];
  if (merchant.id !== SHOPPINGMATE_DEMO_MERCHANT_ID) return base;
  return [...base, ...DEMO_TOOLS];
}

const DEMO_TOOLS: ToolDef[] = [
  {
    type: 'function',
    function: {
      name: 'site.navigate',
      description:
        "Navigate the visitor's browser to a same-origin path on shoppingmate.ai (demo-only).",
      parameters: {
        type: 'object',
        properties: { path: { type: 'string', description: 'e.g. /pricing, /features' } },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site.scroll_to',
      description: 'Smoothly scroll the visitor to a section matched by free-text intent.',
      parameters: {
        type: 'object',
        properties: {
          intent: {
            type: 'string',
            description: 'e.g. "plan grid", "features section", "starter plan card"',
          },
        },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site.highlight',
      description: 'Visually pulse an element matched by intent for a few seconds.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string' },
          duration_ms: { type: 'integer', minimum: 500, maximum: 6000, default: 2000 },
        },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'site.click',
      description: 'Click an element on the page matched by intent (e.g. the Sign up button).',
      parameters: {
        type: 'object',
        properties: { intent: { type: 'string' } },
        required: ['intent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'pricing.quote',
      description:
        "Get the canonical, server-formatted speech string for a plan. ALWAYS use this when voicing a price. Returns { planId, speech, card }. Speak the `speech` field verbatim — do not paraphrase or rewrite the numbers.",
      parameters: {
        type: 'object',
        properties: {
          plan_id: { type: 'string', enum: ['starter', 'growth', 'enterprise'] },
        },
        required: ['plan_id'],
      },
    },
  },
];
```

- [ ] **Step 6: Extend `dispatchTool`**

Inside the `switch (name)` block in `dispatchTool`, add cases:

```ts
case 'pricing.quote': {
  const plan = findPlan(String(args.plan_id ?? ''));
  if (!plan) return { ok: false, kind: 'not_found', query: String(args.plan_id ?? '') };
  const speech = formatPlanSpeech(plan);
  const priceFormatted =
    plan.priceCents === null ? 'Custom' : `$${(plan.priceCents / 100).toFixed(0)}`;
  return {
    ok: true,
    value: {
      planId: plan.id,
      speech,
      card: { name: plan.displayName, priceFormatted, convCount: plan.convCount },
    },
  };
}
case 'site.navigate':
case 'site.scroll_to':
case 'site.highlight':
case 'site.click': {
  // site.* tools require a runtime-supplied host-action dispatcher (see
  // dispatchTool extended signature in runtime.ts). When dispatchTool is
  // called without one, surface an unsupported error so the LLM apologizes
  // instead of pretending success.
  return {
    ok: false,
    kind: 'unsupported',
    reason: 'host_action_dispatcher_missing',
  };
}
```

- [ ] **Step 7: Run — expect pass**

```bash
cd packages/agent && pnpm vitest run src/tools.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add packages/agent/src/tools.ts packages/agent/src/tools.test.ts
git commit -m "feat(agent): add demo-gated site.* + pricing.quote tools"
```

---

## Task 13: Agent — runtime wires host-action dispatcher + populates allowedSpeechTokens

**Files:**
- Modify: `packages/agent/src/runtime.ts`
- Modify: `packages/agent/src/runtime.test.ts`

- [ ] **Step 1: Write failing test**

Append to `packages/agent/src/runtime.test.ts`:

```ts
describe('runTurn — Bucket B host-action dispatch + pricing.quote', () => {
  it('populates session.allowedSpeechTokens from pricing.quote and passes them to stripPrices', async () => {
    const events: AgentEvent[] = [];
    const fakeChatTools = vi
      .fn()
      // First turn: model calls pricing.quote
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          {
            id: 'tc1',
            name: 'pricing.quote',
            argumentsJson: JSON.stringify({ plan_id: 'starter' }),
          },
        ],
      })
      // Second turn: model emits the canonical speech in plain text
      .mockResolvedValueOnce({
        text: 'Starter is thirty dollars per month for one hundred conversations. Want to sign up?',
        toolCalls: [],
      });
    const saved: SessionState[] = [];
    const session: SessionState = makeBaseSession({
      sessionId: 's1',
      merchantId: 'SM-XPK2EN',
      allowedSpeechTokens: [],
    });
    const merchant = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as any;
    for await (const ev of runTurn(
      {
        loadAdapter: () => fakeAdapter(),
        saveSession: async (s) => { saved.push(s); },
        recordMetric: async () => {},
        chatToolsImpl: fakeChatTools as any,
        dispatchHostAction: async () => ({ ok: true }),
      } as any,
      merchant,
      session,
      { type: 'user_text', sessionId: 's1', text: 'show me pricing', mode: 'voice' },
    )) events.push(ev);

    const sayEvents = events.filter((e): e is { type: 'say'; text: string } => e.type === 'say');
    const sayText = sayEvents.map((e) => e.text).join(' ');
    // Canonical speech survives stripPrices because of the allow-list.
    expect(sayText).toContain(
      'Starter is thirty dollars per month for one hundred conversations.',
    );
    expect(saved.at(-1)?.allowedSpeechTokens).toContain(
      'Starter is thirty dollars per month for one hundred conversations.',
    );
  });

  it('routes site.* tool calls through dispatchHostAction', async () => {
    const dispatched: any[] = [];
    const fakeChatTools = vi
      .fn()
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          { id: 'tc1', name: 'site.navigate', argumentsJson: JSON.stringify({ path: '/pricing' }) },
        ],
      })
      .mockResolvedValueOnce({ text: 'Done — pulled up pricing.', toolCalls: [] });
    const session = makeBaseSession({ merchantId: 'SM-XPK2EN' });
    const merchant = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as any;
    for await (const _ev of runTurn(
      {
        loadAdapter: () => fakeAdapter(),
        saveSession: async () => {},
        recordMetric: async () => {},
        chatToolsImpl: fakeChatTools as any,
        dispatchHostAction: async (action: any) => {
          dispatched.push(action);
          return { ok: true };
        },
      } as any,
      merchant,
      session,
      { type: 'user_text', sessionId: 's1', text: 'show pricing', mode: 'voice' },
    )) { /* drain */ }
    expect(dispatched).toEqual([{ type: 'navigate', path: '/pricing' }]);
  });
});

// helper — extend whatever existing makeBaseSession your suite uses; or add:
function makeBaseSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: 's1',
    merchantId: 'M1',
    cartToken: null,
    history: [],
    turnCount: 0,
    voiceMs: 0,
    totalMs: 0,
    startedAt: Date.now(),
    lastTurnAt: Date.now(),
    mode: 'voice',
    allowedSpeechTokens: [],
    ...overrides,
  };
}
function fakeAdapter() {
  return {
    searchProducts: async () => ({ kind: 'ok', value: [] }),
    getProduct: async () => ({ kind: 'ok', value: null }),
    cartAdd: async () => ({ kind: 'ok', value: { cartToken: 'ct' } }),
    cartUpdate: async () => ({ kind: 'ok', value: null }),
    cartGet: async () => ({ kind: 'ok', value: { lines: [] } }),
    couponApply: async () => ({ kind: 'ok', value: null }),
    checkoutUrl: async () => ({ kind: 'ok', value: 'https://shop/checkout' }),
  } as any;
}
```

> If the existing test file already exports `makeBaseSession` and a fake adapter, reuse them instead of defining new ones — but ensure the existing `makeBaseSession` includes `allowedSpeechTokens: []` so other tests don't break.

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/agent && pnpm vitest run src/runtime.test.ts
```

- [ ] **Step 3: Extend `RunTurnDeps`**

In `packages/agent/src/runtime.ts`, extend the type:

```ts
import type { HostAction, HostActionResult } from './host-actions.js';

export type RunTurnDeps = {
  loadAdapter: (merchant: Merchant, sessionId: string) => Adapter;
  saveSession: (s: SessionState) => Promise<void>;
  recordMetric: (
    name: string,
    tags: Record<string, string | number | boolean>,
    value?: number,
  ) => Promise<void>;
  chatToolsImpl?: typeof chatTools;
  loadPromptOpts?: (merchant: Merchant) => Promise<SystemPromptOpts>;
  // Bucket B: only required for the demo merchant. When undefined, site.* tool
  // calls return `unsupported` and the agent apologizes.
  dispatchHostAction?: (action: HostAction) => Promise<HostActionResult>;
};
```

- [ ] **Step 4: Implement host-action dispatch inside the tool-call loop**

Inside `runTurn`, after the `dispatchTool(adapter, ctx, call.name, args)` call (in the for-loop over `response.toolCalls`), wrap site.* calls:

```ts
let envelope: ToolResultEnvelope;
if (prev >= RETRY_LIMIT_PER_TOOL) {
  envelope = { ok: false, kind: 'retry_exhausted' };
  // ... existing metric
} else {
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(call.argumentsJson) as Record<string, unknown>; } catch {}
  const start = Date.now();
  if (
    call.name === 'site.navigate' ||
    call.name === 'site.scroll_to' ||
    call.name === 'site.highlight' ||
    call.name === 'site.click'
  ) {
    if (!deps.dispatchHostAction) {
      envelope = { ok: false, kind: 'unsupported', reason: 'host_action_dispatcher_missing' };
    } else {
      const action = toHostAction(call.name, args);
      const callId = `${call.id}_host`;
      yield { type: 'host_action', callId, action };
      const result = await deps.dispatchHostAction(action);
      envelope = result.ok
        ? { ok: true, value: result }
        : { ok: false, kind: 'unsupported', reason: result.reason };
    }
  } else {
    envelope = await dispatchTool(adapter, ctx, call.name, args);
  }
  await deps.recordMetric('agent.tool.invoked', {
    merchantId: merchant.id,
    sessionId: session.sessionId,
    toolName: call.name,
    ok: envelope.ok,
    latencyMs: Date.now() - start,
  });
}
```

Add the helper near the bottom of the file:

```ts
function toHostAction(name: string, args: Record<string, unknown>): HostAction {
  switch (name) {
    case 'site.navigate':
      return { type: 'navigate', path: String(args.path ?? '') };
    case 'site.scroll_to':
      return { type: 'scroll_to', intent: String(args.intent ?? '') };
    case 'site.highlight':
      return {
        type: 'highlight',
        intent: String(args.intent ?? ''),
        durationMs: typeof args.duration_ms === 'number' ? args.duration_ms : undefined,
      };
    case 'site.click':
      return { type: 'click', intent: String(args.intent ?? '') };
    default:
      throw new Error(`toHostAction: unknown site tool ${name}`);
  }
}
```

- [ ] **Step 5: Capture allowedSpeechTokens from pricing.quote**

In the same tool-call loop, after `dispatchTool` returns for `pricing.quote`, harvest the speech:

```ts
let accumulatedAllowedTokens = [...session.allowedSpeechTokens];
// inside the for-loop, when envelope.ok && call.name === 'pricing.quote'
if (envelope.ok && call.name === 'pricing.quote') {
  const v = envelope.value as { speech?: string };
  if (typeof v.speech === 'string') {
    accumulatedAllowedTokens.push(v.speech);
  }
}
```

(Move the `let accumulatedAllowedTokens` declaration BEFORE the outer `for (let iter = 0; ...)` loop, so multiple tool calls accumulate.)

- [ ] **Step 6: Pass the accumulator into `stripPrices`**

Find the two `stripPrices(...)` call sites in `runTurn`:
- Inside the `card_tap` branch around the existing `const { text: stripped } = stripPrices(ack.text);`
- The final `const { text: stripped, hits } = stripPrices(responseText);`

Change both to:
```ts
const { text: stripped } = stripPrices(ack.text, new Set(accumulatedAllowedTokens));
```
and:
```ts
const { text: stripped, hits } = stripPrices(responseText, new Set(accumulatedAllowedTokens));
```

- [ ] **Step 7: Persist tokens on save**

When building `updated: SessionState`, set:
```ts
const updated: SessionState = {
  ...session,
  history: [...session.history, { role: 'user', content: userText }, finalAssistant],
  turnCount: session.turnCount + 1,
  voiceMs: session.mode === 'voice' ? session.voiceMs + (Date.now() - now) : session.voiceMs,
  totalMs: Date.now() - session.startedAt,
  lastTurnAt: Date.now(),
  allowedSpeechTokens: accumulatedAllowedTokens,
};
```

Do the same in the `card_tap` branch's `await deps.saveSession({...})` call.

- [ ] **Step 8: Run — expect pass**

```bash
cd packages/agent && pnpm vitest run
```

All previously-green tests must still pass; the 2 new tests must turn green.

- [ ] **Step 9: Commit**

```bash
git add packages/agent/src/runtime.ts packages/agent/src/runtime.test.ts
git commit -m "feat(agent): runtime wires dispatchHostAction + tracks allowedSpeechTokens"
```

---

## Task 14: Agent — tour state machine

**Files:**
- Create: `packages/agent/src/demo-tour.test.ts`
- Create: `packages/agent/src/demo-tour.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/agent/src/demo-tour.test.ts
import { describe, expect, it } from 'vitest';
import { createTour, type TourBeat } from './demo-tour.js';

describe('createTour()', () => {
  it('starts in idle state', () => {
    const t = createTour();
    expect(t.state).toEqual({ status: 'idle' });
  });

  it('advances through the 3 beats on each next() call', () => {
    const t = createTour();
    t.start();
    expect(t.state.status).toBe('running');
    expect((t.state as any).beat).toBe('features');
    t.completeCurrentBeat();
    expect((t.state as any).beat).toBe('persona-swap');
    t.completeCurrentBeat();
    expect((t.state as any).beat).toBe('pricing');
    t.completeCurrentBeat();
    expect(t.state.status).toBe('completed');
  });

  it('pause() suspends, resume() continues at the same beat', () => {
    const t = createTour();
    t.start();
    t.pause();
    expect(t.state.status).toBe('paused');
    t.resume();
    expect(t.state.status).toBe('running');
    expect((t.state as any).beat).toBe('features');
  });

  it('startAt(beat) jumps to a specific beat', () => {
    const t = createTour();
    t.startAt('pricing');
    expect((t.state as any).beat).toBe('pricing');
  });

  it('end() returns to idle and clears progress', () => {
    const t = createTour();
    t.start();
    t.completeCurrentBeat();
    t.end();
    expect(t.state.status).toBe('idle');
  });

  it('describeNextBeat() returns the action list for the agent to plan', () => {
    const t = createTour();
    t.start();
    const plan = t.describeCurrentBeat();
    expect(plan.beat).toBe('features');
    expect(plan.actions.length).toBeGreaterThan(0);
    expect(plan.actions[0]).toMatchObject({ tool: expect.any(String) });
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/agent && pnpm vitest run src/demo-tour.test.ts
```

- [ ] **Step 3: Implement state machine**

Create `packages/agent/src/demo-tour.ts`:

```ts
export type TourBeat = 'features' | 'persona-swap' | 'pricing';

export type TourState =
  | { status: 'idle' }
  | { status: 'running'; beat: TourBeat }
  | { status: 'paused'; beat: TourBeat }
  | { status: 'completed' };

export type BeatPlan = {
  beat: TourBeat;
  /** Human-readable narration the agent layers between actions. */
  narration: string;
  actions: Array<{ tool: string; args: Record<string, unknown> }>;
};

const BEAT_ORDER: TourBeat[] = ['features', 'persona-swap', 'pricing'];

const BEAT_PLANS: Record<TourBeat, BeatPlan> = {
  features: {
    beat: 'features',
    narration:
      "Let me show you the three things shoppingmate does. I'll walk you through each in about twenty seconds.",
    actions: [
      { tool: 'site.navigate', args: { path: '/' } },
      { tool: 'site.scroll_to', args: { intent: 'features section' } },
      { tool: 'site.highlight', args: { intent: 'voice card', duration_ms: 2500 } },
      { tool: 'site.highlight', args: { intent: 'personas card', duration_ms: 2500 } },
      { tool: 'site.highlight', args: { intent: 'install card', duration_ms: 2500 } },
    ],
  },
  'persona-swap': {
    beat: 'persona-swap',
    narration:
      "Here's the cool part — I can sound like any brand. Watch me switch personas mid-sentence.",
    actions: [
      // Persona swap is handled out-of-band by voice-agent — see Task 15.
      // The agent emits a persona_swap event; no host_action is required.
    ],
  },
  pricing: {
    beat: 'pricing',
    narration:
      'Last stop — pricing. The Starter plan is the easiest entry. Let me show you the card and the number.',
    actions: [
      { tool: 'site.navigate', args: { path: '/pricing' } },
      { tool: 'site.scroll_to', args: { intent: 'plan grid' } },
      { tool: 'site.highlight', args: { intent: 'starter plan card', duration_ms: 3000 } },
      { tool: 'pricing.quote', args: { plan_id: 'starter' } },
    ],
  },
};

export type Tour = {
  state: TourState;
  start(): void;
  startAt(beat: TourBeat): void;
  pause(): void;
  resume(): void;
  completeCurrentBeat(): void;
  end(): void;
  describeCurrentBeat(): BeatPlan;
};

export function createTour(): Tour {
  let state: TourState = { status: 'idle' };
  const api: Tour = {
    get state() { return state; },
    start() {
      state = { status: 'running', beat: 'features' };
    },
    startAt(beat) {
      state = { status: 'running', beat };
    },
    pause() {
      if (state.status === 'running') state = { status: 'paused', beat: state.beat };
    },
    resume() {
      if (state.status === 'paused') state = { status: 'running', beat: state.beat };
    },
    completeCurrentBeat() {
      if (state.status !== 'running') return;
      const idx = BEAT_ORDER.indexOf(state.beat);
      const next = BEAT_ORDER[idx + 1];
      state = next ? { status: 'running', beat: next } : { status: 'completed' };
    },
    end() {
      state = { status: 'idle' };
    },
    describeCurrentBeat() {
      if (state.status !== 'running' && state.status !== 'paused') {
        throw new Error('describeCurrentBeat: tour is not running');
      }
      return BEAT_PLANS[state.beat];
    },
  };
  return api;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd packages/agent && pnpm vitest run src/demo-tour.test.ts
```

- [ ] **Step 5: Re-export from `index.ts`**

Append to `packages/agent/src/index.ts`:
```ts
export { createTour, type Tour, type TourBeat, type TourState, type BeatPlan } from './demo-tour.js';
```

- [ ] **Step 6: Commit**

```bash
git add packages/agent/src/demo-tour.ts packages/agent/src/demo-tour.test.ts packages/agent/src/index.ts
git commit -m "feat(agent): add demo-tour state machine (3 beats, interruptible)"
```

---

## Task 15: Voice-agent — persona swap helper

**Files:**
- Create: `apps/voice-agent/src/personaSwap.test.ts`
- Create: `apps/voice-agent/src/personaSwap.ts`

- [ ] **Step 1: Write the failing test**

```ts
// apps/voice-agent/src/personaSwap.test.ts
import { describe, expect, it, vi } from 'vitest';
import { swapPersona } from './personaSwap.js';

describe('swapPersona()', () => {
  it('closes the current session and re-opens with the new voiceId + systemInstruction', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const open = vi.fn().mockResolvedValue(undefined);
    const session: any = { close, open: () => open() };
    await swapPersona({
      session,
      reopen: open,
    });
    expect(close).toHaveBeenCalledOnce();
    expect(open).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd apps/voice-agent && pnpm vitest run src/personaSwap.test.ts
```

- [ ] **Step 3: Implement**

```ts
// apps/voice-agent/src/personaSwap.ts
// Beat 2 of the demo tour: hot-swap the active Gemini voice mid-session so
// the visitor hears Sage → Stella → Sage. Gemini Live doesn't support a
// "change voiceId" call mid-session, so we close + reopen the transport.
// The widget keeps the LiveKit room — only the agent-side Gemini session
// reconnects. Expected 1-2s perceptible silence; documented in the spec.

import type { GeminiSession } from './geminiSession.js';

export type SwapOpts = {
  session: GeminiSession;
  reopen: () => Promise<void>;
};

export async function swapPersona(opts: SwapOpts): Promise<void> {
  await opts.session.close();
  await opts.reopen();
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd apps/voice-agent && pnpm vitest run src/personaSwap.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/personaSwap.ts apps/voice-agent/src/personaSwap.test.ts
git commit -m "feat(voice-agent): add swapPersona helper for tour Beat 2"
```

---

## Task 16: Widget — extend codec for host-action frames

**Files:**
- Modify: `packages/widget/src/transport/codec.ts`
- Modify: existing codec tests (find via `pnpm vitest run` listing)

- [ ] **Step 1: Add encode/decode for `host_action_request` (agent→widget) and `host_action_result` (widget→agent)**

Append to the `AgentEvent` union in `codec.ts`:

```ts
export type AgentEvent =
  | { type: 'thinking' }
  | { type: 'say'; text: string }
  | { type: 'say_partial'; text: string }
  | { type: 'user_text'; text: string }
  | { type: 'cards'; items: CardItem[] }
  | { type: 'tool_result'; toolName: string; ok: boolean; summary?: string }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number }
  | { type: 'end_of_turn' }
  | { type: 'session_closed'; reason: 'user' | 'cap' | 'error' }
  | { type: 'host_action_request'; callId: string; action: HostAction }
  | { type: 'persona_swap'; personaId: string };

export type HostAction =
  | { type: 'navigate'; path: string }
  | { type: 'scroll_to'; intent: string }
  | { type: 'highlight'; intent: string; durationMs?: number }
  | { type: 'click'; intent: string };

export type HostActionResult =
  | { ok: true }
  | { ok: false; reason: 'not_found' | 'stale_target' | 'cross_origin' | 'route_not_found' | 'timeout' };
```

Extend the `WidgetMessage` union with the result back-channel:

```ts
export type WidgetMessage =
  | { type: 'user_text'; sessionId: string; text: string; mode: Mode }
  | { type: 'card_tap'; sessionId: string; action: 'cartAdd'; variantId: string | null; sku: string; qty: number }
  | { type: 'session_resume'; sessionId: string }
  | { type: 'session_end'; sessionId: string }
  | { type: 'host_action_result'; callId: string; result: HostActionResult }
  | { type: 'tour_request' };
```

Extend `decodeAgentEvent` switch with:

```ts
case 'host_action_request': {
  if (typeof o.callId !== 'string' || !o.action) return null;
  const a = o.action as any;
  if (!isValidHostAction(a)) return null;
  return { type: 'host_action_request', callId: o.callId, action: a };
}
case 'persona_swap':
  return typeof o.personaId === 'string' ? { type: 'persona_swap', personaId: o.personaId } : null;
```

And add the validator:

```ts
function isValidHostAction(a: any): a is HostAction {
  if (!a || typeof a.type !== 'string') return false;
  switch (a.type) {
    case 'navigate':
      return typeof a.path === 'string';
    case 'scroll_to':
    case 'highlight':
    case 'click':
      return typeof a.intent === 'string';
    default:
      return false;
  }
}
```

`encodeWidgetMessage` stays a single `JSON.stringify`.

- [ ] **Step 2: Run codec tests**

```bash
cd packages/widget && pnpm vitest run
```

Existing tests should still pass. New types unused = no failures.

- [ ] **Step 3: Add round-trip tests for new frame types**

Locate the existing codec test file (run `pnpm vitest run --list` if needed) and add:

```ts
it('decodes host_action_request', () => {
  const raw = JSON.stringify({
    type: 'host_action_request',
    callId: 'tc1_host',
    action: { type: 'scroll_to', intent: 'plan grid' },
  });
  expect(decodeAgentEvent(raw)).toEqual({
    type: 'host_action_request',
    callId: 'tc1_host',
    action: { type: 'scroll_to', intent: 'plan grid' },
  });
});

it('decodes persona_swap', () => {
  expect(decodeAgentEvent(JSON.stringify({ type: 'persona_swap', personaId: 'stella' }))).toEqual({
    type: 'persona_swap',
    personaId: 'stella',
  });
});

it('rejects host_action_request with invalid action', () => {
  const raw = JSON.stringify({ type: 'host_action_request', callId: 'x', action: { type: 'unknown' } });
  expect(decodeAgentEvent(raw)).toBeNull();
});
```

- [ ] **Step 4: Run — expect pass**

```bash
cd packages/widget && pnpm vitest run
```

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/transport/codec.ts packages/widget/src/transport/codec.test.ts
git commit -m "feat(widget): codec encodes host_action_request + host_action_result + persona_swap"
```

---

## Task 17: Widget — soft prompt bubble

**Files:**
- Create: `packages/widget/src/ui/soft-prompt.ts`
- Create: `packages/widget/src/ui/soft-prompt.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// packages/widget/src/ui/soft-prompt.test.ts
/** @vitest-environment happy-dom */
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { mountSoftPrompt } from './soft-prompt.js';

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

describe('mountSoftPrompt()', () => {
  it('renders nothing for the first 5 seconds', () => {
    const onAccept = vi.fn();
    const onDismiss = vi.fn();
    mountSoftPrompt(document.body, { onAccept, onDismiss });
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
    vi.advanceTimersByTime(4900);
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
  });

  it('appears at 5s of silence', () => {
    mountSoftPrompt(document.body, { onAccept: vi.fn(), onDismiss: vi.fn() });
    vi.advanceTimersByTime(5100);
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).not.toBeNull();
  });

  it('emits onAccept and removes itself when accept is clicked', () => {
    const onAccept = vi.fn();
    mountSoftPrompt(document.body, { onAccept, onDismiss: vi.fn() });
    vi.advanceTimersByTime(5100);
    const acceptBtn = document.querySelector(
      '[data-shoppingmate-soft-prompt] [data-action="accept"]',
    ) as HTMLButtonElement;
    acceptBtn.click();
    expect(onAccept).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
  });

  it('never reappears once dismissed in a session', () => {
    const { cancel } = mountSoftPrompt(document.body, { onAccept: vi.fn(), onDismiss: vi.fn() });
    vi.advanceTimersByTime(5100);
    const dismissBtn = document.querySelector(
      '[data-shoppingmate-soft-prompt] [data-action="dismiss"]',
    ) as HTMLButtonElement;
    dismissBtn.click();
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
    // Even if we wait again, no second prompt should appear.
    vi.advanceTimersByTime(30000);
    expect(document.querySelector('[data-shoppingmate-soft-prompt]')).toBeNull();
    cancel();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd packages/widget && pnpm vitest run src/ui/soft-prompt.test.ts
```

- [ ] **Step 3: Implement**

```ts
// packages/widget/src/ui/soft-prompt.ts
// First-load tour-offer bubble. Appears after 5 seconds of silent mount.
// One-shot per session — once accepted or dismissed, never re-shown.

const ATTR = 'data-shoppingmate-soft-prompt';
const DELAY_MS = 5000;

export type SoftPromptHandle = {
  cancel: () => void;
};

export function mountSoftPrompt(
  host: HTMLElement,
  cb: { onAccept: () => void; onDismiss: () => void },
): SoftPromptHandle {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  let shown = false;
  let bubble: HTMLElement | null = null;

  timer = setTimeout(() => {
    if (cancelled || shown) return;
    shown = true;
    bubble = renderBubble(host, () => {
      cb.onAccept();
      removeBubble();
    }, () => {
      cb.onDismiss();
      removeBubble();
    });
  }, DELAY_MS);

  function removeBubble(): void {
    if (bubble && bubble.parentNode) bubble.parentNode.removeChild(bubble);
    bubble = null;
  }

  return {
    cancel() {
      cancelled = true;
      if (timer) clearTimeout(timer);
      removeBubble();
    },
  };
}

function renderBubble(
  host: HTMLElement,
  onAccept: () => void,
  onDismiss: () => void,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.setAttribute(ATTR, '');
  Object.assign(wrap.style, {
    position: 'fixed',
    right: '24px',
    bottom: '96px',
    maxWidth: '320px',
    background: 'white',
    color: '#0b0b14',
    padding: '14px 16px',
    borderRadius: '16px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
    lineHeight: '1.4',
    zIndex: '2147483645',
  } satisfies Partial<CSSStyleDeclaration>);
  wrap.innerHTML = `
    <div style="font-weight:600;margin-bottom:6px;">Want a quick tour?</div>
    <div style="opacity:.85;margin-bottom:10px;">Sage will walk you through what shoppingmate does in about a minute.</div>
    <div style="display:flex;gap:8px;">
      <button data-action="accept" style="flex:1;padding:8px 12px;border:0;border-radius:10px;background:#8b5cf6;color:white;font-weight:600;cursor:pointer;">Yes, show me</button>
      <button data-action="dismiss" style="padding:8px 12px;border:1px solid #e5e7eb;background:white;border-radius:10px;cursor:pointer;">Not now</button>
    </div>
  `;
  wrap.querySelector('[data-action="accept"]')?.addEventListener('click', onAccept);
  wrap.querySelector('[data-action="dismiss"]')?.addEventListener('click', onDismiss);
  host.appendChild(wrap);
  return wrap;
}
```

- [ ] **Step 4: Run — expect pass**

```bash
cd packages/widget && pnpm vitest run src/ui/soft-prompt.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/widget/src/ui/soft-prompt.ts packages/widget/src/ui/soft-prompt.test.ts
git commit -m "feat(widget): add 5s soft-prompt tour-offer bubble"
```

---

## Task 18: Widget — wire host-action executor + soft prompt into widget.ts

**Files:**
- Modify: `packages/widget/src/widget.ts`
- Modify: `packages/widget/src/transport/livekit.ts` (if it owns the data-channel callback)

- [ ] **Step 1: Add handler for incoming `host_action_request` frames**

In `packages/widget/src/widget.ts`, find the function that decodes incoming agent events (search for `decodeAgentEvent`). Add a case:

```ts
import { executeHostAction } from './host/actions.js';

// inside the agent event handler:
case 'host_action_request': {
  const result = await executeHostAction(event.action);
  this.publishWidgetMessage({
    type: 'host_action_result',
    callId: event.callId,
    result,
  });
  return;
}
case 'persona_swap':
  // The voice-agent handles the actual transport reconnect; the widget just
  // shows a brief "switching voice…" indicator. v0.1: no UI feedback yet.
  return;
```

If `publishWidgetMessage` doesn't exist with that exact name, look for the function that publishes outbound WidgetMessages — likely on `this.socket` or `this.voiceMode`. Wire the result through the same back-channel.

- [ ] **Step 2: Mount soft prompt only for the demo merchant**

In the `start()` method of `WidgetElement` (after `bootstrap` succeeds), gate by merchant id:

```ts
import { mountSoftPrompt } from './ui/soft-prompt.js';

const DEMO_MERCHANT_ID = 'SM-XPK2EN';
// ... inside start(), after bootstrap success
if (this.merchantId === DEMO_MERCHANT_ID) {
  mountSoftPrompt(document.body, {
    onAccept: () => {
      this.publishWidgetMessage({ type: 'tour_request' });
      // Force-open the call tray so the visitor can hear Sage immediately.
      this.store.dispatch({ type: 'open_call' }); // or whatever the equivalent is
    },
    onDismiss: () => {},
  });
}
```

> If `this.store.dispatch` doesn't match the actual API, read the store module to find the call-open action; otherwise emit a `user_text` of "yes" through the existing transport — the agent's demo prompt handles it.

- [ ] **Step 3: Manual smoke (no test — DOM integration too deep for happy-dom)**

Run `pnpm build` for the widget. Verify dist/v1.js still under 120 KB gzip:

```bash
cd packages/widget && pnpm build && gzip -c dist/v1.js | wc -c
```

Expect output < 122880 (120 KB).

- [ ] **Step 4: Commit**

```bash
git add packages/widget/src/widget.ts
git commit -m "feat(widget): wire host-action executor + demo soft prompt"
```

---

## Task 19: Voice-agent — bridge implements dispatchHostAction

**Files:**
- Modify: `apps/voice-agent/src/bridge.ts`
- Modify: `apps/voice-agent/src/bridge.test.ts`

- [ ] **Step 1: Add failing test**

Append to `apps/voice-agent/src/bridge.test.ts`:

```ts
describe('bridge.dispatchHostAction()', () => {
  it('publishes a host_action_request to the data channel and resolves with the matching result', async () => {
    const published: any[] = [];
    const bridge = createBridge({
      sessionId: 's1',
      merchantId: 'SM-XPK2EN',
      runTurn: (async function* () {})() as any,
      loadMerchant: async () => ({ id: 'SM-XPK2EN' } as any),
      loadSession: async () => ({} as any),
      saveSession: async () => {},
      recordMetric: async () => {},
      loadAdapter: () => ({} as any),
      speak: async () => {},
      publishData: (msg) => { published.push(msg); },
      closeRoom: () => {},
      interrupt: () => {},
    });
    // The bridge should expose dispatchHostAction; once we publish a request,
    // simulate the widget calling back with the matching result.
    const promise = bridge.dispatchHostAction!({ type: 'navigate', path: '/pricing' });
    expect(published[0]).toMatchObject({
      type: 'host_action_request',
      action: { type: 'navigate', path: '/pricing' },
    });
    const callId = published[0].callId;
    bridge.deliverHostActionResult!({ callId, result: { ok: true } });
    const result = await promise;
    expect(result).toEqual({ ok: true });
  });

  it('times out a host action after 5 seconds with reason: timeout', async () => {
    vi.useFakeTimers();
    const bridge = createBridge({
      sessionId: 's1',
      merchantId: 'SM-XPK2EN',
      runTurn: (async function* () {})() as any,
      loadMerchant: async () => ({ id: 'SM-XPK2EN' } as any),
      loadSession: async () => ({} as any),
      saveSession: async () => {},
      recordMetric: async () => {},
      loadAdapter: () => ({} as any),
      speak: async () => {},
      publishData: () => {},
      closeRoom: () => {},
      interrupt: () => {},
    });
    const promise = bridge.dispatchHostAction!({ type: 'click', intent: 'signup button' });
    vi.advanceTimersByTime(6000);
    const result = await promise;
    expect(result).toEqual({ ok: false, reason: 'timeout' });
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run — expect fail**

```bash
cd apps/voice-agent && pnpm vitest run src/bridge.test.ts
```

- [ ] **Step 3: Extend `Bridge` and `createBridge`**

In `apps/voice-agent/src/bridge.ts`, extend the `Bridge` type:

```ts
import type { HostAction, HostActionResult } from '@shoppingmate/agent';

export type Bridge = {
  handleUserText: (text: string) => Promise<void>;
  handleBargeIn: () => void;
  dispatchHostAction?: (action: HostAction) => Promise<HostActionResult>;
  deliverHostActionResult?: (msg: { callId: string; result: HostActionResult }) => void;
};
```

Extend the `DataChannelMessage` union:

```ts
export type DataChannelMessage =
  | { type: 'user_text'; text: string }
  | { type: 'say'; text: string }
  | { type: 'say_partial'; text: string }
  | { type: 'cards'; items: unknown[] }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; remaining: number }
  | { type: 'session_closed'; reason: string }
  | { type: 'host_action_request'; callId: string; action: HostAction }
  | { type: 'persona_swap'; personaId: string };
```

Implement inside `createBridge`:

```ts
const pending = new Map<string, { resolve: (r: HostActionResult) => void; timer: ReturnType<typeof setTimeout> }>();
let counter = 0;
const HOST_ACTION_TIMEOUT_MS = 5000;

return {
  // ... existing handleUserText / handleBargeIn
  dispatchHostAction(action) {
    return new Promise<HostActionResult>((resolve) => {
      const callId = `ha_${++counter}_${Date.now()}`;
      const timer = setTimeout(() => {
        pending.delete(callId);
        resolve({ ok: false, reason: 'timeout' });
      }, HOST_ACTION_TIMEOUT_MS);
      pending.set(callId, { resolve, timer });
      deps.publishData({ type: 'host_action_request', callId, action });
    });
  },
  deliverHostActionResult({ callId, result }) {
    const entry = pending.get(callId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pending.delete(callId);
    entry.resolve(result);
  },
};
```

Also, in the `routeEvent` switch (where the runtime's AgentEvents are forwarded), add a case for `host_action`:

```ts
case 'host_action':
  deps.publishData({ type: 'host_action_request', callId: event.callId, action: event.action });
  return;
case 'persona_swap':
  deps.publishData({ type: 'persona_swap', personaId: event.personaId });
  return;
```

(Note: the runtime emits a `host_action` event for visibility, but the actual dispatch + waiting happens inside `dispatchHostAction`. Two publishes would be redundant — remove the runtime-side `yield { type: 'host_action', ... }` if it would double-publish. Cleanest fix: only yield in runtime so the bridge can choose to forward via routeEvent OR via dispatchHostAction. Pick ONE: the dispatch path. Update runtime.ts in Task 13 to remove the `yield { type: 'host_action', ... }` if it conflicts.)

> **Engineer:** when you wire this, confirm there's exactly ONE publish per host action — either the runtime yields and the bridge forwards via routeEvent, OR the runtime calls `dispatchHostAction` (which publishes). Right now Task 13 step 4 also yields the event. Choose: remove the `yield { type: 'host_action', ... }` from runtime.ts. The host action is only published via `dispatchHostAction`.

- [ ] **Step 4: Wire `dispatchHostAction` into the runDeps in `handleUserText`**

Inside `handleUserText`, where `runDeps` is constructed:

```ts
const runDeps: RunTurnDeps = {
  loadAdapter: deps.loadAdapter,
  saveSession: deps.saveSession,
  recordMetric: deps.recordMetric,
  dispatchHostAction: api.dispatchHostAction, // self-reference; see below
};
```

Since we're inside `createBridge` returning the object, restructure to capture the api first:

```ts
const api: Bridge = { /* fields */ };
// then return api;
```

…and reference `api.dispatchHostAction!`.

- [ ] **Step 5: Wire the incoming `host_action_result` from the LiveKit data channel**

Find the existing place in voice-agent where inbound widget messages are decoded (search for `host_action_result` once added; it may be in `apps/voice-agent/src/index.ts` where the LiveKit room data channel is bound). When a `host_action_result` frame arrives, call `bridge.deliverHostActionResult({ callId, result })`.

- [ ] **Step 6: Run — expect pass**

```bash
cd apps/voice-agent && pnpm vitest run src/bridge.test.ts
```

- [ ] **Step 7: Commit**

```bash
git add apps/voice-agent/src/bridge.ts apps/voice-agent/src/bridge.test.ts apps/voice-agent/src/index.ts
git commit -m "feat(voice-agent): bridge dispatchHostAction + 5s timeout + result back-channel"
```

---

## Task 20: Voice-agent — system instruction adds tour guidance

**Files:**
- Modify: `packages/agent/src/prompts/voice-instructions.ts`
- Modify: `packages/agent/src/prompts/voice-instructions.test.ts`

- [ ] **Step 1: Read current instruction builder**

Read `packages/agent/src/prompts/voice-instructions.ts` to find the demo-mode branch.

- [ ] **Step 2: Add demo-tour scripting**

Where the demo system prompt is built (likely in `buildVoiceSystemInstruction` with `demoMode: true`), append a section:

```
TOUR TOOLS (DEMO MERCHANT ONLY)
You have host-action tools that let you drive the visitor's browser:
- site.navigate({ path }): move to /pricing, /features, etc.
- site.scroll_to({ intent }): smooth-scroll to a section, e.g. "plan grid"
- site.highlight({ intent, duration_ms }): pulse-ring an element
- site.click({ intent }): click a button (e.g. "signup button")
- pricing.quote({ plan_id }): get the canonical speech string for a plan. ALWAYS use this BEFORE voicing any price.

WHEN THE VISITOR SAYS "show me pricing" OR "what does it cost":
1. site.navigate({ path: "/pricing" })
2. site.scroll_to({ intent: "plan grid" })
3. site.highlight({ intent: "starter plan card" })
4. pricing.quote({ plan_id: "starter" })
5. Then say EXACTLY the `speech` field returned by pricing.quote — do not paraphrase, do not change the numbers, do not add or remove words. Then add a follow-up like "Want me to sign you up?"

When the visitor says "sign me up" or "yes please":
- site.click({ intent: "signup button" })

NEVER pronounce a numeric price from memory — always pricing.quote first.
```

- [ ] **Step 3: Run — expect existing tests still pass**

```bash
cd packages/agent && pnpm vitest run src/prompts/
```

- [ ] **Step 4: Commit**

```bash
git add packages/agent/src/prompts/voice-instructions.ts
git commit -m "feat(agent): voice system instruction teaches tour tool usage"
```

---

## Task 21: Integration test — full tour against happy-dom

**Files:**
- Create: `packages/agent/src/demo-tour.integration.test.ts`

- [ ] **Step 1: Write the integration test**

```ts
// packages/agent/src/demo-tour.integration.test.ts
/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from 'vitest';
import { runTurn } from './runtime.js';
import { executeHostAction } from '../../widget/src/host/actions.js';
import type { SessionState } from './types.js';

describe('Bucket B integration — pricing tour end-to-end', () => {
  it('navigates, scrolls, highlights, quotes Starter, and lets the visitor click signup', async () => {
    // Stand up a fake host page.
    document.body.innerHTML = `
      <section aria-label="Plan grid" data-tour-stop="pricing"></section>
      <div aria-label="Starter plan card" data-tour-stop="starter-plan-card"></div>
      <button aria-label="Sign up" data-tour-stop="signup">Sign up</button>
    `;
    (window as any).location = { origin: 'https://shoppingmate.ai', pathname: '/', href: 'https://shoppingmate.ai/', assign: vi.fn() };

    const fakeChatTools = vi
      .fn()
      // Turn 1: tour kickoff → 4 site tools + pricing.quote
      .mockResolvedValueOnce({
        text: '',
        toolCalls: [
          { id: 't1', name: 'site.navigate', argumentsJson: JSON.stringify({ path: '/pricing' }) },
          { id: 't2', name: 'site.scroll_to', argumentsJson: JSON.stringify({ intent: 'plan grid' }) },
          { id: 't3', name: 'site.highlight', argumentsJson: JSON.stringify({ intent: 'starter plan card' }) },
          { id: 't4', name: 'pricing.quote', argumentsJson: JSON.stringify({ plan_id: 'starter' }) },
        ],
      })
      .mockResolvedValueOnce({
        text: 'Starter is thirty dollars per month for one hundred conversations. Want me to sign you up?',
        toolCalls: [],
      });

    const session: SessionState = {
      sessionId: 's1', merchantId: 'SM-XPK2EN', cartToken: null, history: [],
      turnCount: 0, voiceMs: 0, totalMs: 0, startedAt: Date.now(), lastTurnAt: Date.now(),
      mode: 'voice', allowedSpeechTokens: [],
    };
    const merchant = { id: 'SM-XPK2EN', name: 'shoppingmate', domain: 'shoppingmate.ai' } as any;

    const sayTexts: string[] = [];
    let lastSaved: SessionState | null = null;

    for await (const ev of runTurn(
      {
        loadAdapter: () => ({}) as any,
        saveSession: async (s) => { lastSaved = s; },
        recordMetric: async () => {},
        chatToolsImpl: fakeChatTools as any,
        dispatchHostAction: (action) => executeHostAction(action as any),
      } as any,
      merchant,
      session,
      { type: 'user_text', sessionId: 's1', text: 'show me pricing', mode: 'voice' },
    )) {
      if (ev.type === 'say') sayTexts.push(ev.text);
    }

    const sayJoined = sayTexts.join(' ');
    expect(sayJoined).toContain('Starter is thirty dollars per month for one hundred conversations.');
    expect(lastSaved?.allowedSpeechTokens).toContain(
      'Starter is thirty dollars per month for one hundred conversations.',
    );
    expect(document.querySelector('[data-shoppingmate-pulse-ring]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run**

```bash
cd packages/agent && pnpm vitest run src/demo-tour.integration.test.ts
```

This may surface integration issues — fix them inside the relevant module per the TDD spirit (smallest fix first). If `executeHostAction` import path is wrong, fix the import; if the runtime doesn't reach the say turn, fix the test fixture (it likely needs a third mock return for the synthesis turn).

- [ ] **Step 3: Commit**

```bash
git add packages/agent/src/demo-tour.integration.test.ts
git commit -m "test(agent): Bucket B end-to-end integration — pricing tour drives real DOM"
```

---

## Task 22: Acceptance runbook

**Files:**
- Create: `docs/runbooks/2026-05-19-bucket-b-acceptance.md`

- [ ] **Step 1: Write the 8-step manual smoke runbook**

```markdown
# Bucket B — Demo-Undeniable Acceptance Runbook

**Date:** 2026-05-19
**Tag at completion:** `bucket-b-demo-undeniable-complete`
**Prereq:** `SHOPPINGMATE_DEMO_TOUR_ENABLED=true` set in Railway env for `voice-agent` service; widget v1.x deployed; DNS for `shoppingmate.ai` live.

## Setup
1. Open `https://shoppingmate.ai` in a fresh incognito window.
2. Open DevTools → Network tab → filter on "ws" to confirm LiveKit connection.
3. Open DevTools → Console — no errors expected.

## Smoke

| # | Action | Expected |
|---|--------|----------|
| 1 | Load `shoppingmate.ai`, wait 5s without interacting | Soft prompt bubble appears at lower-right: "Want a quick tour?" |
| 2 | Click **Yes, show me** | Call tray opens; Sage starts speaking; Beat 1 runs: scroll to features, three highlight pulses with narration |
| 3 | During Beat 1, say "wait, how does install work?" | Tour pauses; Sage answers the question; asks "want me to continue?" |
| 4 | Say "yes, continue" | Beat 2: brief silence (~1-2s) as voice swaps to Stella; one sentence in Stella's voice; voice swaps back to Sage |
| 5 | Tour transitions to Beat 3 automatically | Navigate to `/pricing`; smooth-scroll to plan grid; Starter card pulses with violet ring; Sage says "Starter is thirty dollars per month for one hundred conversations. Want me to sign you up?" |
| 6 | Inspect transcript log in widget tray | Voiced price matches `formatPlanSpeech('starter')` exactly — no `$30`, no rephrase |
| 7 | Say "sign me up" | `site.click('signup button')` fires; signup modal or `/signup` page opens |
| 8 | Reload page, ignore the soft prompt for 30 seconds | No re-prompt appears in the same session (verify on second reload that the 5s timer fires fresh — session-level dismissal does NOT persist across full reloads, only across the soft-prompt's own lifecycle) |

## Metrics check (24h after enable)

Run:
```sql
SELECT name, SUM(value) FROM metric_events
WHERE name LIKE 'demo.tour.%' OR name LIKE 'pricing.quote.%'
  AND created_at > NOW() - INTERVAL '24 hours'
GROUP BY name ORDER BY 1;
```

Pass criteria:
- `demo.tour_offered → demo.tour_accepted` ratio ≥ 30%
- `pricing.quote.rephrased_blocked` ≤ 5% of `pricing.quote.called`

## On pass
```bash
git tag bucket-b-demo-undeniable-complete
git push --tags
```

## On fail
File issues per failure mode. Common ones:
- AX-tree miss → check that the ARIA labels on the target component still match the agent's intent vocabulary (`packages/agent/src/demo-tour.ts BEAT_PLANS`).
- Price rephrase → confirm `pricing.quote` is being called BEFORE the say turn; check `allowedSpeechTokens` is being persisted across turns in Redis.
- Persona swap stalls > 3s → check Gemini Live latency in Railway logs; may need to keep both voice contexts pre-warmed (Bucket C concern).
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/2026-05-19-bucket-b-acceptance.md
git commit -m "docs: add Bucket B acceptance runbook"
```

---

## Task 23: Feature flag + metrics

**Files:**
- Modify: `apps/voice-agent/src/env.ts`
- Modify: `apps/voice-agent/src/bridge.ts` (gate by flag)
- Modify: `packages/agent/src/runtime.ts` (emit metrics)

- [ ] **Step 1: Add the env flag**

In `apps/voice-agent/src/env.ts`, add:

```ts
export const DEMO_TOUR_ENABLED =
  (process.env.SHOPPINGMATE_DEMO_TOUR_ENABLED ?? 'false').toLowerCase() === 'true';
```

- [ ] **Step 2: Gate `dispatchHostAction` on the flag**

In `apps/voice-agent/src/bridge.ts` `handleUserText`:

```ts
import { DEMO_TOUR_ENABLED } from './env.js';

const runDeps: RunTurnDeps = {
  loadAdapter: deps.loadAdapter,
  saveSession: deps.saveSession,
  recordMetric: deps.recordMetric,
  dispatchHostAction: DEMO_TOUR_ENABLED ? api.dispatchHostAction : undefined,
};
```

When the flag is false, the runtime sees no dispatcher and falls back to "unsupported" — the agent apologizes for missing capability and the visitor still gets a chat. Safe rollback.

- [ ] **Step 3: Add metric emissions to runtime**

In `packages/agent/src/runtime.ts`, where new tools are dispatched:

```ts
// inside the if-block for site.* or pricing.quote
if (call.name === 'pricing.quote') {
  await deps.recordMetric('pricing.quote.called', {
    merchantId: merchant.id,
    sessionId: session.sessionId,
    planId: String(args.plan_id ?? 'unknown'),
  });
}

// inside the final say emission, if a stripPrices hit fires for a substring
// that matched a price pattern WHILE we had a non-empty allowedSpeechTokens,
// emit pricing.quote.rephrased_blocked
if (accumulatedAllowedTokens.length > 0 && hits.length > 0) {
  await deps.recordMetric(
    'pricing.quote.rephrased_blocked',
    { merchantId: merchant.id, sessionId: session.sessionId },
    hits.length,
  );
}
```

Also emit `demo.tour_offered` and friends from the widget side — but the widget already passes through `recordMetric` via the API → metric_events table. Since metric ingestion lives on the API server, add a tiny endpoint or piggyback `tool_invoked` tag (defer if scope creeps).

- [ ] **Step 4: Run tests**

```bash
cd apps/voice-agent && pnpm vitest run
cd packages/agent && pnpm vitest run
```

Expect all green.

- [ ] **Step 5: Commit**

```bash
git add apps/voice-agent/src/env.ts apps/voice-agent/src/bridge.ts packages/agent/src/runtime.ts
git commit -m "feat(voice-agent): gate demo tour behind SHOPPINGMATE_DEMO_TOUR_ENABLED + emit metrics"
```

---

## Task 24: Build verification + bundle-size check

- [ ] **Step 1: Run full monorepo tests**

```bash
pnpm -r vitest run
```

Expect all packages green.

- [ ] **Step 2: Build widget and check gzip size**

```bash
cd packages/widget && pnpm build
ls -la dist/v1.js
gzip -c dist/v1.js | wc -c
```

Expect gzip size < 122880 bytes (120 KB). If over budget, audit the new modules and trim — likely target: `host/ax-tree.ts` (the heaviest new module).

- [ ] **Step 3: Lint pass**

```bash
pnpm -r lint
```

Expect zero errors.

- [ ] **Step 4: Commit any cleanup**

```bash
git status
# only commit if there are auto-fixed lint changes
```

---

## Task 25: Update tracker

**Files:**
- Modify: `docs/go-to-production.md`

- [ ] **Step 1: Mark Bucket B status**

In the Status tracker table at the bottom, update:
```
| B — demo-undeniable | docs/superpowers/specs/2026-05-19-bucket-b-demo-undeniable-design.md | docs/superpowers/plans/2026-05-19-bucket-b-demo-undeniable.md | implementation pending operator sign-off |
```

After acceptance passes and the tag is cut, update to `complete (tag: bucket-b-demo-undeniable-complete)`.

- [ ] **Step 2: Commit**

```bash
git add docs/go-to-production.md
git commit -m "docs: link Bucket B spec + plan in go-to-production tracker"
```

---

## Self-Review Notes

- **Spec coverage:** §4.1 (tools) → Task 12; §4.2 (tour state machine) → Task 14; §4.3 (speech) → Tasks 7+8; §4.4 (stripPrices bypass) → Task 9; §4.5 (gemini bypass) → Task 10; §4.6 (ax-tree) → Task 4; §4.7 (actions) → Task 6; §4.8 (soft prompt) → Task 17; §4.9 (ARIA) → Tasks 1-3. §5 data flow → Task 21 integration. §6 failure matrix → covered by Tasks 6 (action failures), 9+10 (rephrase blocking), 19 (timeout). §7 testing → unit tests in each task; integration in Task 21. §8 rollout → Tasks 1-3 (B.1), 4-6 (B.2), 7-12 (B.3), 14-17 (B.4), 18-21 (B.5), 22-23 (B.6). §9 acceptance → Task 22. §10 generalization path → no implementation; tracked as Bucket C scope.

- **Placeholder scan:** Task 18 has a manual smoke step rather than a unit test (widget DOM wiring is below happy-dom's fidelity); flagged but acceptable. Task 19 step 5 references "the place where inbound widget messages are decoded" — locate it via grep `host_action_result` after Task 16 ships the type. Task 20 step 2 modifies a file the plan author hasn't read in detail; engineer should grep first.

- **Type consistency:** `HostAction`, `HostActionResult`, `HostActionRequest`/`HostActionResponse` defined in Task 11 and re-used in Tasks 12, 13, 16, 19. `allowedSpeechTokens` is `string[]` on `SessionState` and `Set<string>` in `stripPrices` — the runtime converts via `new Set(arr)`. Tool names match across `tools.ts`, `runtime.ts`, `demo-tour.ts`, and `voice-instructions.ts` — verify by grep after Task 14.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-19-bucket-b-demo-undeniable.md`.**

Per the user's standing instruction ("don't ask me, start the implementation plan once writing plan is done and start subagent execution"), proceeding to **subagent-driven-development**.
