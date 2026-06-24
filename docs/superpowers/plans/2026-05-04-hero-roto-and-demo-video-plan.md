# Hero roto.app + Demo Video Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace shoppingmate.ai's hero card and `<Demo />` section with a roto.app-animated living storefront + 4-cut video package, retire "agent" language across the marketing surface, and ship a re-runnable asset generation pipeline.

**Architecture:** Frontend is shared `<RotoPlayer />` component (lazy `<video>` wrapper with `useReducedMotion` swap-to-poster) consumed by `Hero`, `Demo`, `PersonaRange`, `FounderLoom`. Asset pipeline is a small node script set under `apps/api/scripts/video-gen/` that calls fal.ai seedance 2.0 via `@fal-ai/serverless-client` to generate b-roll plates; roto.app overlays + AE composition + edit happen out-of-process per the runbook. Final assets live on Cloudflare R2 at `cdn.shoppingmate.ai/demo/`.

**Tech Stack:** Next.js 16 (App Router — see callout below), React 19, framer-motion 12, Tailwind 4, vitest + @testing-library/react + happy-dom, `@fal-ai/serverless-client`, Cloudflare R2 (S3-compatible), tsx for scripts.

**Spec:** `docs/superpowers/specs/2026-05-04-hero-roto-and-demo-video-design.md`

---

> ⚠️ **Critical: web/AGENTS.md says "This is NOT the Next.js you know."** Before writing any code that touches Next.js APIs, conventions, or file structure, read the relevant guide in `web/node_modules/next/dist/docs/`. Heed deprecation notices.

> ⚠️ **Brand language rule (per `feedback_drop_agent_language.md`):** zero "agent" word in any customer-facing copy this plan touches. Engineering vocabulary in code (`packages/agent/`) is fine.

> ⚠️ **Slack scope rule (per `feedback_slack_scope.md`):** brand-facing surfaces show shoppingmate dashboard / push notifications, never Slack.

---

## File Structure

### Created

```
web/public/demo/
├── hero-loop.poster.jpg                  Static poster for hero roto loop
├── hero-loop.placeholder.mp4             ≤200 KB placeholder for dev (real asset on R2)
├── cinematic-30s.poster.jpg              Static poster for Cut 1 (Demo section)
├── cinematic-30s.placeholder.mp4         ≤200 KB placeholder for dev
├── persona-20s.poster.jpg                Static poster for Cut 3 (PersonaRange section)
├── persona-20s.placeholder.mp4           ≤200 KB placeholder for dev
└── loom-90s.poster.jpg                   Static poster for Cut 2 (FounderLoom section)

web/src/components/
├── RotoPlayer.tsx                        Shared <video> wrapper: reduced-motion + poster + lazy
├── RotoPlayer.test.tsx                   Unit tests for RotoPlayer
├── PersonaRange.tsx                      Section component embedding Cut 3
├── PersonaRange.test.tsx
├── FounderLoom.tsx                       Section component embedding Cut 2
└── FounderLoom.test.tsx

apps/api/scripts/video-gen/
├── README.md                             How to run the scripts
├── fal-client.ts                         Thin wrapper around @fal-ai/serverless-client
├── fal-client.test.ts                    Unit tests for the wrapper
├── generate-cinematic-plates.ts          Generates 2 plates for Cut 1
└── generate-persona-plates.ts            Generates 4 plates for Cut 3

docs/runbooks/
└── demo-video-production.md              End-to-end re-shoot runbook
```

### Modified

```
web/src/components/Hero.tsx                Tagline + sub-line + 8 microinteractions + RotoPlayer
web/src/components/Hero.test.tsx           NEW (none exists today) — covers state machine
web/src/components/Demo.tsx                Embed Cut 1 via RotoPlayer
web/src/app/page.tsx                       Insert <PersonaRange /> + <FounderLoom /> sections
web/package.json                           Add @fal-ai/serverless-client (root or apps/api)
apps/api/package.json                      Add @fal-ai/serverless-client + tsx if missing
```

`.env` and `.env.example` already updated in this session — `FAL_KEY` is set.

---

## Task 1 — RotoPlayer shared component

**Files:**
- Create: `web/src/components/RotoPlayer.tsx`
- Create: `web/src/components/RotoPlayer.test.tsx`

A `<video>` wrapper that:
- Renders a poster `<img>` if `useReducedMotion()` returns `true` OR if the video hasn't loaded
- Auto-plays muted-loop only when `mode="loop"`
- Renders `<video>` with `controls` and `preload="metadata"` when `mode="click-to-play"`
- Accepts `src`, `webmSrc?`, `poster`, `mode`, `aspectRatio`, `className?`

- [ ] **Step 1: Write the failing tests**

```tsx
// web/src/components/RotoPlayer.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RotoPlayer } from "./RotoPlayer";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return {
    ...actual,
    useReducedMotion: vi.fn(),
  };
});

import { useReducedMotion } from "framer-motion";
const mockReduce = vi.mocked(useReducedMotion);

describe("RotoPlayer", () => {
  it("renders an autoplay-muted-loop video when mode='loop' and reduced-motion is off", () => {
    mockReduce.mockReturnValue(false);
    render(
      <RotoPlayer
        src="/demo/hero.mp4"
        poster="/demo/hero.jpg"
        mode="loop"
        aspectRatio="16/9"
      />
    );
    const video = screen.getByTestId("roto-video") as HTMLVideoElement;
    expect(video.autoplay).toBe(true);
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.controls).toBe(false);
  });

  it("renders a click-to-play video when mode='click-to-play'", () => {
    mockReduce.mockReturnValue(false);
    render(
      <RotoPlayer
        src="/demo/cut1.mp4"
        poster="/demo/cut1.jpg"
        mode="click-to-play"
        aspectRatio="16/9"
      />
    );
    const video = screen.getByTestId("roto-video") as HTMLVideoElement;
    expect(video.controls).toBe(true);
    expect(video.autoplay).toBe(false);
  });

  it("renders only the poster image when reduced-motion is on", () => {
    mockReduce.mockReturnValue(true);
    render(
      <RotoPlayer
        src="/demo/hero.mp4"
        poster="/demo/hero.jpg"
        mode="loop"
        aspectRatio="16/9"
      />
    );
    expect(screen.queryByTestId("roto-video")).toBeNull();
    expect(screen.getByTestId("roto-poster")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter web test RotoPlayer
```

Expected: FAIL — "Cannot find module './RotoPlayer'".

- [ ] **Step 3: Implement RotoPlayer**

```tsx
// web/src/components/RotoPlayer.tsx
"use client";

import { useReducedMotion } from "framer-motion";

type Props = {
  src: string;
  webmSrc?: string;
  poster: string;
  mode: "loop" | "click-to-play";
  aspectRatio: string; // e.g. "16/9"
  className?: string;
  ariaLabel?: string;
};

export function RotoPlayer({
  src,
  webmSrc,
  poster,
  mode,
  aspectRatio,
  className,
  ariaLabel,
}: Props) {
  const reduce = useReducedMotion();

  if (reduce) {
    return (
      <img
        data-testid="roto-poster"
        src={poster}
        alt={ariaLabel ?? ""}
        style={{ aspectRatio }}
        className={className}
      />
    );
  }

  const isLoop = mode === "loop";

  return (
    <video
      data-testid="roto-video"
      poster={poster}
      autoPlay={isLoop}
      muted={isLoop}
      loop={isLoop}
      controls={!isLoop}
      playsInline
      preload="metadata"
      style={{ aspectRatio }}
      className={className}
      aria-label={ariaLabel}
    >
      {webmSrc && <source src={webmSrc} type="video/webm" />}
      <source src={src} type="video/mp4" />
    </video>
  );
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter web test RotoPlayer
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/RotoPlayer.tsx web/src/components/RotoPlayer.test.tsx
git commit -m "feat(web): add RotoPlayer shared video wrapper with reduced-motion fallback"
```

---

## Task 2 — Placeholder demo assets

**Files:**
- Create: `web/public/demo/hero-loop.poster.jpg` (1× still, ≤80 KB)
- Create: `web/public/demo/hero-loop.placeholder.mp4` (≤200 KB tiny loop)
- Create: `web/public/demo/cinematic-30s.poster.jpg`
- Create: `web/public/demo/cinematic-30s.placeholder.mp4`
- Create: `web/public/demo/persona-20s.poster.jpg`
- Create: `web/public/demo/persona-20s.placeholder.mp4`
- Create: `web/public/demo/loom-90s.poster.jpg`

Until real assets land, every embed needs *something* to render. Use a 1080p screenshot of the existing Hero card as the hero poster, and 1s solid-color MP4s (≤200 KB) for the placeholder videos so the player works in dev.

- [ ] **Step 1: Generate solid-color placeholder MP4s**

```bash
# From repo root, with ffmpeg installed (any 6.x):
mkdir -p web/public/demo
ffmpeg -f lavfi -i color=c=0x12121A:s=1280x720:r=30 -t 1 \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  web/public/demo/hero-loop.placeholder.mp4
ffmpeg -f lavfi -i color=c=0x12121A:s=1920x1080:r=30 -t 1 \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  web/public/demo/cinematic-30s.placeholder.mp4
ffmpeg -f lavfi -i color=c=0x12121A:s=1920x1080:r=30 -t 1 \
  -c:v libx264 -pix_fmt yuv420p -movflags +faststart \
  web/public/demo/persona-20s.placeholder.mp4
```

- [ ] **Step 2: Generate poster JPGs from the placeholder MP4s**

```bash
ffmpeg -i web/public/demo/hero-loop.placeholder.mp4 -vframes 1 -q:v 8 web/public/demo/hero-loop.poster.jpg
ffmpeg -i web/public/demo/cinematic-30s.placeholder.mp4 -vframes 1 -q:v 8 web/public/demo/cinematic-30s.poster.jpg
ffmpeg -i web/public/demo/persona-20s.placeholder.mp4 -vframes 1 -q:v 8 web/public/demo/persona-20s.poster.jpg
ffmpeg -i web/public/demo/cinematic-30s.placeholder.mp4 -vframes 1 -q:v 8 web/public/demo/loom-90s.poster.jpg
```

- [ ] **Step 3: Verify file sizes**

```bash
du -h web/public/demo/*.{mp4,jpg}
```

All MP4s ≤200 KB, all JPGs ≤80 KB. If any exceed, lower `-r 30` to `-r 10` and retry.

- [ ] **Step 4: Commit**

```bash
git add web/public/demo/
git commit -m "chore(web): add placeholder demo assets (real assets land via runbook)"
```

---

## Task 3 — Hero copy update (tagline + sub-line)

**Files:**
- Modify: `web/src/components/Hero.tsx` (H1 + sub-line lines)

This task is the smallest customer-visible change. Land it first so the new tagline ships even if later tasks are blocked.

- [ ] **Step 1: Replace H1 text**

Find in `web/src/components/Hero.tsx`:

```tsx
The 24/7 sales floor
<br />
your store never had.{" "}
<span className="gradient-text">A voice agent</span> that builds carts.
```

Replace with:

```tsx
<span>Your storefront just learned to talk.</span>
<br />
<span className="gradient-text">And to sell.</span>
```

- [ ] **Step 2: Replace sub-line**

Find:

```tsx
Paste one line of code. Within 8 minutes, an AI sales agent is live —
talking to your visitors, picking variants, applying coupons, and handing
off to your native checkout. <span className="text-text-primary">No
integrations. No PCI scope. No card data ever.</span>
```

Replace with:

```tsx
Paste one line of code. Sage learns your store in 8 minutes and starts
building carts — picking variants, applying coupons, and handing off to
your native checkout. <span className="text-text-primary">No
integrations. No PCI scope. No card data ever.</span>
```

- [ ] **Step 3: Run dev server and visually verify**

```bash
cd web && pnpm dev
```

Open `http://localhost:3000` — confirm new tagline + sub-line render. No "agent" word appears.

- [ ] **Step 4: Run existing tests**

```bash
pnpm --filter web test
```

Expected: existing tests still pass (this change is text-only).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Hero.tsx
git commit -m "feat(web): retire 'agent' language in hero — new tagline + sub-line"
```

---

## Task 4 — Hero state machine + RotoPlayer slot

**Files:**
- Modify: `web/src/components/Hero.tsx`
- Create: `web/src/components/Hero.test.tsx`

Refactor the existing typing/loop state machine to expose hooks the upcoming microinteractions can latch onto: `bubbleIndex`, `loopCompleted`, `couponStampVisible`, `cartCount`, `cartPillVisible`. Replace the static product card preview with a `<RotoPlayer />` slot for the hero loop.

- [ ] **Step 1: Write failing tests for the state machine**

```tsx
// web/src/components/Hero.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return { ...actual, useReducedMotion: vi.fn().mockReturnValue(false) };
});

import { Hero } from "./Hero";

describe("Hero state machine", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("renders the new tagline (no 'agent' word)", () => {
    render(<Hero />);
    expect(screen.getByText(/your storefront just learned to talk/i)).toBeInTheDocument();
    expect(screen.queryByText(/voice agent/i)).toBeNull();
    expect(screen.queryByText(/AI sales agent/i)).toBeNull();
  });

  it("renders the RotoPlayer slot in the hero card", () => {
    render(<Hero />);
    expect(screen.getByTestId("hero-roto-player")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
pnpm --filter web test Hero
```

Expected: "hero-roto-player" testid not found.

- [ ] **Step 3: Replace static product card with RotoPlayer**

In `web/src/components/Hero.tsx`, find the existing product-card block:

```tsx
{/* product card preview */}
<div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3">
  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-violet/20 to-cyan/20">
    <ShoppingBag className="h-5 w-5 text-violet" />
  </div>
  <div className="flex-1">
    <p className="text-sm font-medium">Hydra Soothe Cream — 50ml</p>
    <p className="text-xs text-text-muted">In stock · Fragrance-free</p>
  </div>
  <span className="font-mono text-sm font-semibold tabular-nums">
    ₹1,499
  </span>
</div>
```

Replace with:

```tsx
{/* roto-animated PDP — the "living storefront" */}
<div
  data-testid="hero-roto-player"
  className="relative overflow-hidden rounded-2xl border border-border bg-surface"
>
  <RotoPlayer
    src="/demo/hero-loop.placeholder.mp4"
    poster="/demo/hero-loop.poster.jpg"
    mode="loop"
    aspectRatio="16/10"
    className="w-full"
    ariaLabel="Live demo of Sage on a Glowderma product page"
  />
</div>
```

Add the import at the top:

```tsx
import { RotoPlayer } from "./RotoPlayer";
```

Remove the now-unused `ShoppingBag` import only if it's not used elsewhere in the file.

- [ ] **Step 4: Run tests — verify they pass**

```bash
pnpm --filter web test Hero
```

Expected: 2 tests pass.

- [ ] **Step 5: Visual check**

```bash
cd web && pnpm dev
```

Hero right panel shows the placeholder video (dark frame) with browser chrome above and bubbles below. No layout shift.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Hero.tsx web/src/components/Hero.test.tsx
git commit -m "feat(web): hero — swap static product card for RotoPlayer slot"
```

---

## Task 5 — Microinteraction: magnetic mic button

**Files:**
- Modify: `web/src/components/Hero.tsx` (mic button block)

When cursor is within 80px of the mic button, button translates +4px toward cursor. Spring physics. Skip when reduced-motion is on.

- [ ] **Step 1: Add the mouse-tracking effect**

In `web/src/components/Hero.tsx`, locate the `<button aria-label="Talk">` block. Wrap it in a `MagneticButton` local helper added to the same file:

```tsx
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { useEffect, useRef, useState } from "react";

function MagneticMic({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { mass: 0.4, stiffness: 220, damping: 12 });
  const sy = useSpring(y, { mass: 0.4, stiffness: 220, damping: 12 });

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < 80) {
        x.set((dx / dist) * 4);
        y.set((dy / dist) * 4);
      } else {
        x.set(0);
        y.set(0);
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [reduce, x, y]);

  return (
    <motion.div ref={ref} style={{ x: sx, y: sy }} className="contents">
      {children}
    </motion.div>
  );
}
```

Wrap the existing mic button with `<MagneticMic>...</MagneticMic>`.

- [ ] **Step 2: Visual verify**

```bash
cd web && pnpm dev
```

Move cursor close to the mic button — it should subtly move toward the cursor. Reduced-motion (system setting) → no movement.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter web test Hero
```

Expected: still pass (no behavior tests for this interaction).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Hero.tsx
git commit -m "feat(web): hero microinteraction — magnetic mic button"
```

---

## Task 6 — Microinteraction: bubble spring stagger

**Files:**
- Modify: `web/src/components/Hero.tsx` (Bubble component)

Replace the existing `easeOut` transition on `<Bubble />` with a spring (mass 0.5, damping 12, stiffness 180) for a haptic feel. Reduced-motion swaps to opacity-only.

- [ ] **Step 1: Update Bubble**

In `web/src/components/Hero.tsx`, find the `Bubble` function. Replace its `transition`:

```tsx
function Bubble({
  who,
  text,
  blink,
}: {
  who: "agent" | "user" | string;
  text: string;
  blink?: boolean;
}) {
  const reduce = useReducedMotion();
  const isAgent = who === "agent";
  return (
    <motion.div
      initial={{ opacity: 0, y: reduce ? 0 : 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduce
          ? { duration: 0.15 }
          : { type: "spring", mass: 0.5, damping: 12, stiffness: 180 }
      }
      className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
    >
      {/* ...existing bubble content unchanged... */}
    </motion.div>
  );
}
```

- [ ] **Step 2: Visual verify**

```bash
cd web && pnpm dev
```

Bubbles arrive with a subtle bounce, not a fade. Reduced-motion → flat fade only.

- [ ] **Step 3: Run tests**

```bash
pnpm --filter web test Hero
```

Expected: still pass.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Hero.tsx
git commit -m "feat(web): hero microinteraction — bubble spring stagger"
```

---

## Task 7 — Microinteraction: Sage cursor + cart count tick

**Files:**
- Modify: `web/src/components/Hero.tsx`

When the demo loop reaches `visible === 3` (the third agent line "pop both in your cart"), an SVG cursor glides from PDP center → "Add to Cart" position and clicks; cart count state ticks 0 → 2.

- [ ] **Step 1: Write failing test**

Add to `web/src/components/Hero.test.tsx`:

```tsx
it("ticks cart count to 2 when bubble #3 fires", async () => {
  render(<Hero />);
  // advance state machine: each line takes ~text.length * 32ms typing + 700ms gap
  // simulate by stepping fake timers in chunks until cart count appears
  await waitFor(
    () => {
      // Force-advance: drive ~12 seconds of fake time in 100ms chunks
      for (let i = 0; i < 120; i++) vi.advanceTimersByTime(100);
      expect(screen.getByTestId("hero-cart-count")).toHaveTextContent("2");
    },
    { timeout: 15000 }
  );
});
```

- [ ] **Step 2: Run — fail**

```bash
pnpm --filter web test Hero
```

Expected: testid not found.

- [ ] **Step 3: Add cursor + cart count state**

In `Hero.tsx`, add state at the top of the `Hero` component:

```tsx
const [cartCount, setCartCount] = useState(0);
const [sageCursor, setSageCursor] = useState<{ x: number; y: number } | null>(null);
```

Add an effect that fires when `visible === 3`:

```tsx
useEffect(() => {
  if (reduce) return;
  if (visible === 3 && cartCount === 0) {
    // glide cursor over ~600ms, then click + tick cart
    setSageCursor({ x: 50, y: 40 });
    const t1 = setTimeout(() => setSageCursor({ x: 80, y: 75 }), 100);
    const t2 = setTimeout(() => setCartCount(2), 700);
    const t3 = setTimeout(() => setSageCursor(null), 1100);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }
}, [visible, cartCount, reduce]);
```

Add the cursor element + cart count badge to the hero-roto-player block:

```tsx
<div
  data-testid="hero-roto-player"
  className="relative overflow-hidden rounded-2xl border border-border bg-surface"
>
  <RotoPlayer ... />
  {sageCursor && (
    <motion.div
      className="pointer-events-none absolute h-4 w-4 rounded-full bg-foreground/80 ring-2 ring-background"
      animate={{ left: `${sageCursor.x}%`, top: `${sageCursor.y}%` }}
      transition={{ duration: 0.4, ease: "easeInOut" }}
      aria-hidden
    />
  )}
  <div
    data-testid="hero-cart-count"
    className="absolute right-2 top-2 rounded-full bg-foreground px-2 py-0.5 text-xs font-medium text-background"
  >
    {cartCount}
  </div>
</div>
```

- [ ] **Step 4: Run — pass**

```bash
pnpm --filter web test Hero
```

Expected: cart count tick test passes.

- [ ] **Step 5: Visual verify**

```bash
cd web && pnpm dev
```

Wait for bubble #3 ("pop both in your cart") — cursor blip + badge ticks 0 → 2.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Hero.tsx web/src/components/Hero.test.tsx
git commit -m "feat(web): hero microinteraction — Sage cursor + cart count tick"
```

---

## Task 8 — Microinteraction: coupon stamp

**Files:**
- Modify: `web/src/components/Hero.tsx`

When bubble #5 fires (WINTER15), an SVG stamp rubber-stamps onto the hero-roto-player area with a -2°→0° shake (0.3s). Reduced-motion → no shake.

- [ ] **Step 1: Write failing test**

Add to `web/src/components/Hero.test.tsx`:

```tsx
it("renders the coupon stamp after bubble #5 fires", async () => {
  render(<Hero />);
  await waitFor(
    () => {
      for (let i = 0; i < 250; i++) vi.advanceTimersByTime(100);
      expect(screen.getByTestId("hero-coupon-stamp")).toBeInTheDocument();
    },
    { timeout: 30000 }
  );
});
```

- [ ] **Step 2: Run — fail**

```bash
pnpm --filter web test Hero
```

- [ ] **Step 3: Add stamp state + element**

Add state in `Hero`:

```tsx
const [stampVisible, setStampVisible] = useState(false);
```

Add effect:

```tsx
useEffect(() => {
  if (visible >= 5 && !stampVisible) setStampVisible(true);
  if (visible === 0) setStampVisible(false); // reset on loop
}, [visible, stampVisible]);
```

Add the stamp element inside the `hero-roto-player` block:

```tsx
{stampVisible && (
  <motion.div
    data-testid="hero-coupon-stamp"
    initial={{ opacity: 0, scale: 1.4, rotate: -2 }}
    animate={{ opacity: 1, scale: 1, rotate: 0 }}
    transition={
      reduce
        ? { duration: 0.15 }
        : { type: "spring", mass: 0.6, damping: 11, stiffness: 220 }
    }
    className="absolute bottom-4 left-4 rounded border-2 border-rose-500/80 bg-rose-500/15 px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider text-rose-300"
    aria-hidden
  >
    WINTER15 −₹420
  </motion.div>
)}
```

- [ ] **Step 4: Run — pass**

```bash
pnpm --filter web test Hero
```

- [ ] **Step 5: Visual verify**

After bubble #5, stamp lands with a tiny rotation. Resets when loop restarts.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Hero.tsx web/src/components/Hero.test.tsx
git commit -m "feat(web): hero microinteraction — coupon stamp"
```

---

## Task 9 — Microinteraction: cart pill + CTA pulse

**Files:**
- Modify: `web/src/components/Hero.tsx`

When the demo loop completes (`visible >= lines.length`), slide a "Added 2 items · ₹2,998 · Coupon applied" pill up from bottom-right with spring, AND give the primary "Install in 60 seconds" button a one-time outward ring pulse.

- [ ] **Step 1: Write failing test**

```tsx
it("renders the cart pill after the demo loop completes", async () => {
  render(<Hero />);
  await waitFor(
    () => {
      for (let i = 0; i < 280; i++) vi.advanceTimersByTime(100);
      expect(screen.getByTestId("hero-cart-pill")).toBeInTheDocument();
    },
    { timeout: 35000 }
  );
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Add cart pill + CTA pulse**

Add state + effect in `Hero`:

```tsx
const [pillVisible, setPillVisible] = useState(false);
const [ctaPulse, setCtaPulse] = useState(false);

useEffect(() => {
  if (visible >= lines.length) {
    setPillVisible(true);
    setCtaPulse(true);
    const t = setTimeout(() => setCtaPulse(false), 1200);
    return () => clearTimeout(t);
  } else if (visible === 0) {
    setPillVisible(false);
  }
}, [visible]);
```

Inside `hero-roto-player` block, add:

```tsx
<AnimatePresence>
  {pillVisible && (
    <motion.div
      key="cart-pill"
      data-testid="hero-cart-pill"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={
        reduce
          ? { duration: 0.2 }
          : { type: "spring", mass: 0.6, damping: 14, stiffness: 200 }
      }
      className="absolute bottom-3 right-3 rounded-full border border-border bg-surface-elevated/95 px-3 py-1.5 text-xs font-medium text-text-primary shadow-md backdrop-blur"
    >
      Added 2 items · ₹2,998 · Coupon applied
    </motion.div>
  )}
</AnimatePresence>
```

Add `AnimatePresence` to imports if missing.

For the CTA pulse, locate the primary CTA `<Link>` and wrap it:

```tsx
<div className="relative">
  {ctaPulse && !reduce && (
    <motion.span
      aria-hidden
      initial={{ opacity: 0.45, scale: 1 }}
      animate={{ opacity: 0, scale: 1.35 }}
      transition={{ duration: 1, ease: "easeOut" }}
      className="pointer-events-none absolute inset-0 rounded-full bg-violet/40 blur-md"
    />
  )}
  <Link href="#install" ...existing classes>...</Link>
</div>
```

- [ ] **Step 4: Run — pass**

```bash
pnpm --filter web test Hero
```

- [ ] **Step 5: Visual verify**

After the final bubble, cart pill slides up; CTA pulses once. Loop restart hides pill again.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Hero.tsx web/src/components/Hero.test.tsx
git commit -m "feat(web): hero microinteractions — cart pill + CTA pulse"
```

---

## Task 10 — Demo.tsx — embed Cut 1 cinematic

**Files:**
- Modify: `web/src/components/Demo.tsx`

Replace whatever placeholder demo currently renders with a `<RotoPlayer mode="click-to-play" />` for the 30s cinematic. Keep section heading + intro copy; verify no "agent" word remains.

- [ ] **Step 1: Read existing Demo.tsx**

```bash
cat web/src/components/Demo.tsx
```

Identify the embed slot and any "agent" copy.

- [ ] **Step 2: Replace any "agent" copy**

For every customer-visible string in `Demo.tsx`, replace per the rule:
- "AI agent" / "agent" → "Sage" or rewrite as a verb ("talks to your visitors and closes the sale").

If any line is ambiguous, leave a `// COPY-REVIEW: original was "..."` comment and resolve in the final acceptance pass.

- [ ] **Step 3: Insert RotoPlayer**

Inside the section's main visual slot, add:

```tsx
import { RotoPlayer } from "./RotoPlayer";

<div className="mx-auto max-w-4xl rounded-2xl border border-border bg-surface-elevated p-3 shadow-md">
  <RotoPlayer
    src="/demo/cinematic-30s.placeholder.mp4"
    poster="/demo/cinematic-30s.poster.jpg"
    mode="click-to-play"
    aspectRatio="16/9"
    className="w-full rounded-xl"
    ariaLabel="30-second demo: Sage closing a sale on Glowderma"
  />
</div>
```

- [ ] **Step 4: Visual verify**

```bash
cd web && pnpm dev
```

`<Demo />` section shows poster + play button; clicking plays the placeholder MP4.

- [ ] **Step 5: Run tests**

```bash
pnpm --filter web test
```

Expected: still pass.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/Demo.tsx
git commit -m "feat(web): Demo section — embed Cut 1 cinematic via RotoPlayer"
```

---

## Task 11 — PersonaRange.tsx — new component for Cut 3

**Files:**
- Create: `web/src/components/PersonaRange.tsx`
- Create: `web/src/components/PersonaRange.test.tsx`

Section component titled **"Built for every kind of buyer"** with the 20s persona montage embedded via `<RotoPlayer mode="click-to-play" />`. Below the video, a four-icon strip naming the personas (Fashion · Gadgets · Voice · Inclusive) for SEO + a11y.

- [ ] **Step 1: Write failing test**

```tsx
// web/src/components/PersonaRange.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return { ...actual, useReducedMotion: vi.fn().mockReturnValue(false) };
});

import { PersonaRange } from "./PersonaRange";

describe("PersonaRange", () => {
  it("renders the section heading and the persona montage video", () => {
    render(<PersonaRange />);
    expect(screen.getByRole("heading", { name: /every kind of buyer/i })).toBeInTheDocument();
    expect(screen.getByTestId("roto-video")).toBeInTheDocument();
  });

  it("lists all four personas as text for SEO", () => {
    render(<PersonaRange />);
    expect(screen.getByText(/fashion/i)).toBeInTheDocument();
    expect(screen.getByText(/gadget/i)).toBeInTheDocument();
    expect(screen.getByText(/voice/i)).toBeInTheDocument();
    expect(screen.getByText(/inclusive/i)).toBeInTheDocument();
  });

  it("does not contain the word 'agent'", () => {
    render(<PersonaRange />);
    expect(screen.queryByText(/\bagent\b/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
pnpm --filter web test PersonaRange
```

- [ ] **Step 3: Implement PersonaRange**

```tsx
// web/src/components/PersonaRange.tsx
"use client";

import { Sparkles, Headphones, Globe, Shirt } from "lucide-react";
import { RotoPlayer } from "./RotoPlayer";

const personas = [
  { icon: Shirt, label: "Fashion", note: "size, fit, recommendation" },
  { icon: Sparkles, label: "Gadgets", note: "compare, decide, add" },
  { icon: Headphones, label: "Voice", note: "hands busy, eyes elsewhere" },
  { icon: Globe, label: "Inclusive", note: "every language, every body" },
];

export function PersonaRange() {
  return (
    <section
      id="persona-range"
      className="relative py-20 md:py-28"
      aria-label="Built for every kind of buyer"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
          Built for every kind of buyer.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-text-secondary">
          One install. Fashion sizing, gadget comparisons, hands-busy voice,
          plus-size and non-English buyers — all on the same Sage.
        </p>

        <div className="mt-10 rounded-2xl border border-border bg-surface-elevated p-3 shadow-md">
          <RotoPlayer
            src="/demo/persona-20s.placeholder.mp4"
            poster="/demo/persona-20s.poster.jpg"
            mode="click-to-play"
            aspectRatio="16/9"
            className="w-full rounded-xl"
            ariaLabel="20-second montage: Sage handling four buyer types across four storefront platforms"
          />
        </div>

        <ul className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {personas.map(({ icon: Icon, label, note }) => (
            <li
              key={label}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-violet" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-text-muted">{note}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run — pass**

```bash
pnpm --filter web test PersonaRange
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/PersonaRange.tsx web/src/components/PersonaRange.test.tsx
git commit -m "feat(web): add PersonaRange section with Cut 3 montage embed"
```

---

## Task 12 — FounderLoom.tsx — new component for Cut 2

**Files:**
- Create: `web/src/components/FounderLoom.tsx`
- Create: `web/src/components/FounderLoom.test.tsx`

Section component titled **"How it actually works."** with the 90s loom embedded via `<RotoPlayer mode="click-to-play" />`. Includes a `<track>` for `.vtt` captions when the real asset lands. Below the video, three trust beats pulled from the loom script (verbatim hard lines): the install promise, the cross-platform line, the unit-economics line.

- [ ] **Step 1: Write failing test**

```tsx
// web/src/components/FounderLoom.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("framer-motion", async () => {
  const actual = await vi.importActual<typeof import("framer-motion")>("framer-motion");
  return { ...actual, useReducedMotion: vi.fn().mockReturnValue(false) };
});

import { FounderLoom } from "./FounderLoom";

describe("FounderLoom", () => {
  it("renders the section heading and the loom video", () => {
    render(<FounderLoom />);
    expect(screen.getByRole("heading", { name: /how it actually works/i })).toBeInTheDocument();
    expect(screen.getByTestId("roto-video")).toBeInTheDocument();
  });

  it("renders three trust beats", () => {
    render(<FounderLoom />);
    expect(screen.getByText(/under 60 seconds/i)).toBeInTheDocument();
    expect(screen.getByText(/woo, magento, wix, squarespace/i)).toBeInTheDocument();
    expect(screen.getByText(/70% gross margin/i)).toBeInTheDocument();
  });

  it("does not contain the word 'agent'", () => {
    render(<FounderLoom />);
    expect(screen.queryByText(/\bagent\b/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run — fail**

```bash
pnpm --filter web test FounderLoom
```

- [ ] **Step 3: Implement FounderLoom**

```tsx
// web/src/components/FounderLoom.tsx
"use client";

import { RotoPlayer } from "./RotoPlayer";

const beats = [
  {
    title: "Install in under 60 seconds.",
    body: "Theme settings → custom code → paste one line. No app-store review. No SDK in your bundle.",
  },
  {
    title: "Works on Shopify, Woo, Magento, Wix, Squarespace, and custom.",
    body: "Most competitors are Shopify-only. We're not.",
  },
  {
    title: "70% gross margin, voice included.",
    body: "$30/month to start. No trial gimmicks — your trial is the live demo on shoppingmate.ai.",
  },
];

export function FounderLoom() {
  return (
    <section
      id="founder-loom"
      className="relative py-20 md:py-28"
      aria-label="How shoppingmate actually works"
    >
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <h2 className="font-display text-3xl font-semibold tracking-tight md:text-5xl">
          How it actually works.
        </h2>
        <p className="mt-4 max-w-2xl text-lg text-text-secondary">
          Ninety seconds, real Shopify store, no edits. Karan installs and
          drives Sage through a real conversation.
        </p>

        <div className="mt-10 rounded-2xl border border-border bg-surface-elevated p-3 shadow-md">
          <RotoPlayer
            src="/demo/loom-90s.placeholder.mp4"
            poster="/demo/loom-90s.poster.jpg"
            mode="click-to-play"
            aspectRatio="16/9"
            className="w-full rounded-xl"
            ariaLabel="90-second founder loom: installing shoppingmate on a real Shopify store"
          />
        </div>

        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {beats.map((b) => (
            <li
              key={b.title}
              className="rounded-xl border border-border bg-surface px-5 py-4"
            >
              <p className="text-sm font-semibold text-text-primary">{b.title}</p>
              <p className="mt-1.5 text-sm text-text-secondary">{b.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run — pass**

```bash
pnpm --filter web test FounderLoom
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/FounderLoom.tsx web/src/components/FounderLoom.test.tsx
git commit -m "feat(web): add FounderLoom section with Cut 2 embed + trust beats"
```

---

## Task 13 — page.tsx — wire new sections

**Files:**
- Modify: `web/src/app/page.tsx`

Insert `<PersonaRange />` immediately after `<Hero />`, and `<FounderLoom />` after `<HowItWorks />` (or between `<Demo />` and `<Pricing />` depending on existing order — match what flows best).

- [ ] **Step 1: Read existing page.tsx structure**

```bash
cat web/src/app/page.tsx
```

Identify the section order.

- [ ] **Step 2: Insert new sections**

Add imports:

```tsx
import { PersonaRange } from "@/components/PersonaRange";
import { FounderLoom } from "@/components/FounderLoom";
```

Insert `<PersonaRange />` directly after `<Hero />`. Insert `<FounderLoom />` after the existing `<HowItWorks />` or `<Demo />` (whichever is later in the page) and before `<Pricing />`.

- [ ] **Step 3: Visual verify**

```bash
cd web && pnpm dev
```

Scroll the landing page top-to-bottom: Hero → PersonaRange → ... → FounderLoom → ... → Footer. No layout breaks.

- [ ] **Step 4: Run all tests**

```bash
pnpm --filter web test
```

- [ ] **Step 5: Commit**

```bash
git add web/src/app/page.tsx
git commit -m "feat(web): wire PersonaRange + FounderLoom into landing page"
```

---

## Task 14 — fal-client.ts — fal.ai wrapper

**Files:**
- Create: `apps/api/scripts/video-gen/fal-client.ts`
- Create: `apps/api/scripts/video-gen/fal-client.test.ts`
- Modify: `apps/api/package.json` (add `@fal-ai/serverless-client`, ensure `tsx` is available)

A thin wrapper around `@fal-ai/serverless-client` that exposes `generateVideoFromImage(imagePath, prompt, durationSec, takes)` and writes outputs to a local directory with deterministic filenames.

- [ ] **Step 1: Add the dependency**

```bash
pnpm --filter @shoppingmate/api add @fal-ai/serverless-client
pnpm --filter @shoppingmate/api add -D tsx
```

(Adjust the package name to match `apps/api/package.json`'s `name` field.)

- [ ] **Step 2: Write failing tests**

```ts
// apps/api/scripts/video-gen/fal-client.test.ts
import { describe, expect, it, vi } from "vitest";
import { buildSeedancePayload } from "./fal-client";

describe("fal-client", () => {
  it("buildSeedancePayload produces a 1080p config with the right model id", () => {
    const payload = buildSeedancePayload({
      imageUrl: "https://example.com/plate.jpg",
      prompt: "phone scrolling",
      durationSec: 5,
    });
    expect(payload.model).toBe("fal-ai/seedance/v2/pro/image-to-video");
    expect(payload.input.image_url).toBe("https://example.com/plate.jpg");
    expect(payload.input.prompt).toBe("phone scrolling");
    expect(payload.input.duration).toBe(5);
    expect(payload.input.resolution).toBe("1080p");
  });

  it("buildSeedancePayload caps duration at 10s per fal seedance limit", () => {
    const payload = buildSeedancePayload({
      imageUrl: "https://example.com/plate.jpg",
      prompt: "phone scrolling",
      durationSec: 15,
    });
    expect(payload.input.duration).toBe(10);
  });
});
```

- [ ] **Step 3: Run — fail**

```bash
pnpm --filter @shoppingmate/api test fal-client
```

(If `pnpm test` script doesn't include `fal-client` patterns, add a vitest config in `apps/api/` that includes `scripts/**/*.test.ts`. Assume vitest config already covers `**/*.test.ts`.)

- [ ] **Step 4: Implement fal-client.ts**

```ts
// apps/api/scripts/video-gen/fal-client.ts
import * as fal from "@fal-ai/serverless-client";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

const SEEDANCE_MODEL = "fal-ai/seedance/v2/pro/image-to-video";
const MAX_DURATION_SEC = 10;

export type SeedancePayload = {
  model: string;
  input: {
    image_url: string;
    prompt: string;
    duration: number;
    resolution: "1080p" | "720p";
  };
};

export function buildSeedancePayload(args: {
  imageUrl: string;
  prompt: string;
  durationSec: number;
  resolution?: "1080p" | "720p";
}): SeedancePayload {
  return {
    model: SEEDANCE_MODEL,
    input: {
      image_url: args.imageUrl,
      prompt: args.prompt,
      duration: Math.min(args.durationSec, MAX_DURATION_SEC),
      resolution: args.resolution ?? "1080p",
    },
  };
}

export async function generateVideoFromImage(args: {
  imageUrl: string;
  prompt: string;
  durationSec: number;
  takes: number;
  outDir: string;
  filenamePrefix: string;
}): Promise<string[]> {
  const key = process.env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY missing from env — see .env.example");
  fal.config({ credentials: key });

  const payload = buildSeedancePayload({
    imageUrl: args.imageUrl,
    prompt: args.prompt,
    durationSec: args.durationSec,
  });

  const outputs: string[] = [];
  for (let i = 1; i <= args.takes; i++) {
    const result = (await fal.run(payload.model, { input: payload.input })) as {
      video: { url: string };
    };
    const res = await fetch(result.video.url);
    if (!res.ok) throw new Error(`fal returned ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const path = join(args.outDir, `${args.filenamePrefix}-take${i}.mp4`);
    await writeFile(path, buf);
    outputs.push(path);
    console.log(`  ✓ wrote ${path} (${buf.length} bytes)`);
  }
  return outputs;
}
```

- [ ] **Step 5: Run — pass**

```bash
pnpm --filter @shoppingmate/api test fal-client
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/scripts/video-gen/fal-client.ts apps/api/scripts/video-gen/fal-client.test.ts apps/api/package.json pnpm-lock.yaml
git commit -m "feat(api/scripts): add fal.ai client wrapper for video generation"
```

---

## Task 15 — generate-cinematic-plates.ts

**Files:**
- Create: `apps/api/scripts/video-gen/generate-cinematic-plates.ts`

A `tsx`-runnable script that generates the two cinematic plates (dark phone scrolling at 0:02-0:04, dark bedroom push-in at 0:19-0:23) with 3 takes each. Source plates live as static JPGs in the script's input directory; outputs go to `apps/api/scripts/video-gen/out/cinematic/`.

- [ ] **Step 1: Implement the script**

```ts
// apps/api/scripts/video-gen/generate-cinematic-plates.ts
import { generateVideoFromImage } from "./fal-client";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join(__dirname, "out", "cinematic");

const PLATES = [
  {
    name: "phone-scroll",
    imageUrl: process.env.CINEMATIC_PLATE_PHONE_SCROLL_URL!, // public URL of source still
    prompt:
      "A hand slowly scrolling a silent product page on a phone screen in a dark room, cinematic, soft ambient light, gentle camera drift",
    durationSec: 4,
  },
  {
    name: "nightstand-push",
    imageUrl: process.env.CINEMATIC_PLATE_NIGHTSTAND_URL!,
    prompt:
      "A phone face-up on a dark nightstand, screen lights up with a soft glow, slow camera push-in, intimate nighttime atmosphere",
    durationSec: 4,
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const plate of PLATES) {
    if (!plate.imageUrl) {
      throw new Error(
        `Missing source image URL for plate "${plate.name}". Set CINEMATIC_PLATE_*_URL env vars.`
      );
    }
    console.log(`\nGenerating ${plate.name} (3 takes)...`);
    await generateVideoFromImage({
      imageUrl: plate.imageUrl,
      prompt: plate.prompt,
      durationSec: plate.durationSec,
      takes: 3,
      outDir: OUT_DIR,
      filenamePrefix: plate.name,
    });
  }
  console.log(`\n✓ All cinematic plates written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Add gitignore for outputs**

Append to `.gitignore`:

```
apps/api/scripts/video-gen/out/
```

- [ ] **Step 3: Verify it runs (smoke test only — don't burn credits yet)**

```bash
pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/generate-cinematic-plates.ts
```

Expected without env vars set: clean error "Missing source image URL...". Don't run with real env vars yet — that happens in Task 18.

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/video-gen/generate-cinematic-plates.ts .gitignore
git commit -m "feat(api/scripts): add cinematic-plates generator (fal.ai seedance 2.0)"
```

---

## Task 16 — generate-persona-plates.ts

**Files:**
- Create: `apps/api/scripts/video-gen/generate-persona-plates.ts`

Generates the four persona montage plates (fashion sizing on Shopify-shaped, gadget comparison on Woo-shaped, hands-busy voice on custom, Hindi inclusivity on Wix-shaped). 3 takes each, 5s each.

- [ ] **Step 1: Implement the script**

```ts
// apps/api/scripts/video-gen/generate-persona-plates.ts
import { generateVideoFromImage } from "./fal-client";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const OUT_DIR = join(__dirname, "out", "persona");

const PLATES = [
  {
    name: "fashion-shopify",
    imageUrl: process.env.PERSONA_PLATE_FASHION_URL!,
    prompt:
      "A phone showing a Shopify-style storefront with a jacket product page, hand holds the phone, soft natural daylight, crisp UI focus",
    durationSec: 5,
  },
  {
    name: "gadget-woo",
    imageUrl: process.env.PERSONA_PLATE_GADGET_URL!,
    prompt:
      "Desktop monitor showing a WooCommerce-style storefront with two podcast microphones side by side, clean home-office setup, neutral backdrop",
    durationSec: 5,
  },
  {
    name: "voice-kitchen",
    imageUrl: process.env.PERSONA_PLATE_VOICE_URL!,
    prompt:
      "Bright modern kitchen, hands washing greens at a sink, a phone propped on the counter showing a custom storefront, gentle ambient sound implied",
    durationSec: 5,
  },
  {
    name: "inclusive-wix",
    imageUrl: process.env.PERSONA_PLATE_INCLUSIVE_URL!,
    prompt:
      "A phone showing a Wix-style storefront with a plus-size activewear product page, inviting and inclusive tone, warm light",
    durationSec: 5,
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  for (const plate of PLATES) {
    if (!plate.imageUrl) {
      throw new Error(
        `Missing source image URL for plate "${plate.name}". Set PERSONA_PLATE_*_URL env vars.`
      );
    }
    console.log(`\nGenerating ${plate.name} (3 takes)...`);
    await generateVideoFromImage({
      imageUrl: plate.imageUrl,
      prompt: plate.prompt,
      durationSec: plate.durationSec,
      takes: 3,
      outDir: OUT_DIR,
      filenamePrefix: plate.name,
    });
  }
  console.log(`\n✓ All persona plates written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Smoke verify**

```bash
pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/generate-persona-plates.ts
```

Expected: clean error about missing env vars.

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/video-gen/generate-persona-plates.ts
git commit -m "feat(api/scripts): add persona-plates generator (fal.ai seedance 2.0)"
```

---

## Task 17 — Production runbook

**Files:**
- Create: `docs/runbooks/demo-video-production.md`
- Create: `apps/api/scripts/video-gen/README.md`

End-to-end runbook for re-shooting the video package without my context. The README in `scripts/video-gen/` is a thin pointer to the runbook plus the exact env vars and commands.

- [ ] **Step 1: Write the runbook**

```markdown
<!-- docs/runbooks/demo-video-production.md -->
# Demo Video Production Runbook

End-to-end procedure for producing the four-cut shoppingmate demo video package per spec `docs/superpowers/specs/2026-05-04-hero-roto-and-demo-video-design.md`.

## Prerequisites

- `FAL_KEY` set in `.env` (see `.env.example`)
- `ffmpeg` installed (any 6.x)
- A roto.app account
- After Effects (or DaVinci Resolve free with Fusion)
- DaVinci Resolve free or Capcut for final edit
- A Cloudflare R2 bucket bound to `cdn.shoppingmate.ai/demo/`
- Source stills uploaded to a public URL (e.g. R2 staging bucket) and exported as `CINEMATIC_PLATE_*_URL` and `PERSONA_PLATE_*_URL` env vars

## Step 1 — Capture source stills

Take 1440px-wide screenshots of:
- Glowderma PDP (`glowderma.in/products/sensitive-skin`)
- 4 platform-shaped PDPs for the persona montage (mock or real Shopify/Woo/Magento/Wix stores; do not reuse competitor logos)
- A nightstand-at-night composite for the cinematic push-in scene

Upload each to a public-readable bucket and copy the URLs into a local `.env.production-only` (do NOT commit):

```
CINEMATIC_PLATE_PHONE_SCROLL_URL=https://...
CINEMATIC_PLATE_NIGHTSTAND_URL=https://...
PERSONA_PLATE_FASHION_URL=https://...
PERSONA_PLATE_GADGET_URL=https://...
PERSONA_PLATE_VOICE_URL=https://...
PERSONA_PLATE_INCLUSIVE_URL=https://...
```

## Step 2 — Generate fal.ai plates

Source the env then run the generators:

```bash
set -a; source .env.production-only; set +a
pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/generate-cinematic-plates.ts
pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/generate-persona-plates.ts
```

Expected fal.ai spend: ~$22 cinematic + ~$38 persona = ~$60. Outputs land in `apps/api/scripts/video-gen/out/{cinematic,persona}/`.

## Step 3 — Select takes

Review all 18 takes (3 × 2 cinematic + 3 × 4 persona). Pick the strongest of each plate. If all three takes for any plate are unusable, re-run that plate only with a refined prompt.

## Step 4 — roto.app pass

Upload the selected source stills to roto.app and produce:
- Hero loop — 4–6s, no audio, MP4 + WebM, ≤1.5 MB combined
- Cut 1 storefront-comes-alive — 13s segment, MP4
- Cut 3 four overlay segments — 4–5s each, MP4

Place in a working dir `~/shoppingmate-video-work/roto/`.

## Step 5 — Sage voice generation

Pipe each Sage script line (per spec §6.2–6.4) through the ship-product voice runtime if available. Otherwise hand-match an ElevenLabs voice with the parameters documented in this runbook (TODO: fill in voice ID + stability + similarity once the production voice is locked).

Critical: Sage never voices numeric prices.

## Step 6 — Record the founder loom (Cut 2)

Setup:
- Real Glowderma admin in one tab, real storefront in another
- Loom or OBS with webcam bottom-right + mic + screen capture
- Quiet room, hard cuts disallowed — single take only

Beats and HARD LINES are in spec §6.3. Shoot until the take feels natural; do not edit.

## Step 7 — Composite + edit

In After Effects (or Resolve Fusion):
- Build the phone-mockup + push-notification overlay for cinematic 0:19–0:23
- Build the WINTER15 stamp SVG with -2°→0° shake
- Build the cursor SVG glide animation for cinematic 0:09–0:12
- Composite roto.app outputs onto fal.ai plates

In DaVinci Resolve free (or Capcut):
- Cinematic Cut 1 — 30s @ 1080p, h.264 main, CRF 23
- Persona Cut 3 — 20s @ 1080p, same codec
- Bumper Cut 4 — 6s, cut from Cut 1
- Loom Cut 2 — direct export from screen recording, 1080p

Burn captions on Cut 1, Cut 3, Cut 4. Generate `.vtt` for Cut 2.

Export each cut as 16:9, 9:16, 1:1.

## Step 8 — Upload to R2

```bash
aws s3 cp <local-file> s3://shoppingmate-cdn/demo/<filename> \
  --endpoint-url https://<account>.r2.cloudflarestorage.com \
  --content-type video/mp4 \
  --cache-control "public, max-age=31536000, immutable"
```

(Replace with the team's actual R2 credentials and bucket binding.)

## Step 9 — Swap placeholder URLs in web/

Update the four `<RotoPlayer src="...">` URLs in `web/src/components/Hero.tsx`, `Demo.tsx`, `PersonaRange.tsx`, `FounderLoom.tsx` from `/demo/*.placeholder.mp4` to `https://cdn.shoppingmate.ai/demo/*.mp4`. Keep posters local for fallback.

Run `pnpm --filter web build && pnpm --filter web start` and verify all four embeds load real assets.

## Step 10 — Lighthouse + Smoke

- Lighthouse mobile: Perf ≥ 90, LCP ≤ 2.5s
- Manual smoke: hero loop autoplays muted, all microinteractions fire on cue, all click-to-play videos play with audio, captions render
- Reduced-motion (system setting) → all videos swap to posters; microinteractions skip

## Step 11 — Rotate fal.ai key

The key was pasted in conversation history during the design session. Rotate it at fal.ai → Keys after this run.

## Cost reference

| Cut | fal.ai cost | Notes |
|---|---|---|
| Cinematic | ~$22 | 7s plates × 3 takes + 15s buffer |
| Persona | ~$38 | 20s plates × 3 takes |
| Loom | $0 | Real recording |
| Bumper | $0 | Cut from cinematic |
| **Total** | **~$60** | Per full re-shoot |
```

- [ ] **Step 2: Write the script README**

```markdown
<!-- apps/api/scripts/video-gen/README.md -->
# video-gen

Scripts that drive fal.ai seedance 2.0 to generate b-roll plates for the shoppingmate demo video package.

See `docs/runbooks/demo-video-production.md` for the full end-to-end procedure.

## Quick reference

```bash
# Set FAL_KEY in repo .env (or .env.local) — see .env.example
# Set CINEMATIC_PLATE_*_URL and PERSONA_PLATE_*_URL in .env.production-only
set -a; source .env.production-only; set +a
pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/generate-cinematic-plates.ts
pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/generate-persona-plates.ts
```

Outputs land in `out/cinematic/` and `out/persona/` (gitignored).
```

- [ ] **Step 3: Commit**

```bash
git add docs/runbooks/demo-video-production.md apps/api/scripts/video-gen/README.md
git commit -m "docs(runbook): demo video production end-to-end procedure"
```

---

## Task 18 — Run cinematic plate generator (procedural)

**Files:** none (produces local artifacts in `apps/api/scripts/video-gen/out/cinematic/`)

This task is content production, not code. Skip if Karan plans to run this manually.

- [ ] **Step 1: Capture and upload source stills** (per runbook §1)

- [ ] **Step 2: Set env vars in `.env.production-only`** (do NOT commit)

- [ ] **Step 3: Run the generator**

```bash
set -a; source .env.production-only; set +a
pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/generate-cinematic-plates.ts
```

Verify 6 MP4s land in `apps/api/scripts/video-gen/out/cinematic/`. Spend should be ~$22.

- [ ] **Step 4: Review takes and select**

Pick the best of 3 for each plate. If any plate is unusable across all 3 takes, refine the prompt in `generate-cinematic-plates.ts` and re-run that plate only.

---

## Task 19 — Run persona plate generator (procedural)

**Files:** none (produces local artifacts in `apps/api/scripts/video-gen/out/persona/`)

- [ ] **Step 1: Run the generator** (env already sourced from Task 18)

```bash
pnpm --filter @shoppingmate/api exec tsx apps/api/scripts/video-gen/generate-persona-plates.ts
```

Verify 12 MP4s land. Spend should be ~$38.

- [ ] **Step 2: Review and select takes**

Pick the best of 3 per plate. Hindi-scene fallback: if the Hindi take in roto.app + edit later doesn't read clean, swap to a Spanish take using the same structure (see runbook).

---

## Task 20 — roto.app + AE composition pass (procedural)

**Files:** none (produces final per-cut composites locally)

Follow runbook §4–§7. This is multi-hour creative work; budget 4–8 hours per re-shoot.

- [ ] **Step 1: roto.app pass** (per runbook §4)

- [ ] **Step 2: Sage voice pass** (per runbook §5)

- [ ] **Step 3: Founder loom recording** (per runbook §6)

- [ ] **Step 4: Composite + edit** (per runbook §7)

Final outputs (per cut, in 16:9 / 9:16 / 1:1):
- `cinematic-30s.mp4` (≤8 MB)
- `persona-20s.mp4` (≤6 MB)
- `loom-90s.mp4` (≤30 MB acceptable; lazy-loaded)
- `bumper-6s.mp4` (≤1.5 MB)
- `hero-loop.mp4` + `.webm` (≤1.5 MB combined)

---

## Task 21 — Upload to R2 + swap placeholder URLs

**Files:**
- Modify: `web/src/components/Hero.tsx`
- Modify: `web/src/components/Demo.tsx`
- Modify: `web/src/components/PersonaRange.tsx`
- Modify: `web/src/components/FounderLoom.tsx`

- [ ] **Step 1: Upload final assets** (per runbook §8)

Confirm each file is reachable at `https://cdn.shoppingmate.ai/demo/<filename>` via `curl -I`.

- [ ] **Step 2: Swap URLs**

In each component, replace `/demo/*.placeholder.mp4` with `https://cdn.shoppingmate.ai/demo/<filename>.mp4`. Keep poster paths local for instant fallback.

For the hero loop, also add the `webmSrc` prop:

```tsx
<RotoPlayer
  src="https://cdn.shoppingmate.ai/demo/hero-loop.mp4"
  webmSrc="https://cdn.shoppingmate.ai/demo/hero-loop.webm"
  poster="/demo/hero-loop.poster.jpg"
  mode="loop"
  ...
/>
```

- [ ] **Step 3: Visual verify in dev**

```bash
cd web && pnpm dev
```

All four embeds load real assets; hero loop autoplays muted; click-to-play cuts play with audio.

- [ ] **Step 4: Run all tests**

```bash
pnpm --filter web test
```

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Hero.tsx web/src/components/Demo.tsx web/src/components/PersonaRange.tsx web/src/components/FounderLoom.tsx
git commit -m "feat(web): swap placeholder demo URLs to R2 production assets"
```

---

## Task 22 — Final acceptance walkthrough

**Files:** none (verification only — may produce small follow-up commits)

- [ ] **Step 1: Lighthouse mobile**

```bash
cd web && pnpm build && pnpm start &
sleep 5
npx lighthouse http://localhost:3000 \
  --preset=mobile \
  --only-categories=performance,accessibility \
  --output=json \
  --output-path=./lh-report.json \
  --chrome-flags="--headless"
```

Acceptance: Performance ≥ 90, LCP ≤ 2.5s, Accessibility ≥ 95.

If LCP > 2.5s, check that the hero `<video>` is not the LCP element. Fix by either preloading the hero font more aggressively or removing `autoPlay` on the hero loop until intersection.

- [ ] **Step 2: "agent" word audit (customer-facing)**

```bash
grep -rni "\bagent\b" web/src/app web/src/components | grep -v ".test.tsx" | grep -v "// "
```

Acceptance: zero matches in non-test, non-comment code.

- [ ] **Step 3: Manual smoke walkthrough**

In a real browser at `http://localhost:3000`:
- Hero loads instantly. H1 reads "Your storefront just learned to talk. And to sell."
- Hero card right panel: roto loop autoplays muted; cursor moves to mic on hover; bubbles arrive with spring; bubble #3 → cursor + cart count tick to 2; bubble #5 → coupon stamp; loop finish → cart pill + CTA pulse
- Reduced-motion (devtools or system) → all of the above swap to static states
- `<Demo />` poster loads; click plays Cut 1 with audio + burned captions
- `<PersonaRange />` heading + montage + 4 persona tiles render
- `<FounderLoom />` heading + loom + 3 trust beats render
- No "agent" word anywhere customer-visible

- [ ] **Step 4: Slack scope audit**

Confirm no marketing surface mentions Slack or shows a Slack-shaped notification. Cinematic scene 0:19-0:22 must show the shoppingmate dashboard push notification only.

- [ ] **Step 5: Rotate fal.ai key**

Rotate `FAL_KEY` at fal.ai → Keys (the original key was pasted in chat history during the design session). Update `.env`. Do not commit.

- [ ] **Step 6: Final commit (if any micro-fixes)**

If micro-fixes were made during the walkthrough, commit them with focused messages and stop. Otherwise, this task is complete with no commit.

---

## Done-criteria recap

This plan is done when:

1. New tagline live on shoppingmate.ai hero ✓
2. Hero card shows roto-animated PDP with all 8 microinteractions firing in sync with the demo loop, reduced-motion respected ✓
3. `<Demo />` plays the 30s cinematic with burned captions ✓
4. `<PersonaRange />` plays the 20s persona montage ✓
5. `<FounderLoom />` plays the 90s loom with `.vtt` captions ✓
6. Bumper available on R2 for paid retargeting (not on landing) ✓
7. Lighthouse mobile: Perf ≥ 90, LCP ≤ 2.5s, A11y ≥ 95 ✓
8. Zero "agent" word in customer-facing copy ✓
9. Zero Slack mentions / Slack-shaped UI in marketing surfaces ✓
10. Runbook lets the team re-shoot without my context ✓
11. fal.ai key rotated post-production ✓
