# PRD — Marketing site redesign ("show, don't decorate")

Date: 2026-10-31 · Owner: Karan · Status: approved to build (founder asked to proceed without clarifications)

## 1. Problem
The current www.shoppingmate.shop homepage reads as a generic AI template:
- Dark "AI startup" palette, mono caps eyebrow labels ("MEET OLIVIA"), serif-italic flourish on every headline.
- A grid of identical icon-in-a-box feature cards and tiny abstract chips ("LISTENING", "Added to your cart") instead of the product.
- No reason to buy: it never shows the money a store loses today, a real shopper being helped, or what the owner gets back.
- A visitor cannot feel the product even though the real product (Olivia) is live on the page.

## 2. Reference — what makes usefastlane.ai work (studied 2026-10-31)
| Pattern | Fastlane | Our adaptation |
|---|---|---|
| Canvas | White, near-black ink, ONE loud accent (red) with glow, used only for CTAs/highlights | White, ink `#0b0b10`, ONE accent (electric violet `#5b3df5`, already our brand hue) |
| Headline | Huge, tight-tracked grotesk, ≤7 words | Geist 600, `clamp(48px, 8vw, 104px)`, tracking −0.045em, no serif flourishes |
| Nav | Floating glass pill, logo + one CTA | Same: logo · How it works · Pricing · FAQ · Log in · CTA |
| Product | Realistic UI panels with real products/numbers | Realistic store + Olivia call panels, labelled "Example" where invented |
| Proof | Avatar stack + "70,000+ businesses", logo marquee, badges, press | Honest proof only: live on calmosis.com, platform marquee, real latency, live demo button |
| How it works | Sticky loop diagram with a moving marker; text steps scroll | Sticky dotted loop (Install → Learn → Sell → Report → Improve) with a moving dot |
| Texture | Halftone dot art | Halftone dot field in the accent, masked, behind hero |
| Pricing | Clean cards, credits box, one-line trust strip | Same structure from `plan-credits.ts`; trust strip (cancel anytime, Razorpay, your checkout) |

## 3. Goal / success
A store owner understands in 5 seconds **what it is, why they're losing money without it, and how to start**, and can *talk to Olivia* from the hero.
- Primary CTA → `/signup` ("Put Olivia on my store"); secondary → opens the live call ("Talk to Olivia now").
- No fake metrics: any invented UI is labelled "Example"; industry stats are cited (Baymard 70% cart abandonment; ~2–3% typical conversion).
- Lighthouse-level hygiene: no horizontal scroll at 390px, AA contrast, reduced-motion respected.

## 4. Scope
In: marketing layout + homepage (all sections), shared Nav/Footer, light-only marketing theme (dashboard untouched), widget `shoppingmate:open` event.
Out: dashboard redesign; inner marketing pages keep their content but inherit the new Nav/Footer/light theme.

## 5. Page story (sections in order)
1. **Floating pill nav.**
2. **Hero** — H1 "Every shopper gets a salesperson." Sub: Olivia answers, recommends and walks shoppers to checkout — by voice or chat — on Shopify, WooCommerce or any site. CTAs + proof row (live in 60s · any platform · from $30/mo). Visual: realistic store product page with Olivia's call panel playing a short scripted conversation that ends with "Added to cart" → "Order placed".
3. **Platforms marquee** — Shopify, WooCommerce, BigCommerce, Wix, Squarespace, Magento, any website.
4. **Why you need it** — "Your store is losing sales in silence." 100 visitors → ~2 buy (typical), 70% of carts abandoned (Baymard). The reasons are questions nobody answered (size? shipping? which one?). Olivia answers them, in the moment.
5. **How it works** — sticky loop: Paste one line → She learns your store → She sells → You see everything → She gets better. Each step has a realistic panel.
6. **Everything she does** — bento of real UI panels: voice + chat in any language · cart, codes & checkout · customer requests with photo proof · bookings for service businesses · owner dashboard · store insights.
7. **Owner outcome** — "Know it's working in five seconds": dashboard panel (Example data).
8. **Pricing** — 3 cards + top-ups + trust strip.
9. **FAQ** — existing answers, cleaner accordion.
10. **Final CTA** — "Give every shopper a salesperson." + both CTAs.
11. **Footer.**

## 6. Copy rules
Outcomes and verbs, never "AI agent" (founder rule). Short sentences. Prices from `web/src/lib/plan-credits.ts`. Contact hello@shoppingmate.shop.

## 7. Acceptance
- Homepage renders light regardless of saved theme; dashboard still dark.
- 1440 / 1024 / 390 widths: no overflow, nav usable, hero CTA visible above the fold.
- "Talk to Olivia now" opens the live call (mic permission prompt) on desktop and mobile.
- All links resolve (/signup, /login, /pricing, /faq, /install, /legal/privacy).
- Existing tests green; deployed from clean main; verified with real-browser screenshots.
