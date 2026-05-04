# Phase 2 — Brand Dashboard (`app.shoppingmate.ai`) Design

**Date:** 2026-05-04
**Owner:** Karan (Calmosis)
**Status:** Brainstorm complete; pending plan
**Phase:** 2 (per roadmap §4)
**Roadmap anchors:** §4 Phase 2 primary surfaces, §6 guardrails, §7.4 alert-driven UX, §2 done-criteria #4

---

## 1. Goal

Ship `app.shoppingmate.ai` — the brand-facing dashboard where merchants log in, pay (Day-1 Starter $30), connect their store, paste their script tag, see analytics, upload Brand Knowledge, configure persona/webhook, and self-serve billing. Replaces the current ops-only path (CLI provision + manual script tag).

**Out of scope:** internal/ops UI (that lives in Slack — see `feedback_slack_scope.md`). The dashboard is for brand merchants only.

---

## 2. Constraints inherited from roadmap

Hard:
- Default landing = conversation logs + conversion stats + KB. **Not** override editor (§7.4).
- No "Recipe Cards" tab in primary nav. Override surfaces appear via alert banner only (§7.4).
- Single-seat per merchant — no RBAC, no team management (§6).
- No free tier / no extended trial. Day-1 paid Starter $30 via Stripe Checkout at signup (§6).
- Preset themes only — no custom CSS theming (§6).
- Brand voice agent never speaks numeric prices — agent invariant, not a dashboard concern, but persona settings must not allow merchant to override this rule (§4 Phase 1).
- Success metric: <5% of merchants ever click into an override editor in 30d (§7.2).

Soft:
- Forward-compat for v0.2 team seats (table shape allows it; UI doesn't expose it).
- KB retrieval = naive concat first; embeddings only when first merchant exceeds 8K tokens (§4 Phase 2).

---

## 3. Architecture

### 3.1 Single Next.js app, route-segmented

The dashboard lives in the existing `web/` Next.js 16 app, alongside the marketing pages. No separate `apps/dashboard/` package.

**File layout (additions to `web/`):**

```
web/src/
  app/
    (marketing)/                     # existing landing — public, SSG
      layout.tsx
      page.tsx                       # current home
    (auth)/                          # public, no auth
      login/page.tsx
      signup/page.tsx
      verify/page.tsx                # magic-link landing
    app/                             # auth-gated dashboard
      layout.tsx                     # shell: sidebar + alert-banner host
      page.tsx                       # Home (KPI tiles + recent + catalog status)
      onboarding/page.tsx            # post-signup wizard
      conversations/
        page.tsx                     # list
        [id]/page.tsx                # drill-down
      knowledge/page.tsx             # KB upload + chunk preview
      settings/page.tsx              # persona / webhook / install snippet
      billing/page.tsx               # plan + usage + Stripe portal link
      diagnostics/page.tsx           # alert-banner-only landing for overrides
    api/
      auth/[...all]/route.ts         # Better-Auth handler
      billing/checkout-session/route.ts
      billing/portal-session/route.ts
      composio/connect-shopify/route.ts
      install/verify/route.ts
      alerts/[id]/accept/route.ts
      kb/upload/route.ts
      webhooks/
        stripe/route.ts
        composio/route.ts
  middleware.ts                      # auth gate + subdomain rewrite
  components/
    ui/                              # shadcn/ui (re-skinned for Tailwind 4 / React 19)
    dashboard/
      DashboardShell.tsx
      Sidebar.tsx
      AlertBanner.tsx
      KpiTile.tsx
      ConversationsTable.tsx
      KnowledgeUploader.tsx
      OnboardingWizard.tsx
  lib/
    auth.ts                          # Better-Auth config (Drizzle adapter)
    db.ts                            # @shoppingmate/db re-export
    composio.ts                      # Composio SDK wrapper
    stripe.ts                        # Stripe SDK wrapper
    resend.ts                        # transactional email
    kb-chunker.ts                    # PDF/docx/md/txt → chunks
```

### 3.2 Subdomain routing

`app.shoppingmate.ai/*` → rewrite to `/app/*` (Vercel-style rewrites or Railway equivalent). `shoppingmate.ai/*` → marketing. One Next.js deploy, two faces.

**`middleware.ts` responsibilities:**
1. Detect host: `app.shoppingmate.ai` → ensure `/app` prefix on request URL.
2. For `/app/*` paths: load Better-Auth session. If absent → 302 to `/login`.
3. Load merchant via `merchant_owners` join. If absent or `billing_status='pending'` → 302 to `/app/onboarding`.
4. Inject session + merchant into request headers for downstream Server Components.

### 3.3 Tech choices (locked)

| Concern | Choice | Why |
|---|---|---|
| Auth | Better-Auth + Resend (magic-link only) | Modern, Next 16 / React 19 compatible, plugs into Drizzle Postgres — no new DB |
| Email | Resend | Cheapest reliable transactional, simple API |
| Billing | Stripe Checkout (signup) + Customer Portal (everything else) | No custom billing UI to maintain |
| Brand → Shopify OAuth | Composio | Already used for Slack route; we never see OAuth tokens directly |
| File storage (KB) | Cloudflare R2 (or S3) | Cheap, signed URLs, S3-compatible |
| UI primitives | shadcn/ui ported to Tailwind 4 / React 19 | Patterns lifted from `growth-os-starter-kit/packages/frontend-core`; not directly imported (different stack) |
| State on server | Server Components + Server Actions | Default Next 16 pattern; no Redux/Zustand |
| State on client | URL params + minimal `useState` | Bundle stays lean |

### 3.4 Why not separate `apps/dashboard/`

Considered. Rejected because: (a) web/ is already deployed with the chosen stack; (b) shared design system avoids drift between marketing and product; (c) auth gating via route segments is cleaner than two deploys with shared auth state; (d) `apps/dashboard/` would force us to extract a `packages/ui/` for shared components — premature.

### 3.5 Why not Supabase / lift growth-os wholesale

- Supabase = managed Postgres + Auth, but we already have Postgres on Railway with the merchants/products/metric_events schema. Migrating to Supabase = risk + dual bills with no benefit. Better-Auth replaces Supabase Auth; everything else we already have.
- `growth-os-starter-kit/packages/frontend-core` is Next 14 / React 18 / Tailwind 3 — incompatible with web/ React 19 / Tailwind 4. Lift PATTERNS (auth flows, dashboard shell layout, KB chunking, KPI tile design), not code.

---

## 4. Data model

### 4.1 New tables

```sql
-- Better-Auth managed (created via Better-Auth's Drizzle migration generator)
users
  id uuid pk
  email citext unique not null
  email_verified timestamptz
  name text
  image text
  created_at timestamptz default now()
  updated_at timestamptz default now()

sessions
  id text pk
  user_id uuid fk users on delete cascade
  expires_at timestamptz not null
  token text unique not null
  ip_address text
  user_agent text
  created_at timestamptz default now()

verifications
  id text pk
  identifier text not null   -- email
  value text not null         -- hashed token
  expires_at timestamptz not null
  created_at timestamptz default now()

-- shoppingmate-specific
merchant_owners
  user_id uuid fk users on delete cascade
  merchant_id text fk merchants on delete cascade
  role text not null default 'owner'
  created_at timestamptz default now()
  primary key (user_id, merchant_id)

brand_kb_documents
  id uuid pk
  merchant_id text fk merchants on delete cascade
  filename text not null
  mime_type text not null
  size_bytes int not null
  storage_url text not null
  status text not null default 'uploaded'   -- uploaded|processing|ready|failed
  enabled boolean not null default true
  error_message text
  uploaded_at timestamptz default now()
  ready_at timestamptz

brand_kb_chunks
  id uuid pk
  document_id uuid fk brand_kb_documents on delete cascade
  merchant_id text fk merchants
  chunk_index int not null
  text text not null
  token_count int not null
  created_at timestamptz default now()

alerts
  id uuid pk
  merchant_id text fk merchants on delete cascade
  kind text not null                          -- override_failing|smoke_failing|catalog_drift|margin_breach|payment_failed
  severity text not null                      -- info|warning|critical
  payload jsonb not null
  created_at timestamptz default now()
  acknowledged_at timestamptz
  resolved_at timestamptz

stripe_events                                  -- idempotency log
  id text pk                                   -- Stripe event id
  type text not null
  received_at timestamptz default now()
  processed_at timestamptz
  payload jsonb
```

### 4.2 Merchants table additions

```sql
alter table merchants add column stripe_customer_id text unique;
alter table merchants add column stripe_subscription_id text unique;
alter table merchants add column plan text not null default 'starter';
alter table merchants add column billing_status text not null default 'pending';  -- pending|active|past_due|canceled
alter table merchants add column persona jsonb;                 -- {voice_descriptor_id, brand_voice_notes, tone_value}
alter table merchants add column lead_webhook_url text;
alter table merchants add column knowledge_base_status text not null default 'empty';  -- empty|processing|ready
alter table merchants add column last_widget_ping timestamptz;  -- set by /v1/install/verify
alter table merchants add column topup_balance int not null default 0;  -- conversations purchased via top-up packs
alter table merchants add column auto_recharge_enabled boolean not null default false;
alter table merchants add column auto_recharge_threshold int;        -- e.g. trigger at 10 convs remaining
alter table merchants add column auto_recharge_pack_size int;        -- 50|200|1000|5000
alter table merchants add column deleted_at timestamptz;             -- soft delete from "Danger zone"
```

### 4.3 Server-side session shape

After middleware resolves auth + merchant:

```ts
type DashboardSession = {
  user: { id: string; email: string; name: string | null; image: string | null };
  session: { id: string; expiresAt: Date };
  merchant: {
    id: string;
    plan: 'starter' | 'growth' | 'scale' | 'pro';
    billingStatus: 'pending' | 'active' | 'past_due' | 'canceled';
    status: 'catalog_pending' | 'selectors_pending' | 'smoke_pending' | 'live' | 'suspended';
    persona: { voiceDescriptorId: string; brandVoiceNotes: string; toneValue: number } | null;
    leadWebhookUrl: string | null;
    knowledgeBaseStatus: 'empty' | 'processing' | 'ready';
  } | null;
};
```

`null` merchant = user has signed up but not yet provisioned. Middleware sends them to `/app/onboarding?step=2` (pay).

---

## 5. Onboarding wizard

`/app/onboarding` is a single linear page with four steps + a progress bar. State is server-resolved on every render (no client wizard state).

### 5.1 Step 1 — Account (handled by `/signup` before reaching wizard)

User enters email at `/signup`. Better-Auth issues magic link via Resend. User clicks link → lands on `/verify` → Better-Auth sets session cookie → redirect to `/app/onboarding`.

### 5.2 Step 2 — Pay

CTA: "Start your $30/mo Starter plan."

Flow:
1. POST `/api/billing/checkout-session` — server creates Stripe Customer (if not exists), creates Checkout Session with `price_starter_monthly`, success_url=`/app/onboarding?step=3`, cancel_url=`/app/onboarding?step=2`.
2. Redirect to Stripe Checkout hosted page.
3. On success, Stripe webhook `checkout.session.completed` fires:
   - Insert `merchants` row with provisioned merchant_id (`SM-` + random base32), `billing_status='active'`, `stripe_customer_id`, `stripe_subscription_id`.
   - Insert `merchant_owners` linking the user.
4. User lands at `?step=3` and sees Connect Store.

### 5.3 Step 3 — Connect store

Two paths visible side-by-side:

**A) Connect Shopify (recommended copy: "fastest, 30 seconds")**
1. POST `/api/composio/connect-shopify` — server calls Composio SDK to start OAuth, returns `auth_url`.
2. Redirect to `auth_url` → user grants on Shopify → Composio webhook hits `/api/webhooks/composio` with `connection_id`.
3. Webhook handler:
   - Verifies HMAC-SHA256 (existing pattern from `apps/api/slack/verify.ts`).
   - Updates `merchants.adapter_config = { type: 'shopify', composio_connection_id }`, `merchants.status = 'catalog_pending'`.
   - Enqueues onboarding job (existing worker pipeline from Plans 3a-c).
4. Dashboard polls `/api/merchant/status` every 3s; advances UI as `status` transitions `catalog_pending` → `selectors_pending` → `smoke_pending` → `live`.

**B) Use any other website**
1. Merchant pastes URL.
2. POST `/api/install/start-url` — server validates URL (Safe Browsing API check), inserts adapter_config={type:'dom_pending'}, enqueues fingerprint job.
3. Worker decides path: Woo/Magento/BC/Wix/Squarespace via fingerprint, else DOMAdapter, else SuggestAdapter.
4. Same status polling as Path A.

### 5.4 Step 4 — Install snippet

Shows code block with merchant_id baked in:

```html
<script async src="https://cdn.shoppingmate.ai/widget/v1.js" data-id="SM-XYZAB7"></script>
```

Buttons:
- **Copy** — clipboard
- **Open preview** — opens `https://app.shoppingmate.ai/preview/SM-XYZAB7` in a new tab; this loads `examples/host-page.html` from the widget package with the merchant's id, so they can test before installing
- **I've pasted it** → POST `/api/install/verify` → server fetches merchant URL once, looks for the script tag → sets `merchants.last_widget_ping = now()` → redirect to `/app`
- **I'll do this later** → also redirects to `/app` (dashboard renders an "Install your widget" alert banner until ping seen)

### 5.5 Resume logic

Middleware reads `merchant.billing_status` + `merchant.status` + `merchant.last_widget_ping`:

| State | Redirect to |
|---|---|
| no merchant row | `/app/onboarding?step=2` |
| billing_status='pending' | `/app/onboarding?step=2` |
| billing_status='active', status in (catalog_pending, selectors_pending, smoke_pending) | `/app/onboarding?step=3` |
| status='live', last_widget_ping null | `/app/onboarding?step=4` |
| status='live', last_widget_ping set | `/app` (Home) |
| status='suspended' | `/app/billing` (with banner) |

---

## 6. Surfaces

### 6.1 Home (`/app`)

**KPI tiles (4, last-7-days default; range picker for 24h / 7d / 30d):**
- **Conversations** — count, with trend arrow vs previous period
- **Conversion rate** — `purchased / total_completed_conversations`
- **Attributed revenue** — sum of `metric_events.value_cents` where `name='conversionAttributed'`
- **Voice ratio** — `voice_conversations / total_conversations`. If >20%, tooltip surfaces "Voice-fairness surcharge active: $0.30 × N voice conversations" with link to billing page.

**Catalog sync chip:** small pill at top right showing "Synced 4 min ago — 327 products" with green/yellow/red state. Click → opens settings page diagnostics view.

**Recent conversations table (last 20):**
| Started | Duration | Turns | Mode | Outcome |
|---|---|---|---|---|
| 2 min ago | 1m 47s | 6 | voice | purchased |
| 4 min ago | 0m 32s | 2 | text | abandoned |
| ... | | | | |

Row click → `/app/conversations/[id]`.

**Alert banner area** at top — see §7.

### 6.2 Conversations (`/app/conversations`, `/app/conversations/[id]`)

**List page:**
- Paginated table (50 per page) with cursor-based pagination
- Filters: date range, outcome, mode (voice/text), has_attributed_sale (yes/no)
- Search box: full-text search on transcript content (Postgres `tsvector` index — matches existing FTS pattern from Plan 3a `products` table)

**Drill-down page:**
- Header: started_at, duration, turns, mode, outcome, attributed_revenue (if any)
- Transcript: bubbles in chronological order — agent text, user text, product card events (small inline cards), tool calls (collapsed by default, expand on click)
- Cost line: "$0.04 LLM, $0.18 voice — total $0.22" (per-conversation cost from cost ledger when Phase 3 lands; placeholder until then)
- 24h-expiry banner: "This conversation will be deleted at 14:32 UTC" (per roadmap §2.6 24h transcript retention)

### 6.3 Knowledge (`/app/knowledge`)

**Upload zone:** drag-drop for PDF, .docx, .md, .txt. Max 10 MB per file. Initial v1 cap: 20 documents per merchant.

**File table:**
| Filename | Size | Uploaded | Status | Enabled | Actions |
|---|---|---|---|---|---|
| returns-policy.pdf | 412 KB | today | ready | ✓ | view chunks / delete |
| faq.md | 12 KB | today | processing | — | — |

**Token-budget meter:**
"Total: 4,213 / 8,000 tokens — full KB injected at session start."
Or, when over budget:
"Total: 11,902 tokens — exceeds 8K budget; switching to top-K embedding retrieval. (Re-indexed 3 min ago.)"

**Per-file preview:** click "view chunks" → modal shows numbered chunks with token counts; lets merchant verify what the agent will read.

**Backend flow:**
1. Browser uploads via signed-URL POST direct to R2 (server gives back a presigned URL via `/api/kb/upload`).
2. Server inserts `brand_kb_documents` row with `status='uploaded'`, enqueues `ingestKbDoc(documentId)` BullMQ job.
3. Worker:
   - Downloads from R2.
   - Extracts text (pdf-parse for PDF, mammoth for docx, raw for md/txt).
   - Splits at sentence boundaries with token-aware chunker (target 256 tokens, max 512).
   - Inserts `brand_kb_chunks` rows.
   - Updates `brand_kb_documents.status = 'ready'`, `merchants.knowledge_base_status = 'ready'` if not already.
4. Agent runtime (Plan 4) reads chunks at session start: if `sum(token_count) <= 8000`, concat all into system prompt. Else top-K via embeddings (deferred until first merchant trips the threshold).

### 6.4 Settings (`/app/settings`)

**Persona section:**
- Voice descriptor: dropdown of 8 presets per ADR-0001 ("Warm Brit", "Energetic NYC", "Calm Indian", "Crisp Aussie", "Friendly Texan", etc.)
- Brand voice notes: text area, 500 char limit (free-form, injected into agent system prompt — "speak warmly, never use exclamation marks")
- Tone slider: 5 points (Formal / Professional / Neutral / Casual / Playful)

**Lead webhook:**
- URL input + "Test fire" button (sends a sample event to the URL, shows response)
- "We'll POST a JSON body to this URL when a conversation captures a lead (email/phone). See [docs link]."

**Install snippet:**
- Code block with merchant_id, copy button
- Re-verify button: pings merchant URL again, updates `last_widget_ping`

**Account:**
- Email (read-only)
- Sign out button
- **Danger zone:** "Delete account" — confirms with type-to-confirm; cancels Stripe subscription, revokes Composio connections, soft-deletes merchant (sets `deleted_at`, hides from queries), revokes sessions.

### 6.5 Billing (`/app/billing`)

**Plan card:**
- "Starter — $30/mo, 100 conversations"
- Progress bar: "47 / 100 conversations used this period"
- Voice ratio bar with 20% surcharge marker: "12% voice — under surcharge threshold" or "24% voice — surcharge active: $0.30 × 8 = $2.40"
- "Manage billing" button → POST `/api/billing/portal-session` → redirect to Stripe Customer Portal (cancel, swap plan, update card, invoices)

**Top-up packs:**
- 4 buttons: 50 / 200 / 1,000 / 5,000 conversations at $19 / $59 / $199 / $799
- Click → POST `/api/billing/topup` → Stripe Checkout one-time → webhook adds to `merchants.topup_balance`
- Auto-recharge toggle: opt-in with threshold + pack size selector. Hard cap 3 auto-recharges per billing period (per roadmap §4 Phase 3).

**Invoice list:**
- Pulled via `stripe.invoices.list({ customer: merchant.stripe_customer_id })` server-side
- Simple table: date, amount, status, PDF link

### 6.6 Diagnostics (`/app/diagnostics`)

**Banner-only landing.** Not in primary nav.

When alert banner is clicked, lands here with `?alert=<id>` query param. Renders the specific override editor for the failing selector. Visual element picker is out-of-scope for v1; v1 shows: "Selector `.add-to-cart-btn` is failing on `https://merchant.com/products/blue-tee`. Suggested fix: `button[data-action='add-to-cart']`. [Accept] [Reject + write your own]."

If "Accept" → POST `/api/alerts/[id]/accept` → updates `merchants.adapter_config` with new selector + `source='merchant_override'` (locks against auto-healing per roadmap §4 Phase 2).

---

## 7. Alert banner system

**Trigger:** any unresolved row in `alerts` for the current merchant.

**Render:** dashboard layout (`(app)/layout.tsx`) reads `where merchant_id = ? and resolved_at is null order by created_at desc limit 1` on every Server Component render. Renders `<AlertBanner>` at top of every dashboard page.

**Copy + action by alert kind:**

| Kind | Severity | Copy | Action |
|---|---|---|---|
| `override_failing` | warning | "Your `<selector_key>` selector is failing — accept the suggested fix?" | "Accept fix" → `/api/alerts/[id]/accept` |
| `smoke_failing` | critical | "Your widget can't add items to cart. Catalog or selectors are broken." | "View details" → `/app/diagnostics?alert=<id>` |
| `catalog_drift` | warning | "Your catalog hasn't synced in 24h." | "Re-sync now" → `/api/merchant/resync` |
| `payment_failed` | critical | "Your last invoice failed. Update payment to keep your widget live." | "Update payment" → opens Stripe Portal |
| `margin_breach` | (internal-only — paged to Slack `#alerts-margin`, NOT shown in dashboard per §6) | — | — |

**Dedup:** worker that creates alerts dedups on `(merchant_id, kind, payload->>'selector_key' if any)` within a 24h window per roadmap §7.2.

---

## 8. API routes summary

| Route | Method | Purpose |
|---|---|---|
| `/api/auth/[...all]` | * | Better-Auth catch-all (signup, login, magic-link, callback) |
| `/api/billing/checkout-session` | POST | Create Stripe Checkout for Starter signup |
| `/api/billing/portal-session` | POST | Create Stripe Customer Portal link |
| `/api/billing/topup` | POST | Stripe Checkout one-time for top-up pack |
| `/api/composio/connect-shopify` | POST | Start Composio OAuth, return auth_url |
| `/api/install/start-url` | POST | Submit non-Shopify store URL, kick off worker |
| `/api/install/verify` | POST | Ping merchant URL for script tag presence |
| `/api/merchant/status` | GET | Polling endpoint for onboarding wizard |
| `/api/merchant/resync` | POST | Re-trigger catalog sync |
| `/api/kb/upload` | POST | Get presigned R2 URL + insert document row |
| `/api/alerts/[id]/accept` | POST | Apply suggested fix and resolve alert |
| `/api/webhooks/stripe` | POST | Stripe event handler (signed) |
| `/api/webhooks/composio` | POST | Composio event handler (HMAC-signed, existing pattern) |

---

## 9. Error handling

- **Auth:** Better-Auth handles rate-limiting (5 magic-link sends per email per 15 min). Middleware redirects expired sessions to `/login`.
- **Stripe webhooks:** signature verification via Stripe SDK + idempotency via `stripe_events` table. Failed handler returns 500 → Stripe retries up to 3 days.
- **Composio webhooks:** HMAC-SHA256 verification ported from `apps/api/slack/verify.ts`.
- **KB upload failures:** worker retries 3× with exponential backoff; document moves to `failed` status with error message visible to merchant.
- **Onboarding step 3 timeout:** if smoke hasn't passed in 15 min, show "Still working — we'll email you when ready" + auto-resume on next visit.
- **Orphaned user:** signed up, no merchant row → middleware sends to `/app/onboarding?step=2` until pay or delete account.
- **Stripe Checkout cancel:** user lands at `/app/onboarding?step=2`. No merchant row created (we only insert on `checkout.session.completed`).
- **Composio webhook missed:** if 60s passes after redirect from Composio without a webhook, dashboard polls `/api/merchant/status` and falls back to `composio.getConnection(connection_id)` to confirm.

---

## 10. Testing

- **Vitest unit:** auth helpers, middleware logic, KB chunker, Stripe webhook idempotency, Composio webhook signature verification, alert dedup.
- **MSW for HTTP:** Stripe + Composio + Resend mocked at the HTTP layer (matches Plan 4-5 conventions).
- **Playwright E2E (one happy-path):** signup → Stripe Checkout test mode → Composio Shopify test connection → onboarding poll → script paste → KPI tile renders >0 conversations after firing a synthetic agent session against `/v1/install`.
- **Recorded fixtures:** Composio OAuth callbacks, Stripe webhook events, R2 presigned URL responses.
- **Coverage:** match Plan 4-5 standard — every API route + auth helper + webhook handler covered. No fixed % gate.

---

## 11. Out of scope (v1.1+)

- Override editor with visual element picker (v1 shows accept/reject, no DOM picker)
- Conversion attribution drill-down beyond aggregate KPI (depends on Plan 7)
- Voice-ratio surcharge breakdown by conversation (depends on Plan 6 with real voice data)
- Embedding-based KB top-K retrieval (built when first merchant exceeds 8K tokens per roadmap §4 Phase 2)
- Team / multi-seat (forbidden in v0.1 per §6; table shape forward-compat)
- Custom themes (forbidden in v0.1 per §6)
- Mobile-native dashboard (responsive web only)
- Self-serve onboarding wizard for non-technical merchants beyond what's described in §5 (see roadmap §8 v0.2 candidates)

---

## 12. Acceptance

A merchant can:
1. Visit `app.shoppingmate.ai/signup`, enter email, click magic link, land on onboarding.
2. Complete Stripe Checkout for Starter $30 in test mode, get a real merchant_id.
3. Connect a Shopify dev store via Composio OAuth, see catalog sync progress live.
4. Copy script tag, paste into a test page, click "I've pasted it" — green check appears.
5. Land on `/app` Home, see 4 KPI tiles (zero values) and "No conversations yet" empty state.
6. Upload a 2-page returns-policy PDF, see it appear in `/app/knowledge` as ready.
7. Configure persona (Warm Brit, brand notes, neutral tone) and lead webhook, save.
8. Trigger a synthetic agent session against the merchant's widget, see KPI tile increment, see conversation in `/app/conversations`, click in to view transcript.
9. Sign out, sign back in via magic link, land back at `/app` with all state intact.
10. Open `/app/billing`, click "Manage billing", see Stripe Customer Portal.
11. Force a `payment_failed` alert via Stripe webhook → see banner appear at top of dashboard → click "Update payment" → land in Stripe Portal.

If any of these fails, v1 is not done.

---

## 13. Source documents

- Roadmap: `docs/superpowers/roadmap.md`
- Strategy: `docs/strategy/2026-05-01-shoppingmate-strategy.md` (§5 pricing, §"Slack is the OS" — for ops, not brands)
- Voice ADR: `docs/adr/2026-05-01-voice-stack-livekit-gemini-live.md`
- Reference kit (patterns, not code): `C:\Users\naidu\Downloads\growth-os-starter-kit\packages\frontend-core`
- Memory: `feedback_slack_scope.md` (Slack is internal ops only, not brand-facing — corrected 2026-05-04)
