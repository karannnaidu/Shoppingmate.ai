# Phase 1 — Plan 2: Provisioning API + Merchant Lifecycle

**Status:** Design
**Date:** 2026-04-30
**Parent spec:** [`2026-04-30-shoppingmate-phase1-design.md`](./2026-04-30-shoppingmate-phase1-design.md)
**Prior plan:** Plan 1 (Foundation & Infra) — complete, tagged `phase1-plan1-foundation-complete`

---

## 1. Goal

Stand up the smallest production-grade slice that can take a real merchant from zero to "we know what platform they're on and Safe Browsing has cleared them." Specifically:

1. A **CLI tool** the team uses to provision beta merchants on their own machines.
2. A **public `POST /v1/install` HTTP endpoint** that the gtag widget calls from shoppers' browsers.
3. A **worker that runs `OnboardingJob`** end-to-end through SafetyCheck and platform fingerprint.

After Plan 2, every onboarded merchant in the database has a known `platform` value and a clean Safe Browsing record. Catalog sync, selector extraction, and adapter implementation are explicitly deferred to Plan 3+.

## 2. Non-goals

- Catalog sync, product ingestion, or any platform-specific adapter logic
- Vision-grounded selector extraction
- Self-service merchant signup (browser-based onboarding) — Phase 2 dashboard
- HMAC-signed install tokens — revisit if abuse appears
- Auto-healing beyond the simple stale-onboarding retry — Phase 2 self-heal
- Override editor / safety-valve UI — Phase 2

## 3. Architecture

Three components in three packages; each is independently testable.

```
┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│  @shoppingmate/cli  │       │   apps/api (Hono)   │       │  apps/worker (BullMQ)│
│   (team laptops)    │       │   public internet    │       │   private workers    │
├─────────────────────┤       ├─────────────────────┤       ├─────────────────────┤
│ provision <domain>  │──┐    │ POST /v1/install    │──┐    │ OnboardingJob       │
│ retry-onboarding ID │  │    │  - origin check     │  │    │  1. SafetyCheck     │
│                     │  │    │  - rate limit       │  │    │  2. Fingerprint     │
└─────────────────────┘  │    │  - allowed_domains  │  │    │  3. Finalize        │
                         ▼    │  - state transition │  ▼    └──────────┬──────────┘
              ┌──────────────────────┐    │  - enqueue job  │           │
              │  Postgres: merchants │◀───┘                 │           │
              │  + install_attempts  │◀─── Redis (BullMQ + rate limits)─┘
              └──────────────────────┘
```

**Boundary with Plan 3:** Plan 2 ends when `merchants.status = 'active'` and `platform` is set. Plan 3 (catalog sync + adapters) picks up from `WHERE status = 'active' AND catalog_synced_at IS NULL`.

## 4. Components

### 4.1 `@shoppingmate/cli` (new package)

A small Node CLI invoked via `pnpm shoppingmate <subcommand>`. Lives at `packages/cli/`. No external CLI framework — use `node:util` `parseArgs`. Only deployed to team machines (never to production).

**Subcommands:**

| Command | Purpose |
|---|---|
| `provision --domain=<host> [--name=<text>] [--allow=<host>,...]` | Insert a new merchant. Generates `SM-XXXXXX` ID. `--allow` extends `allowed_domains` beyond the primary domain (e.g., `--allow=www.acmesoap.com`). |
| `retry-onboarding <merchantId>` | Force `OnboardingJob` re-enqueue regardless of current status (except `rejected`). Useful when Safe Browsing flags an unrelated transient issue. |
| `show <merchantId>` | Print merchant row + last 5 `install_attempts` rows for debugging. |

**Audit:** every CLI invocation prints what it did to stdout. The shell history on team machines is the audit trail in Phase 1; Phase 2 dashboard adds proper audit logging.

### 4.2 `POST /v1/install` route (in `apps/api`)

Public unauthenticated endpoint mounted under `apps/api/src/routes/install.ts`.

**Request:**
```json
{
  "merchantId": "SM-A7K2X9",
  "domain": "acmesoap.com",
  "userAgent": "Mozilla/5.0 ...",
  "referrer": "https://acmesoap.com/products/shampoo"
}
```

**Validation chain (failure short-circuits with the listed status):**

| Step | Failure mode | HTTP status | Response code |
|---|---|---|---|
| Zod body shape | malformed | 400 | `invalid_body` |
| `Origin` (or `Referer`) host equals `domain` | mismatch | 403 | `origin_mismatch` |
| Redis sliding window: ≤10/min/merchantId | exceeded | 429 | `rate_limited` |
| Redis sliding window: ≤100/min/source IP | exceeded | 429 | `rate_limited` |
| `domain` ∈ `merchants.allowed_domains` | not in list | 403 | `domain_not_allowed` |
| Merchant exists | missing | 404 | `merchant_not_found` |

**State machine on the merchant row** (computed via a pure helper `nextInstallAction(merchant, now): 'enqueue' | 'noop'`):

| Current `status` | Condition | Action |
|---|---|---|
| `pending` | always | UPDATE → `onboarding`, enqueue |
| `failed` | always | UPDATE → `onboarding`, clear `last_error`, enqueue |
| `onboarding` | `last_install_at < now() - 24h` | UPDATE `last_install_at = now()`, re-enqueue |
| `onboarding` | otherwise | noop (job is already in flight) |
| `active` | always | noop |
| `rejected` | always | noop |

Every call appends one row to `install_attempts` (regardless of validation outcome). Every call updates `merchants.last_install_at`.

**Response (always `200` for valid auth/rate-passed calls, regardless of state):**
```json
{ "status": "onboarding" }    // or "active" | "rejected" | "failed"
```

The success-shape is the same for `enqueue` and `noop` — the gtag client doesn't need to distinguish, and we don't want to leak whether a fresh job was kicked off (avoids enumeration signal).

### 4.3 `OnboardingJob` worker handler (in `apps/worker`)

Replaces the Plan 1 stub at `apps/worker/src/handlers/onboarding.ts`. Job payload is `{ merchantId: string }` — the worker re-reads merchant fields from the DB to avoid acting on a stale snapshot.

**Three sequential steps. Any thrown error bubbles to BullMQ for retry.**

#### Step 1: SafetyCheck

- POST to `safebrowsing.googleapis.com/v4/threatMatches:find` with the merchant's `domain`
- 3-second timeout, 2 in-handler retries on transport failure
- Threat match → UPDATE `status='rejected'`, `last_error=<threat_type>`. **Terminal**, do not throw, do not proceed.
- Clear → UPDATE `safety_checked_at = now()`, proceed.
- Total API failure (network down 3×) → throw, BullMQ handles retry.

#### Step 2: Fingerprint

- `GET https://<domain>/` with 5s timeout, ≤3 redirects, 2MB max body, browser-like UA string
- Network/timeout/HTTP 5xx → throw → BullMQ retry
- Run detection rules in this order, stop on first match:
  - **Shopify**: any of:
    - `Shopify` literal in HTML head meta `generator`
    - `cdn.shopify.com` in any `<script src>` or `<link href>`
    - `window.Shopify =` in inline `<script>`
  - **WooCommerce**: any of:
    - `<meta name="generator" content="WooCommerce ...">`
    - `wp-content/plugins/woocommerce` in any URL
    - `<body class="...woocommerce...">` (regex)
  - **Default**: `platform = 'custom'` (homepage fetched fine, just not a known platform)

#### Step 3: Finalize

- UPDATE `platform = <value>`, `last_fingerprinted_at = now()`, `status = 'active'`, `last_error = NULL`
- Emit `onboarding.completed` metric with `{ platform, durationMs }`

**BullMQ job options:** `{ attempts: 5, backoff: { type: 'exponential', delay: 30_000 } }`. After all attempts exhausted, BullMQ moves the job to its `failed` queue AND a final hook in the worker writes `merchants.status='failed'` + `last_error` so the failure is visible from SQL alone.

## 5. Schema changes

One new migration generated via `pnpm db:generate`. No backfill needed — Plan 1 was unreleased.

### `merchants` (additive)

| Column | Type | Notes |
|---|---|---|
| `name` | `text` (nullable) | Display name from CLI `--name` |
| `allowed_domains` | `text[]` (default `'{}'`) | Set at provision; checked by `/v1/install` |
| `platform` | `text` (nullable, check `'shopify' \| 'woocommerce' \| 'custom'`) | Set by fingerprint |
| `last_fingerprinted_at` | `timestamptz` (nullable) | |
| `last_install_at` | `timestamptz` (nullable) | Updated on every `/v1/install` |
| `last_error` | `text` (nullable) | Cleared on successful finalize |
| `safety_checked_at` | `timestamptz` (nullable) | When Safe Browsing last cleared |

`status` check constraint relaxed to `'pending' \| 'onboarding' \| 'active' \| 'failed' \| 'rejected'`.

### `install_attempts` (new)

| Column | Type | Notes |
|---|---|---|
| `id` | `bigserial` PK | |
| `merchant_id` | `text` FK → `merchants.id` (cascade) | |
| `domain` | `text` | What the body claimed |
| `source_ip` | `text` | Forensics |
| `user_agent` | `text` | |
| `referer` | `text` (nullable) | |
| `outcome` | `text` (check: `'enqueued' \| 'noop' \| 'rejected_origin' \| 'rejected_domain' \| 'rate_limited' \| 'invalid_body' \| 'merchant_not_found'`) | |
| `created_at` | `timestamptz default now()` | |

**Indexes:** `(merchant_id, created_at desc)`, `(source_ip, created_at desc)`.

## 6. Security

- **Origin/Referer check** (header `Origin` preferred, fall back to `Referer`'s host) — host must equal body `domain`. Prevents trivially scripted abuse from non-browser clients without breaking gtag's real-world traffic.
- **Per-merchantId rate limit:** 10 req/min, sliding window in Redis.
- **Per-source-IP rate limit:** 100 req/min, sliding window in Redis.
- **`allowed_domains` check** on the merchant row prevents an actor with a leaked merchantId from triggering crawls of arbitrary unrelated domains.
- **MerchantId entropy:** `SM-` + 6 nanoid chars from a 32-char alphabet ≈ 2³⁰ space; combined with the rate limit, brute-force enumeration is impractical.
- **No stack traces in responses.** Any 5xx returns `{ error: 'internal' }`. Detail goes to logs only.
- **Safe Browsing API key** lives in env (`SAFE_BROWSING_API_KEY`). Quota is the constraint; the per-merchantId rate limit caps how often we can spend quota for any single merchant.

## 7. Observability

All metrics go through the Plan 1 `metric_events` table via the helper in `@shoppingmate/shared`. Names use the constants registry — add the following to `metricNames`:

```
install.received
install.rate_limited
install.rejected_origin
install.rejected_domain
onboarding.safety.cleared
onboarding.safety.rejected
onboarding.safety.error
onboarding.fingerprint.shopify
onboarding.fingerprint.woocommerce
onboarding.fingerprint.custom
onboarding.fingerprint.fetch_failed
onboarding.completed
onboarding.failed
```

**Logs:** Pino structured. Every install attempt and every onboarding step emits one log line with `{ merchantId, jobId?, step, status, durationMs, err? }`. Errors are logged with `err.message`, `err.stack`, and the error string copied to `merchants.last_error` for SQL-level visibility.

## 8. Testing strategy

**Unit (no network, no DB):**
- CLI: provision validates domain shape, generates valid `SM-XXXXXX`, builds correct INSERT
- Zod schema accepts a valid body and rejects each malformed shape
- Origin matcher: pass/fail matrix over `(Origin, Referer, body.domain)`
- `nextInstallAction()` pure function: covers all 5 statuses × 3 freshness conditions
- Fingerprint rules: fixture HTML/headers from real Shopify, Woo, and Webflow homepages → asserts correct platform classification
- Rate limiter: sliding-window arithmetic correct

**Integration (Postgres + Redis from `docker-compose`):**
- Provision → `POST /v1/install` happy path: merchant row + `install_attempts` row + queue length all correct
- 11 calls in 60s on the same merchantId → 11th returns 429 + `rate_limited` row
- Idempotency: 5 repeat calls on an `active` merchant → all return `200 { status: "active" }`, no extra jobs
- Stale-onboarding re-enqueue: backdate `last_install_at` to 25h ago → next call enqueues a second job

**Worker integration:**
- Safe Browsing API and homepage fetch mocked via `msw/node`
- Happy path: SafetyCheck cleared + Shopify HTML → `status='active'`, `platform='shopify'`, expected metric rows present
- Safety threat → `status='rejected'`, no fingerprint metrics emitted
- Fetch fails 5×, BullMQ exhausts retries → `status='failed'`, `last_error` populated

**Manual smoke (in `scripts/`):**
- `scripts/smoke-safety.ts` — real Safe Browsing call against `testsafebrowsing.appspot.com/s/malware.html` and a clean control. Run before any Safe Browsing config change.

**Out of scope for Plan 2 tests:** live Safe Browsing in CI (quota), live merchant homepages.

## 9. Dependencies & risks

**New deps:**
- `zod` — body validation (used by Hono ecosystem; pinned in apps/api)
- `undici` (already a Node built-in via `fetch`) for outbound HTTP with timeouts
- `msw` — devDep for mocking outbound HTTP in tests

**Risks:**
- **Safe Browsing quota.** Default free tier is 10k req/day. The per-merchant rate limit + idempotent state machine means production throughput is bounded by *new* merchant onboardings, not by gtag traffic — well under quota for Phase 1.
- **Fingerprint false negatives.** If Shopify changes its HTML output, we silently misclassify as `custom`. Mitigation: log a sample of `custom` classifications to spot drift; revisit detection rules quarterly.
- **Idempotency under race.** Two simultaneous `/v1/install` calls for a `pending` merchant could both enqueue. Mitigation: use a conditional UPDATE (`WHERE status='pending'`) and check `rowCount === 1` before enqueuing; the loser of the race noops.
- **Stale `onboarding` not actually stale.** A long-running fingerprint (slow merchant homepage) could exceed 24h theoretically. Mitigation: BullMQ `lockDuration` is 30s with renewals; in practice jobs finish within minutes. The 24h threshold is conservative.

## 10. Acceptance criteria

Plan 2 is done when **all** are true:

1. `pnpm shoppingmate provision --domain=example.com --name="Test"` creates a `pending` merchant and prints the install snippet.
2. POSTing the snippet's `merchantId` + `domain` to `/v1/install` (with matching `Origin`) returns `200 { status: "onboarding" }` on first call, `200 { status: "active" }` on second call after the worker completes.
3. The merchant row ends with `status='active'`, `platform` ∈ `{shopify, woocommerce, custom}`, `safety_checked_at` set.
4. POSTing with a non-matching `Origin` returns `403 { error: "origin_mismatch" }` and writes a `rejected_origin` row to `install_attempts`.
5. 11 calls in one minute against the same merchant return `429` on the 11th.
6. Safety-flagged domain (test fixture) ends with `status='rejected'`, never enqueues fingerprint.
7. All Vitest tests pass, `pnpm lint`, `pnpm typecheck`, `pnpm build` clean, CI green.

## 11. File map

```
packages/cli/                                NEW
  package.json
  src/
    index.ts                                 # parseArgs dispatcher, bin entry
    commands/
      provision.ts
      retry-onboarding.ts
      show.ts
    snippet.ts                               # builds the <script> install snippet

packages/db/src/schema/
  merchants.ts                               MODIFIED (new columns, status check)
  installAttempts.ts                         NEW
  index.ts                                   MODIFIED (export installAttempts)

packages/shared/src/
  metricNames.ts                             MODIFIED (add install.* + onboarding.*)

apps/api/src/
  index.ts                                   MODIFIED (mount install route)
  routes/
    install.ts                               NEW
  lib/
    rateLimiter.ts                           NEW (Redis sliding window)
    originCheck.ts                           NEW
    nextInstallAction.ts                     NEW (pure state-machine helper)

apps/worker/src/
  index.ts                                   MODIFIED (wire handler)
  handlers/
    onboarding.ts                            NEW (replaces Plan 1 stub)
  steps/
    safetyCheck.ts                           NEW
    fingerprint.ts                           NEW
    fingerprintRules/
      shopify.ts                             NEW
      woocommerce.ts                         NEW
      index.ts                               NEW (registry)

scripts/
  smoke-safety.ts                            NEW

tests/integration/                           NEW
  install.test.ts
  onboarding.test.ts
  rateLimit.test.ts
```

Root `package.json` gets `"shoppingmate": "node packages/cli/dist/index.js"` in `bin` so `pnpm shoppingmate` works after `pnpm build`. Local dev gets a parallel `pnpm shoppingmate:dev` script that runs via `tsx`.
