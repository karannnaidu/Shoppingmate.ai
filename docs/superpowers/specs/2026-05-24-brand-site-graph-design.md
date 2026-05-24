# Brand Site Graph — Design Spec

**Date:** 2026-05-24
**Owner:** Karan
**Status:** Draft — pending user review before plan
**Sequence:** Slots after Bucket A1 (Plan 7 conversion attribution); precedes Bucket C (protocol layer)

---

## Goal

Build the canonical per-brand "knowledge representation" of a merchant's website — pages, navigation graph, on-screen intents, FAQ, policies, alt text for images and videos, plus a real-time visitor-activity stream. One pipeline; multiple consumers.

V1 consumer: our own Sonnet/Sage agent (stops invented intents, grounds responses in real site structure, gives ambient awareness of what the visitor is doing).

Future consumers (Bucket C): OpenKarta verb mappings, UCP `.well-known` manifest, ACP product feed. All project from the same `SiteGraph` without re-crawling.

## Why this and why now

Sage currently invents intents like `demo_catalog_selection` that match no DOM element — host actions fail silently. The AX-tree resolver works only for visible elements the bot can guess; it has no map of the site. Brand KB is flat text chunks with no structure. There is no representation of nav graph, clickable affordances per page, or alt text.

Bucket C will need this same data foundation to expose merchants to external AI agents (ChatGPT, Google Gemini, Perplexity). Building it once now — with Bucket C as a known future consumer — avoids building two parallel crawl + freshness pipelines.

## Architecture

Three-stage pipeline, hybrid storage, gated rollout. Unit of work: one merchant.

```
┌─────────┐    ┌──────────┐    ┌──────────────┐    ┌────────────┐
│  Crawl  │──▶│ Extract  │──▶│ Project       │──▶│ Consumers  │
│ (raw)   │   │ (struct) │   │ (per-output)  │   │ Sonnet now │
└─────────┘   └──────────┘   └──────────────┘   │ UCP/ACP/OK │
   │              │                │              │ later      │
   ▼              ▼                ▼              └────────────┘
   R2 blobs     PG tables       PG cache tables
   + PG meta    + JSONB extras  (per consumer)
```

**Triggers:** install (full crawl), Shopify/Woo webhook (narrow re-extract + re-project), nightly cron (drift detection), dashboard manual refresh.

**Boundaries:**
- Crawl knows nothing about Sonnet or protocols
- Extract knows nothing about how outputs are consumed
- Projections are pure functions of the structured graph
- A failed projection never corrupts the graph; a failed extract never corrupts raw artifacts

**Rollout gate:** new `merchants.siteGraphEnabled` boolean, default `false`. Flipped `true` for `SHOPPINGMATE_DEMO_MERCHANT_ID` first; default-on for new installs after smoke.

## Components

| Component | Job | Location |
|---|---|---|
| `SiteCrawler` | Fetch sitemap.xml, BFS-walk nav, snapshot HTML + screenshots to R2, write `crawlArtifact` rows | `apps/worker/src/jobs/crawlSite.ts` (new); reuses existing Playwright `withContext()` |
| `SiteExtractor` | Read raw artifacts; LLM-extract structured graph (nav edges, page intents, FAQ Q/A, policy summaries, alt-text index); call vision model for missing alt | `apps/worker/src/jobs/extractSiteGraph.ts` (new) |
| `Projector` (pluggable) | Pure functions: `SiteGraph → consumer output`. V1 ships `projectSonnetAddendum`. Bucket C adds UCP/ACP/OpenKarta projectors as new files. | `packages/site-graph/src/projectors/*.ts` (new package) |
| `WebhookRouter` | Receive Shopify/Woo product/page change webhooks; enqueue narrow re-extract jobs | `apps/api/src/routes/webhooks/` (extend existing) |
| `VisitorActivityTracker` | Capture meaningful visitor actions on the host page, send via LiveKit data channel | `packages/widget/src/host/activity.ts` (new) |
| Prompt builder hook | Fetch latest `sonnet_addendum` projection at session build, inject into new `SITE_GRAPH_SLOT` parallel to `BRAND_KB_SLOT` | `packages/agent/src/prompts/system.ts` (extend) |
| Dashboard review tile | "Site graph: 47 pages indexed, last refreshed 2h ago, [refresh now]" + flag-as-wrong button. V1 read-only + manual refresh; edit UI deferred. | `web/src/app/(dashboard)/site-graph/` (new) |

**New package:** `packages/site-graph/` owns the structured graph types and projector functions. Worker, prompt-builder, and (later) Bucket C protocol shims all depend on it.

## Data model

### R2 layout (raw, immutable per crawl)

```
brand-site-crawls/
  <merchantId>/<crawlId>/
    sitemap.xml
    pages/<urlHash>.html
    screenshots/<urlHash>.png
    assets-manifest.json
```

### Postgres tables (new)

```
siteCrawls
  id (PK), merchantId (FK), startedAt, finishedAt,
  status: pending|running|ok|failed,
  rootUrl, pageCount, errorSummary

crawlArtifacts
  id (PK), crawlId (FK), url, urlHash, contentType,
  storageKey, byteSize, httpStatus, fetchedAt

sitePages
  id (PK), merchantId (FK), url (UNIQUE per merchant),
  pageType: home|pdp|plp|collection|policy|faq|other,
  title, h1, lastSeenCrawlId (FK),
  metaJsonb (description, og:image, canonical, breadcrumb)

siteNavEdges
  id (PK), merchantId (FK),
  fromPageId (FK), toPageId (FK),
  anchorText, linkLocation: header|footer|body|breadcrumb

pageIntents
  id (PK), merchantId (FK), pageId (FK),
  intentKey,                    -- e.g. "starter plan card"
  selectorHint,                 -- best CSS/AX selector found
  intentMetaJsonb               -- confidence, source, alternatives

faqEntries
  id (PK), merchantId (FK), pageId (FK, nullable),
  question, answer, sourceUrl

policyDocuments
  id (PK), merchantId (FK), pageId (FK),
  policyType: returns|shipping|privacy|terms,
  summary,                      -- LLM-extracted 2-3 sentence summary
  fullText                      -- normalized plain text

mediaIndex
  id (PK), merchantId (FK), pageId (FK),
  mediaUrl, mediaType: image|video|video_embed,
  contentHash,                  -- sha256 of fetched bytes; dedupe key
  originalAlt,                  -- what the site shipped (may be empty)
  generatedAlt,                 -- our vision-generated description
  source: original|generated|enriched_original,
  role: hero|product|decorative|background|icon,
  posterFrameKey,               -- R2 key for video poster (videos only)
  durationMs,                   -- videos only
  captionTrackUrl,              -- if <track kind="captions"> exists
  generatedAt

projectionCache
  id (PK), merchantId (FK),
  consumer: sonnet_addendum|ucp_manifest|acp_feed|openkarta,
  output (text or jsonb), generatedAt, sourceGraphVersion

visitorEvents
  id (PK), merchantId (FK), sessionId,
  action: click|route_change|dwell|cart_add|form_focus|outbound_click,
  intentKey, url, elementLabel, timestamp
  -- 30-day retention via worker cron

merchants.siteGraphEnabled BOOLEAN DEFAULT FALSE
merchants.siteGraphVersion INT DEFAULT 0
```

### Indexes

- `sitePages(merchantId, url)`
- `siteNavEdges(merchantId, fromPageId)`
- `pageIntents(merchantId, pageId)`
- `projectionCache(merchantId, consumer)`
- `mediaIndex(merchantId, contentHash)` — dedupe lookup
- `visitorEvents(merchantId, sessionId, timestamp)`

### Types (`packages/site-graph/src/types.ts`)

```ts
export type SiteGraph = {
  merchantId: string;
  version: number;
  pages: SitePage[];
  navEdges: NavEdge[];
  intents: Map<pageId, PageIntent[]>;
  faq: FaqEntry[];
  policies: PolicyDoc[];
  media: Map<contentHash, MediaEntry>;
};

export type Projector<T> = (graph: SiteGraph) => T;
```

### Invariants

- Crawl artifacts are immutable; new crawl = new `crawlId` + new R2 prefix
- Structured tables are mutable; extract upserts by `(merchantId, url)`, cascades nav/intents
- Projections are pure derivations; can be regenerated from graph at any time
- `siteGraphVersion` bumps only after a full successful extract

## Crawl and refresh strategy

### Initial crawl (install-time)

- Trigger: `merchants.siteGraphEnabled` flips `true` → enqueue `crawlSite` job
- Scope: sitemap.xml first; if missing, BFS from `merchant.domain` root
- Limits: max 200 pages, max depth 4, max 10 min wall time, concurrency 4
- Skip: query-string variants, pagination beyond `?page=3`, `?utm_*`, robots.txt `Disallow`
- Output: `siteCrawls` row + R2 artifacts + immediate `extractSiteGraph` enqueue

### Refresh triggers

| Trigger | Scope | Rationale |
|---|---|---|
| Shopify/Woo product webhook | Single page re-fetch + targeted extract | Price/inventory change — cheap, fast |
| Shopify theme/page webhook | Full re-crawl | Layout change invalidates nav + intents |
| Nightly cron 03:00 UTC merchant-local | `HEAD` top 20 pages; re-crawl only if >3 changed | Drift detection without paying full crawl cost |
| Dashboard "refresh now" | Full re-crawl (rate-limited 1/hour per merchant) | Operator override |
| Failed extract auto-retry | Same artifacts, fresh extract | Don't re-crawl if LLM hiccupped |

### Diff detection (nightly)

For each top page, compare `etag` / `last-modified` / content hash.

- Unchanged → skip, no extract
- Changed → enqueue narrow re-extract for that page only
- >3 changed → escalate to full re-crawl (suggests theme update)

### Failure handling

- Crawl fails (network, robots) → `siteCrawls.status = failed`, no graph mutation, alert to ops Slack channel
- Extract fails partially → write what succeeded, leave `siteGraphVersion` UNBUMPED, log gaps
- Extract fails fully → keep prior graph version intact; consumers serve last-known-good projection
- Projection fails → consumer falls back to prior cache row

### Budget guardrails

- LLM extract cost per merchant tracked; hard cap $0.50/refresh, soft warn at $0.25
- Vision calls: per-merchant cap 100/crawl, soft warn at 50
- R2 artifacts garbage-collected after 30 days (keep last 3 crawls per merchant for diff)

### Alt-text generation

Vision model: Gemini 2.5 Flash (already in stack). Dedupe by `contentHash` — same image across pages = one call.

| Case | Action |
|---|---|
| `originalAlt` present, ≥10 chars, not generic | Keep, `source = original` |
| `originalAlt` missing on decorative element | Skip — decorative |
| `originalAlt` missing on hero/product/content image | Vision call → `generatedAlt`, `source = generated` |
| `originalAlt` present but ≤10 chars / generic | Vision call → `generatedAlt`, `source = enriched_original` |
| Video with poster + no caption track | Vision call on poster → describe scene |
| Video without poster | Playwright grabs first frame → vision call |
| YouTube/Vimeo embed | oEmbed metadata first; vision-fallback if missing |

Decorative-detection heuristics: size <40px, repeating, inside `<header>` / `<footer>` icon slot — skip aggressively.

## Runtime consumption

### Sonnet (v1)

`packages/agent/src/prompts/system.ts` gains a `SITE_GRAPH_SLOT` parallel to existing `BRAND_KB_SLOT`. At session build:

1. Check `merchants.siteGraphEnabled` — if false, skip slot entirely (current behavior)
2. Fetch `projectionCache` WHERE `consumer = 'sonnet_addendum'` for this merchant
3. Inject cached text into slot

### Projection format (`projectSonnetAddendum`)

Compact, deterministic, token-budgeted. Target ≤2K tokens for a 50-page brand.

```
SITE MAP — pages you can navigate to:
  /                   home
  /collections/dogs   dog products (PLP)
  /products/kibble-x  Kibble X (PDP)
  /pages/returns      30-day returns policy
  /pages/faq          FAQ — 12 questions indexed
  ...

NAV (from header):
  Home, Shop, About, Contact, Cart

ON-SCREEN INTENTS by page:
  /pricing:
    - "starter plan card"
    - "growth plan card"
    - "sign up button"
  /collections/dogs:
    - "filter by breed"
    - "kibble x card"
    ...

KEY FACTS:
  Returns: 30 days, free shipping both ways
  Shipping: free over $50, 2-day to US
  Hero image: golden retriever eating from steel bowl

FAQ (top 10 by frequency):
  Q: Do you ship internationally?
  A: Yes — US, Canada, UK only.
  ...
```

### Token budget enforcement

- Hard cap 2000 tokens (gpt-tokenizer, matches KB chunker)
- Priority order on overflow: site map > nav > intents > key facts > FAQ. Truncate FAQ first, then intents to top 10/page.
- Truncation logged on `projectionCache.metaJsonb` so dashboard can flag "site too large, graph truncated."

### Fallback behavior

- `siteGraphEnabled = false` → slot omitted, identical to today's prompt (zero regression risk)
- `siteGraphEnabled = true` but no `projectionCache` row (crawl in flight) → slot omitted with one-line note: "Brand site is being indexed; refer to BRAND CONTEXT only."
- Stale projection (>30 days, crawl failing) → still inject but log warning metric `site_graph.stale`

### Intent resolver integration

`packages/widget/src/host/ax-tree.ts::resolveIntent()` currently does pure AX-tree probing. Extend with optional hint lookup: if the resolver receives an intent matching a `pageIntents.intentKey` for the current page, try `selectorHint` first, fall back to AX-tree on miss. Loaded once per session via new lightweight `/v1/site-graph/:merchantId/intents` endpoint.

This closes the loop on invented intents — Sonnet picks from a known list per page; resolver has a known-good selector for each.

### Bucket C consumers (sketch only, not built in v1)

| Consumer | Projector reads | Produces |
|---|---|---|
| `projectUcpManifest` | catalog adapter + brand identity + policies | `.well-known/ucp.json` |
| `projectAcpFeed` | catalog adapter + product page intents | product feed XML |
| `projectOpenKartaVerbs` | nav graph + page intents + catalog | OpenKarta verb mappings |

All three are pure functions of `SiteGraph` + existing `products` table — no new crawl, no new extract, no schema change.

## Visitor-activity awareness

`VisitorActivityTracker` lives in `packages/widget/src/host/activity.ts`. Active only when widget is open AND a session is live (no silent tracking when closed). Passive listeners + IntersectionObserver — never polls.

### Captured events

| Event | Trigger | Why |
|---|---|---|
| `click` | Click on element resolvable to a `pageIntents` row | "Visitor tapped Starter plan card" |
| `route_change` | `popstate` / SPA navigation | "Visitor went /pricing → /signup" |
| `dwell` | IntersectionObserver: ≥50% visible for ≥5s | "Visitor reading Returns policy" |
| `cart_add` | Shopify/Woo cart-event hook OR add-to-cart click | "Visitor added Kibble X to cart" |
| `form_focus` | Focus on signup/checkout form field (NOT value) | "Visitor filling signup form" |
| `outbound_click` | Click on external link | "Visitor opened Trustpilot review page" |

**Never captured:** keystrokes, input values, payment fields, scroll positions per-pixel, mouse movement.

### Wire event (`packages/widget/src/transport/codec.ts`)

```ts
| { type: 'visitor_action';
    sessionId: string;
    action: 'click' | 'route_change' | 'dwell' | 'cart_add' | 'form_focus' | 'outbound_click';
    intentKey: string | null;          // resolved via site graph; null if unmatched
    url: string;
    elementLabel: string | null;       // human-readable for unmatched cases
    timestamp: number;
  }
```

### Debounce / batch

- `click`, `cart_add`, `route_change` fire immediately (high signal)
- `dwell`, `form_focus` debounced 1s
- Max 1 event per 200ms total; overflow dropped with telemetry

### Bridge → Sonnet integration

In `apps/voice-agent/src/bridge.ts`, `visitor_action` events become a context-only message in the Sonnet history (not a user turn — Sonnet sees but does not have to respond):

```
[VISITOR_CONTEXT] At 14:23:08 the visitor clicked "starter plan card" on /pricing.
```

Sonnet's system prompt gains a rule: *"When [VISITOR_CONTEXT] appears, treat it as ambient awareness. Don't acknowledge every action — only speak if it changes what you'd do next. For most actions, stay silent and let the visitor lead."*

### Sage (Gemini Live) integration

Gemini Live doesn't take tool results, so visitor_action events go to Sonnet only. If Sonnet decides to react, Sonnet emits a `say` event → Sage voices it. Visual-only acknowledgments work; Sage won't autonomously narrate clicks.

### Privacy + consent

- Events stored in `visitorEvents` PG table (30-day retention)
- Disclosed in existing widget consent gate privacy section
- Dashboard "Visitor Activity Replay" tile deferred (separate spec, not v1)

## Testing strategy

### Unit

- `SiteCrawler` — fixture sitemap.xml, mock Playwright, assert URL filtering, depth limit, robots respect
- `SiteExtractor` — fixture HTML pages, stub vision/LLM calls with canned JSON, assert table writes
- Each `Projector` — fixture `SiteGraph` in, snapshot test on output
- `VisitorActivityTracker` — happy-dom, fire synthetic events, assert wire messages + debounce window
- Token budget enforcement — synth 200-page graph, assert projector truncates in priority order

### Integration

- End-to-end pipeline: fixture crawl artifacts in R2-mock → extract → project → prompt builder injects → snapshot
- Webhook narrow re-extract: fake Shopify product webhook, assert only affected rows updated, `siteGraphVersion` bumped
- Visitor-action → Sonnet context: synthetic widget click → bridge receives → Sonnet history shows `[VISITOR_CONTEXT]`
- Fallback paths: `siteGraphEnabled=false`, missing projection cache, stale projection — assert prompt builder behavior

### Manual smoke (pre-flip)

- Full crawl on shoppingmate.ai, eyeball projection cache, confirm Sage stops inventing intents in live demo
- Alt-text generation on 5 missing-alt images, eyeball Gemini Vision quality
- Flip flag for one real brand, monitor 24h before generalizing

### Skip (YAGNI)

- Crawler load test — Playwright concurrency=4 already known-safe
- Cross-browser widget tests — activity tracker uses standard APIs
- Vision model A/B — Gemini Flash default; comparison deferred

## Rollout

Three phases, gated by `merchants.siteGraphEnabled`.

### Phase 1 — internal smoke (week 1 after merge)

- Flag flipped only for `SHOPPINGMATE_DEMO_MERCHANT_ID`
- Daily eyeball of projection cache, manual Sage demo sessions
- Success: zero invented intents over 20 demo sessions, projection ≤2K tokens, crawl <5 min

### Phase 2 — design-partner brands (week 2-3)

- Manually flip flag for the 2 design-partner LOI brands (Bucket D1)
- Add dashboard tile (read-only + manual refresh)
- Monitor: vision cost per merchant, crawl failure rate, false-positive intent matches
- Success: <$0.50 vision cost per crawl, ≥90% top-20 pages indexed correctly, no privacy incidents

### Phase 3 — general availability (week 4+)

- Flag default flips to `true` for new installs at signup
- Backfill crawl enqueued automatically post-Shopify-OAuth
- Bucket C protocol shims start consuming `SiteGraph` — new projectors, no new crawl

### Kill switch

- One-line config flip in `apps/api` reverts `siteGraphEnabled` to false for all merchants
- Existing prompts and host-actions keep working — site graph layer is purely additive
- No data migration required for rollback

### Sequence vs other buckets

- **Bucket A1** (Plan 7 conversion attribution) ships first — unblocks revenue
- **Site graph** ships next — foundation for C
- **Bucket C** protocol shims layer on top — pure projector additions, no crawl/extract work
- **Bucket B** (already shipped) gets the immediate Sage-intent-hallucination win via Phase 1 flip

## Open questions / explicit non-goals

**Non-goals for v1:**
- Dashboard edit UI for the graph (read-only + manual refresh button only)
- "Suggested alt-text for your store" SEO feature (separate spec)
- Visitor Activity Replay tile (separate spec)
- UCP / ACP / OpenKarta projectors (Bucket C scope)
- Live page-load latency optimization (graph is async to session, doesn't block)

**Open questions worth flagging:**
- Vision model choice locked to Gemini Flash for v1; switch decision deferred until cost data lands
- Page-template hash sharing with existing `selectorCache` — should `pageIntents.selectorHint` feed into `selectorCache` on validation, or stay separate? Default: stay separate in v1; revisit when both have real usage data.
