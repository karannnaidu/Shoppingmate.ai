# Slack-Driven OAuth Install Flow (Composio Connector Service)

**Status:** Design
**Date:** 2026-05-01
**Slot:** Plan 6-bis (alongside billing)
**Owner spec:** Karan (CEO)
**Implements:** strategy decision #4 (Composio for Shopify + shipping + fraud), §10 Slack-as-OS, karan-naidu-ceo skill §10 (skills-marketplace-first)

---

## 1. Goal

Stand up the single mechanism by which **all OAuth grants land** in this company:

1. Founder/internal grants — Karan grants the agents access to *his* tools (Stripe, Anthropic, GitHub, vendor accounts)
2. Merchant grants — new shoppingmate customers connect their store and adapter dependencies
3. Agent-to-agent — when a new agent skill needs a vendor, it requests through the same pipe

After this ships, no human ever pastes a token into an `.env`, no Slack DM contains a secret, and every grant has an audit row with named requester, scope, and use count.

## 2. Non-goals

- Self-hosted OAuth provider for our own product (that's Plan 7)
- Token storage outside Composio (Composio is the vault — we never see raw tokens)
- Replacing existing service-to-service auth (e.g., Anthropic API key in production env stays as is — this flow is for *human-mediated* grants)
- Multi-tenant on the connector service (single-tenant for shoppingmate; merchant grants are scoped via Composio's user model, not our service)

## 3. Architecture

```
┌──────────────────────┐       ┌─────────────────────────┐
│  Slack workspace     │       │  Composio Connector     │
│  shoppingmate-ops    │◀────▶│  Service (Cloudflare    │
│  #installs           │       │  Worker + Postgres + KV)│
│  #installs-merchant  │       │                         │
│  /install /revoke    │       │  - issues OAuth links   │
│  /installs           │       │  - listens to Composio  │
└──────────┬───────────┘       │    webhooks             │
           │                   │  - audit log            │
           │ slash + bot       │  - scope linter         │
           │ events            │  - trust-budget engine  │
           ▼                   └────────────┬────────────┘
┌──────────────────────┐                    │
│  Internal agents     │                    │
│  @docs-agent         │   connection.initiate(toolkit, scopes, why, requester)
│  @market-agent       │───────────▶│
│  @karan (CEO clone)  │                    │
│  @hiring-agent       │                    ▼
└──────────────────────┘       ┌──────────────────────────┐
                                │  Composio API            │
                                │  - 30+ e-commerce        │
                                │    toolkits              │
                                │  - hosted OAuth          │
                                │  - token vault           │
                                │  - refresh handling      │
                                └──────────┬───────────────┘
                                           │
                                           │ OAuth dance
                                           ▼
                              ┌────────────────────────────┐
                              │  Vendor (Stripe, Shopify,  │
                              │  Shippo, FraudLabs, ...)   │
                              └────────────────────────────┘
```

**Source of truth split:**
- Composio = secret store (raw tokens, refresh logic)
- Our connector service = relationship store (who-asked, why, scope, audit, trust budgets)

We never replicate the token; we always look it up by `connection_id`.

## 4. Components

### 4.1 Composio Connector Service

Cloudflare Worker, ~600 LOC TypeScript, deployed at `connector.shoppingmate.internal`. Endpoints:

| Path | Method | Purpose |
|---|---|---|
| `POST /install/initiate` | internal | Agent calls this with `{toolkit, scopes, why, requester, work_unit_id}`. Service calls Composio, returns OAuth URL + connection_id. |
| `POST /webhooks/composio` | public (HMAC-verified) | Composio posts here when OAuth completes/fails/refreshes. Service updates DB + posts to Slack. |
| `POST /webhooks/slack` | public (signing-secret-verified) | Slack interactions (button clicks, slash commands, reaction events). |
| `POST /install/revoke` | internal | Revoke connection in Composio + mark revoked in DB. |
| `GET /install/health` | internal | Nightly cron pings this; iterates active connections, calls `composio.connection.health()` per connection, alerts on failures. |
| `GET /install/audit/:connection_id` | internal | Returns audit history JSON for `/install-audit` slash command. |

State lives in Postgres (durable) + KV (cache for slash-command lookups). Service is fully stateless and idempotent — Composio webhooks have an `event_id`; replays are no-ops.

### 4.2 Postgres schema (in main DB; migration in `packages/db/migrations/`)

```sql
-- Connections currently held (by Composio)
CREATE TABLE install_connection (
  connection_id TEXT PRIMARY KEY,            -- Composio's ID
  toolkit TEXT NOT NULL,                     -- 'stripe', 'shopify', 'shippo', ...
  account_label TEXT NOT NULL,               -- 'Karan personal' / 'Acme Soap merchant'
  account_kind TEXT NOT NULL CHECK (account_kind IN ('founder', 'merchant', 'org')),
  scopes TEXT[] NOT NULL,                    -- granted scopes (no wildcards allowed)
  requested_by_agent TEXT NOT NULL,          -- '@docs-agent', '@market-agent', ...
  why TEXT NOT NULL,                         -- justification, single sentence
  granted_by_user TEXT NOT NULL,             -- slack user id of the grantor
  work_unit_ids TEXT[] DEFAULT '{}',         -- WU-1234, WU-1235, ...
  granted_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,           -- default granted_at + 90d
  last_used_at TIMESTAMPTZ,
  use_count INT DEFAULT 0,
  revoked_at TIMESTAMPTZ,
  revoke_reason TEXT,
  -- merchant-specific (null for founder/org connections)
  merchant_id TEXT REFERENCES merchants(id) ON DELETE CASCADE
);

CREATE INDEX install_connection_active_idx
  ON install_connection (toolkit, account_kind)
  WHERE revoked_at IS NULL;

-- Every API call by the agent on a connection
CREATE TABLE install_use (
  id BIGSERIAL PRIMARY KEY,
  connection_id TEXT NOT NULL REFERENCES install_connection(connection_id),
  used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_by_agent TEXT NOT NULL,
  endpoint TEXT NOT NULL,                    -- '/v1/customers' on Stripe, etc.
  work_unit_id TEXT,
  status_code INT,                           -- vendor response code
  duration_ms INT
);

CREATE INDEX install_use_conn_idx ON install_use (connection_id, used_at DESC);

-- Pending requests (not yet granted)
CREATE TABLE install_request (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  toolkit TEXT NOT NULL,
  scopes TEXT[] NOT NULL,
  requested_by_agent TEXT NOT NULL,
  why TEXT NOT NULL,
  work_unit_id TEXT,
  slack_thread_ts TEXT NOT NULL,             -- the Slack thread holding this request
  slack_channel_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'granted', 'denied', 'expired', 'narrowed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolution_user TEXT,                      -- Slack user who clicked grant/deny
  granted_connection_id TEXT REFERENCES install_connection(connection_id)
);

-- Trust budgets per agent — earned over time
CREATE TABLE agent_trust (
  agent_handle TEXT PRIMARY KEY,             -- '@docs-agent'
  read_only_auto_approve BOOLEAN DEFAULT false,
  approved_count INT DEFAULT 0,
  denied_count INT DEFAULT 0,
  last_denial_at TIMESTAMPTZ,
  trust_floor_until TIMESTAMPTZ              -- if set, agent must get manual approval until this time
);
```

### 4.3 Slack surface

**Channels:**
- `#installs` — internal/founder install requests + grants + revokes (humans see this; founder is the primary actor)
- `#installs-merchant` — merchant-side install activity (one-line per event; volume control)
- `#alerts-installs` — token-refresh failures, near-expiry warnings (≤14 days), anomaly alerts

**Slash commands:**

| Command | Behavior |
|---|---|
| `/install <toolkit> [--scope=...] [--why=...]` | Manual install request from a human; service calls `connection.initiate` and posts thread |
| `/installs [--toolkit=...] [--agent=...]` | Lists active connections matching filter; uses KV cache, ~200ms response |
| `/install-audit <connection-id>` | Posts a thread with full grant history + last 50 uses |
| `/install-audit-quarter` | Posts the quarterly audit roll-up (every connection's used vs. granted scopes) |
| `/revoke <connection-id> [--reason=...]` | Instant revoke; service calls Composio's `connection.disable` + writes `revoked_at` |
| `/scope <connection-id> narrow` | Proposes a tighter scope set based on actual `install_use` history; opens a regrant flow |

**Bot user:** `@install-bot` posts the request messages and reactions. Reactions are protocol:

| Reaction | Meaning |
|---|---|
| ✅ on a request | Grant (must be from a user with grant permission for that account) |
| 🛑 on a request | Deny |
| 🔍 on a request | Ask for narrower scope (bot replies with proposed narrowed set) |
| ⏸ on a request | Defer (extends pending state +24h, no auto-expire) |

Slack interactivity: bot also posts `[Grant access]` / `[Deny]` / `[Ask for narrower scope]` buttons for one-tap on mobile.

### 4.4 Scope discipline (linter rule)

Every agent code path that calls `connector.initiate(...)` is checked at PR time by an ESLint rule (`scripts/lint-rules/install-discipline.ts`):

1. `scopes` must be a static array literal (no spreads, no wildcards, no `*`)
2. `scopes` must be non-empty
3. `why` must be a string literal of length ≥ 12 characters
4. `requester` must match `/^@[a-z][-a-z0-9]+$/`
5. `work_unit_id` must be present if the call is inside a workflow handler

PRs failing the linter cannot merge. Rule is enforced via the existing CI pipeline (Husky + lint-staged + GitHub Actions).

### 4.5 Trust-budget engine

For every install request, the engine consults `agent_trust`:

1. If the request is **read-only on an already-granted toolkit** AND `agent_trust.read_only_auto_approve = true` AND `trust_floor_until < now()` → silent reuse (post audit-only message; no human approval).
2. Else → human approval required.

`read_only_auto_approve` flips to `true` after an agent has had ≥ 25 manually approved requests with **zero** denials and zero scope-narrow requests in the last 60 days. It flips back to `false` (and `trust_floor_until = now() + 7 days`) on any denial or narrow request.

**Cooldown trigger:** if any human grantor has approved ≥ 95% of requests in any rolling 7-day window with > 10 requests, the engine sets `trust_floor_until = now() + 14 days` for *all* agents. Forces re-engagement on individual approvals to break rubber-stamp drift.

### 4.6 Expiration + health

**Cron — every 6 hours:**
- For every `install_connection` where `expires_at < now() + 14 days AND revoked_at IS NULL`: post warning to `#alerts-installs` mentioning the requester agent and any open `work_unit_ids`.
- For every `install_connection` where `expires_at < now() AND revoked_at IS NULL`: mark expired, post to `#alerts-installs`.

**Cron — nightly 03:00:**
- Hit `composio.connection.health(connection_id)` for every active connection.
- Failure → post to `#alerts-installs` with the requester agent, last successful use, and the `/revoke` shortcut. Do not auto-revoke (false positives on Composio's side have happened; require human ack).

### 4.7 Anomaly detection

For each active connection, track rolling 7-day average `use_count_per_hour`. If the current hour's usage > 10× the rolling average AND > 50 calls absolute, page `#alerts-installs` with the connection details and a one-click pause button. Catches:

- A compromised agent burning through a Stripe connection
- A runaway loop hitting Shopify and getting us rate-limited
- A buggy doc agent that re-fetches the same Stripe customers 1000×

The pause button calls `composio.connection.disable`; resume requires founder approval (✅ from human Karan).

### 4.8 Merchant install flow

Diverges at the entry point. Merchant lands on shoppingmate.ai signup form → submits domain + email + plan.

```
shoppingmate.ai signup
  → apps/api: POST /v1/merchant/signup
  → connector service: POST /install/initiate
       toolkit: 'shopify' | 'woocommerce' | 'bigcommerce' | ...
       account_kind: 'merchant'
       merchant_id: SM-XXXXXX (newly minted)
       scopes: minimum needed for adapter (read products, read orders, read customers)
       requester: '@onboarding-pipeline'
       why: 'Onboarding crawl + adapter cache build'
  → returns OAuth URL
  → email + dashboard link to merchant: "Connect your Shopify"
  → merchant completes OAuth via Composio's hosted page
  → Composio webhook → connector service → merchant dashboard updates: "Connected ✓"
  → onboarding pipeline (Plan 3 OnboardingJob) auto-fires
  → daily roll-up to #installs-merchant: "12 connected today, 1 abandoned"
```

Merchant grants don't fan out to `#installs` — too noisy. Founder sees only the daily roll-up, plus alerts on abandonment trends.

For non-Composio platforms (Woo, BigC, Magento, Wix, Squarespace), the connector service routes to our internal MCP server's OAuth provider instead of Composio. From the merchant's POV the experience is identical; from our POV the connection_id is namespaced (`int_woo_*` vs `composio_shopify_*`) and the token storage is in our internal MCP DB.

## 5. End-to-end example: docs agent needs Stripe read access

```
1. @docs-agent runs weekly MRR-digest skill
2. Discovers no active connection for toolkit='stripe', account_kind='founder'
3. Calls connector.initiate({
     toolkit: 'stripe',
     scopes: ['read:customers', 'read:invoices', 'read:subscriptions'],
     requester: '@docs-agent',
     why: 'Weekly MRR digest churn-cohort calculation',
     work_unit_id: 'WU-1234',
     account_kind: 'founder'
   })
4. Service inserts row in install_request, calls composio.connection.initiate
5. Service posts in #installs:
     🔌 INSTALL REQUEST [WU-1234, confidence: 92%]
     Requested by:  @docs-agent
     Toolkit:       Stripe (Composio)
     Account:       Karan / karan@calmosis.com
     Scope:         read:customers · read:invoices · read:subscriptions
     Why:           Weekly MRR digest needs churn cohort from invoice history
     Used by:       docs/processes/mrr-digest.md
     Expires:       90 days
     [Grant access] [Deny] [Ask for narrower scope]
6. Karan clicks [Grant access] → OAuth URL opens
7. Karan signs into Stripe, grants → Composio callback
8. Composio webhooks our service: connection.created, connection_id=conn_abc123
9. Service inserts install_connection row, updates install_request.status='granted'
10. Service posts ✅ in the same thread:
      ✅ Connected. conn_abc123. Expires 2026-07-30. Use /revoke conn_abc123 to kill.
11. @docs-agent retries; service returns connection_id; agent calls Stripe via Composio's proxy
12. Every Stripe call writes a row in install_use
13. After 25 silent successful uses with zero denials, agent's read_only_auto_approve flips on
```

## 6. Migration path & rollout

### Phase A — week 1 (foundation)
- Service skeleton on Cloudflare Worker
- Postgres migration (4 tables above)
- Slack app: bot user, `#installs` channel, `/install` + `/installs` + `/revoke` commands
- Composio webhook handler (HMAC verified)
- Manual install of one toolkit (Stripe) by Karan — end-to-end smoke test

### Phase B — week 2 (audit + safety)
- `install_use` instrumentation (Composio proxy wrapper that logs every API call)
- Expiration cron + near-expiry warnings
- Nightly health check
- `/install-audit` and `/installs` slash commands with KV cache

### Phase C — week 3 (scale)
- Scope-discipline linter on agent code
- Trust-budget engine + auto-approve for read-only on already-granted toolkits
- Cooldown trigger (rubber-stamp defense)
- Anomaly detection (10× usage spike)

### Phase D — week 4 (merchant pipe)
- `/v1/merchant/signup` route in apps/api
- Merchant dashboard "Connect your store" page
- Daily `#installs-merchant` roll-up
- Internal MCP OAuth provider routing (Woo first; rest follow as those MCPs ship)

After Phase D, every new toolkit adoption is `/install <name>` in Slack. No `.env` updates, no team-shared password manager entries.

## 7. Toolkit prioritization (from Composio's e-commerce category)

> **Slack is the foundational toolkit.** Slack is granted *first*, before this connector service is even running, via the bootstrap path in `docs/runbooks/slack-setup-step-by-step.md` (paste manifest → "Bring your own OAuth app" in Composio → OAuth handshake → `connection_id`). The resulting connection is what the connector service uses to surface `/install request`, `/install list`, `/install revoke` for every *other* toolkit. When this service first comes up, it MUST register the existing Slack connection in `install_connection` with `account_kind='org'`, `requester='karan'`, `granted_at` = the connection's Composio creation timestamp, and `scopes` = the bot scopes from `apps/api/slack/manifests/shoppingmate-bot.yaml` — no OAuth handshake re-runs. Treat it as a pre-existing grant the service inherits, not a new one it issues.

| Toolkit | Phase | Used by | Required scopes |
|---|---|---|---|
| **Slack** | A (foundational) | Slack-as-OS + this connector service itself | `chat:write chat:write.public commands reactions:read reactions:write channels:read channels:history channels:manage groups:read groups:history groups:write im:read im:history im:write users:read users:read.email team:read files:write pins:write app_mentions:read` (full bot scope set from manifest) |
| **Shopify** | A | Onboarding pipeline + merchant adapter | `read_products read_orders read_customers` |
| **Stripe** | A | Billing (Plan 6) + doc agent (MRR digest) | `read:customers read:invoices read:subscriptions read:charges` |
| **GitHub** | A | Slack-GitHub sync + code agent | `repo write:discussion read:org` |
| **Shippo** | B | Order tracking inside copilot | `read:trackings` |
| **ShipEngine** | B | Alternative to Shippo | `read:tracking` |
| **FraudLabs** | B | Cart fraud check | `screen:order` |
| **Klaviyo** | C | Marketing-team agent (email) | `read:profiles write:campaigns` |
| **Mailchimp** | C | Marketing alternative | `read:audiences write:campaigns` |
| **Meta Ads** | C | Marketing-team paid ads | `ads_read ads_management` (separate Meta Business setup needed) |
| **Cal.com** | C | Hiring loop scheduling | `read:bookings write:bookings` |
| **Anthropic / OpenAI / Gemini** | n/a | Service-to-service API keys; not in this flow | — |

For Woo / BigC / Magento / Wix / Squarespace: not in Composio's catalog → routes through internal MCP OAuth (Phase D dependency on those MCPs shipping).

## 8. Security model

### Threat: agent compromise
- Mitigated by: rate limit per connection per agent (Phase C), anomaly detection (Phase C), `/revoke` instant kill (Phase A)
- Blast radius: one connection = one toolkit's scopes for one account; revoke takes ~5 sec to propagate

### Threat: scope escalation over time
- Mitigated by: linter blocks wildcards (Phase C), `/install-audit-quarter` flags granted-but-unused scopes (Phase C), 90-day expiration forces regrants (Phase B)

### Threat: founder fatigue → rubber-stamp
- Mitigated by: cooldown trigger (Phase C), batch-by-toolkit (silent reuse for already-granted scopes), weekly digest in `#installs` (Phase B)

### Threat: Composio outage
- Mitigated by: direct OAuth fallback for Stripe, Shopify, GitHub, Slack (~1 day of work in Phase A; defer for B/C/D toolkits unless they become critical)
- Existing connections keep working during outage (tokens cached in Composio's edge); only *new* installs are blocked

### Threat: founder leaves the company
- Mitigated by: connections owned by `org` account in Composio, not personal. Successor founder can revoke + regrant from their own user. Audit log persists in our DB.

### Threat: merchant token compromise
- Mitigated by: per-merchant connection isolation (one merchant's compromise ≠ another's), Composio's standard token rotation, `/revoke` per-merchant-id mass revoke command (Phase D)

## 9. Test plan

### Unit
- Connector service: webhook signature verification, idempotent webhook replay, scope-array validation
- Linter rule: 12 fixture cases (wildcard, missing why, dynamic scopes, etc.)
- Trust-budget engine: state transitions, cooldown trigger, approval-rate computation

### Integration
- Composio sandbox: full OAuth flow for Stripe sandbox account (end-to-end; runs in CI nightly, not per-PR — costs Composio API calls)
- Slack sandbox workspace: button click → grant flow, slash command latency
- Postgres: migration up/down, race conditions on concurrent grants for the same toolkit

### Smoke (production)
- One real Stripe install in Phase A
- One real Shopify install on a test merchant in Phase A
- Quarterly full-coverage smoke: every active toolkit re-tested via a fixture work unit

## 10. Observability

Metrics published to whatever metrics layer ships with Plan 6 (likely Prometheus via OpenTelemetry):

- `installs.requests_total{status, toolkit, requester}` — counter
- `installs.grant_latency_seconds{toolkit}` — histogram (request → grant)
- `installs.use_total{toolkit, requester}` — counter
- `installs.connections_active{toolkit, account_kind}` — gauge
- `installs.expiring_soon{toolkit}` — gauge (count expiring in next 14 days)
- `installs.health_check_failures_total{toolkit}` — counter
- `installs.anomaly_pages_total` — counter

Dashboards: one Grafana board (`installs-overview`) — connections by toolkit, expiring soon, denial rate per agent, top API consumers.

Alerts:
- `installs.health_check_failures_total > 0` for any toolkit, sustained 30 min → `#alerts-installs`
- `installs.expiring_soon > 0` daily 09:00 → `#alerts-installs`
- Anomaly trigger → immediate `#alerts-installs` + Slack mention

## 11. Open questions (need answers before week 1)

1. **Composio pricing tier.** What plan are we on? Per-connection pricing affects whether the cooldown trigger costs us money or just human time.
2. **Org account in Composio.** Is the founder's personal Composio account adequate for v0.1, or do we need to upgrade to org-level *before* week 1? (Recommend: start personal, migrate to org in Phase B; Composio supports the migration without re-grant.)
3. **HMAC secret rotation.** How often? Default 90 days unless someone has a stronger view.
4. **Merchant signup form.** Do we already have copy + design for this, or does Phase D need a designer slot? (Likely the latter; flag for the founding designer hire.)
5. **Internal MCP OAuth provider.** The plan assumes Phase D depends on internal MCPs for Woo/BigC/etc. shipping. Confirm those MCPs are on the Plan 5 roadmap and not slipping.

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Composio's e-commerce category list is missing a P0 toolkit (e.g., FraudLabs) | Medium | Medium | Direct OAuth fallback (1-day build per toolkit); audit list in week 0 |
| Trust-budget engine creates a "this agent is trusted forever" path that's exploited | Low | High | Cooldown trigger forces re-engagement; audit-quarter catches drift |
| Slack rate limits during high install volume (especially merchant pipe) | Low | Medium | Daily roll-up to `#installs-merchant` instead of per-event posts; `chat.postMessage` rate is generous within a single channel |
| Postgres becomes a SPOF for connector service (Cloudflare Worker → Postgres) | Medium | Medium | Use connection pooling (Hyperdrive or Supabase pooler); fallback: KV cache for `/installs` and `/install-audit` reads |
| Founder fatigue defenses are too aggressive — block legitimate work | Medium | Low | Cooldown is 14 days, not permanent; founder can `/install-override` to skip |

## 13. Dependencies on other plans

- **Plan 6 (Billing):** spec assumes Stripe Composio connection, `install_use` table for billing audit. Plan 6 ships first or simultaneously.
- **Plan 5 (Internal MCPs):** Phase D blocked until at least Woo MCP ships.
- **Plan 3 (Onboarding):** Phase D's merchant flow assumes `OnboardingJob` exists and reads from `install_connection.connection_id` to access the merchant's store.
- **Slack-as-OS sync service** (separate spec, 2026-05-01): connector service shares the Cloudflare Worker pool, the bot-user pattern, and the Postgres `audit_log` shape.

## 14. Success criteria

- 100% of new vendor grants in last 30 days came through `/install` (no manual `.env` edits)
- 100% of active connections have `last_validated < 14 days` from the health check cron
- Median grant latency (request → connected): < 90 seconds
- 0 wildcard scopes in `install_connection`
- ≥ 50% of weekly install requests are read-only auto-approves on already-granted toolkits (indicates trust budget is working, not always asking)
- 0 incidents involving a leaked or pasted token in Slack DMs in 90 days

---

*Companion artifacts (write next): `docs/runbooks/install-revoke-procedure.md`, `docs/runbooks/composio-outage-fallback.md`, `docs/processes/quarterly-install-audit.md`. The doc agent (separate spec) auto-generates these once the connector service ships its first 10 grants.*
