# Plan of action — marketing site redesign

Spec: `docs/superpowers/specs/2026-10-31-marketing-site-redesign-prd.md`

1. **Theme scoping** — `.mk` wrapper on the marketing layout re-declares light tokens; Tailwind `dark:` variant excludes the `.mk` subtree, so marketing is light-only while the dashboard keeps its theme.
2. **Widget hook** — `window` event `shoppingmate:open` (`detail.mode` = `call` | `chat`) → `openCall()` / chat. Unit test. Rebuild widget bundle (web prebuild).
3. **Primitives** (`components/mk/ui.tsx`) — Container, H2, Lead, Button (accent w/ glow, ink, ghost), Pill, Panel, Halftone, Marquee, Reveal (IntersectionObserver, reduced-motion aware).
4. **Sections** (`components/mk/*`) — Nav, Hero (+ scripted call demo), Platforms, WhyNow, HowItWorks (sticky loop), Capabilities (bento panels), OwnerView, Pricing, Faq, FinalCta, Footer.
5. **Wire** — `(marketing)/page.tsx` uses the new sections; shared Nav/Footer swap on inner pages.
6. **Verify** — typecheck, unit tests, local `next build`; real-browser screenshots at 1440/1024/390 (Playwright — Chrome MCP times out at session start); check overflow, contrast, CTA, live call opens; fix and repeat.
7. **Ship** — commit to main, `vercel deploy --prod`, re-verify on www.shoppingmate.shop.
