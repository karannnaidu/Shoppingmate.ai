# Runbook: Slack workspace setup — step-by-step (Composio-mediated)

**Date:** 2026-05-01
**Owner:** Karan (Calmosis)
**Goal:** Stand up the Slack workspace described in `docs/operating-model.md` so shoppingmate.ai's day-to-day ops run through Slack from day 1, with all OAuth held by Composio.
**Estimated time:** 90–120 minutes total. Karan: ~45 min hands-on. Claude: the rest, async.
**Dependencies:** `docs/operating-model.md` (canonical channel + agent + reaction schema), `docs/superpowers/specs/2026-05-01-slack-install-flow.md` (Composio install flow this runbook bootstraps — Slack is the *first* toolkit registered).

> **How to read this:** Every step is prefixed with **[KARAN]** (you do it — requires human auth, workspace ownership, payment, or biometric) or **[CLAUDE]** (I do it autonomously — file generation, manifests, scripts, connector configs). Steps marked **[BOTH]** are "Karan does the irreversible part, Claude does the prep."

> **Architecture summary:** Slack is wired through Composio. We never see Slack tokens. We paste a Slack app manifest, hand the resulting Client ID + Secret to Composio, and Composio runs the OAuth handshake on our behalf. Slash commands and events arrive at our `apps/api` as Composio webhook payloads (HMAC-signed). Outbound Slack actions go through Composio's Slack MCP. One connection — `COMPOSIO_SLACK_CONNECTION_ID` — covers both directions.

---

## 0. Pre-reqs (before step 1)

### 0.1 [KARAN] Decide the workspace identity

- **Workspace name:** `shoppingmate-ops` (or `shoppingmate.ai`).
- **Primary email:** `karan@calmosis.com`.
- **Payment plan:** start on **Free**. Upgrade to **Pro** (₹245/seat/mo) by **day 75** (≈2026-07-15) — before Free's 90-day message-history cap starts deleting day-1 ops decisions, audit threads, and `/install` grant logs. Set a calendar reminder. Skip Business+ unless an enterprise customer or legal forces compliance/retention requirements (HIPAA, data residency, retention policies).
- **Pre-upgrade triggers** that move the day-75 date earlier: hitting Slack's 10-app integration cap (we're at ~5 by Plan 6, 8+ by Plan 8), or any audit-trail need that pre-dates day 90.
- **Geography:** **US** (workspace data region) — matches Phase 1 markets (US/UK/CA/AU). Avoid EU region for now to keep Anthropic / Gemini API call paths simpler.

### 0.2 [KARAN] Decide who else gets owner / admin from day 1

For now: just `karan@calmosis.com` is **Owner**. Add a second human owner once founding ops hire lands (target month 4–5 per strategy §10).

### 0.3 [CLAUDE] Confirm what's in the repo before we start

I'll generate everything as files in `apps/api/slack/` (channel manifest, app manifest, MCP config) and `apps/api/src/routes/slack/` (Hono handlers). They land as PR-reviewable code, not buttons-in-a-UI. You merge what makes sense.

---

## 1. Create the Slack workspace

### 1.1 [KARAN] Create the workspace

1. Go to `https://slack.com/get-started#/createnew`.
2. Sign in with `karan@calmosis.com`.
3. Workspace name: `shoppingmate.ai`.
4. Skip "invite teammates" for now.
5. Skip "create your first channel" — we'll do this from the manifest in step 2.
6. **Stay on Free.** Don't upgrade yet — see §0.1 for the day-75 upgrade trigger.

**Reversibility:** trivial — you can downgrade or delete the workspace within 24h.

### 1.2 [KARAN] Capture the workspace ID + URL

After creation:
- Workspace URL: `https://shoppingmate.slack.com` (or whatever Slack assigned — capture exact value).
- Workspace ID (`T...`): visible in Settings → Workspace settings → About.

Send these to me in the next conversation.

---

## 2. Create the shoppingmate-bot Slack app (BUT DO NOT INSTALL IT)

This is the part that surprises people: we paste the app manifest at `api.slack.com`, but we **stop before the Install-to-Workspace button**. Composio runs the install for us in §3.

### 2.1 [CLAUDE] `apps/api/slack/manifests/shoppingmate-bot.yaml` (already generated)

The Slack App Manifest YAML. Every URL in it (slash command request URLs, `event_subscriptions.request_url`, `interactivity.request_url`) points at Composio's webhook trigger:

```
https://backend.composio.dev/api/v3.1/trigger_instances/slack/default/handle
```

`oauth_config.redirect_urls` includes `https://backend.composio.dev/api/v3.1/auth-apps/add` so Composio can complete the OAuth handshake.

### 2.2 [KARAN] Paste the manifest into Slack

1. Go to `https://api.slack.com/apps?new_app=1`.
2. Choose **From an app manifest** → pick the `shoppingmate.ai` workspace.
3. Paste the contents of `apps/api/slack/manifests/shoppingmate-bot.yaml`.
4. Review the requested scopes. Click **Create**.

**STOP.** Do **not** click "Install to Workspace" yet. Composio installs it for you in §3.4.

### 2.3 [KARAN] Copy the Client ID and Client Secret

1. In the app you just created → **Settings → Basic Information**.
2. Under **App Credentials**, copy:
   - **Client ID** (looks like `1234567890.0987654321`)
   - **Client Secret** (click **Show** → copy)
3. Keep these in your password manager. You'll paste them into Composio in §3.3.

**Reversibility:** rotate Client Secret from the same screen at any time. Composio will need to be re-given the new secret.

---

## 3. Connect Slack via Composio (Composio holds the OAuth)

This is the only place where the Slack token ever exists. We never copy `xoxb-...` into our env. Composio's vault holds it; refresh and rotation are Composio's job.

### 3.1 [KARAN] Sign up for Composio (if not already)

1. Go to `https://app.composio.dev/signup`. Sign up with `karan@calmosis.com`.
2. Confirm the email.
3. **Settings → Account** — set the org name to `shoppingmate`.

### 3.2 [KARAN] Get a Composio API key

1. Composio dashboard → **Settings → API Keys → Create**.
2. Name it `shoppingmate-api-prod`. Copy the key (`ak_...`). This is `COMPOSIO_API_KEY`.

### 3.3 [KARAN] Set up the Slack toolkit with our Client ID/Secret

This is the "Bring your own OAuth app" path. Composio supports both their default app *and* per-customer Slack apps; we want ours so the bot shows up as **shoppingmate-bot** in our workspace, not as Composio's generic bot.

1. Composio dashboard → **Toolkits** → search **Slack** → open it.
2. Click **Connect** (or **Add Account**).
3. Choose **Bring your own OAuth app** (sometimes labelled "Use my own credentials").
4. Paste the **Client ID** and **Client Secret** you copied in §2.3.
5. Save.

### 3.4 [KARAN] Run the OAuth handshake

1. Still on the Slack toolkit page, click **Connect** (now using your credentials).
2. Composio redirects you to Slack's OAuth screen — you'll see "shoppingmate-bot is requesting permission for the shoppingmate.ai workspace".
3. **Allow.** Slack returns to Composio.
4. Composio shows a green "Connected" state and a **Connection ID** (`conn_...`). Copy this — it's `COMPOSIO_SLACK_CONNECTION_ID`.

After this point: `shoppingmate-bot` is installed in your workspace. The bot user is added. You did not see a token.

**Reversibility:** Composio dashboard → Slack → **Disconnect** instantly invalidates the token. Re-running §3.4 gets you a new connection.

### 3.5 [KARAN] Set the Composio webhook secret

This is what our `apps/api` uses to verify inbound webhook envelopes from Composio (see `apps/api/src/routes/slack/verify.ts`).

1. Composio dashboard → **Settings → Webhooks** → **Generate signing secret** (or copy the existing one). This is `COMPOSIO_WEBHOOK_SECRET`.
2. Set the webhook URL to your public api endpoint:
   - **Dev:** `https://<your-cloudflared-tunnel>.trycloudflare.com/v1/slack/events` (we'll set this up in §4.3).
   - **Prod:** `https://api.shoppingmate.ai/v1/slack/events`.
3. Composio supports separate URLs for events vs commands vs interactions, but our route accepts all three under `/v1/slack/*`. Set events → `/events`, commands → `/commands`, interactivity → `/interactions`.

---

## 4. Stand up the Slack handler (Hono route on `apps/api`)

Slack endpoints already exist in the repo at `apps/api/src/routes/slack/`. They verify Composio's webhook envelope (HMAC-SHA256 over `${webhook-id}.${webhook-timestamp}.${raw_body}`) and dispatch the inner Slack-format payload to handlers.

### 4.1 [CLAUDE] What's already in place

- `apps/api/src/routes/slack/index.ts` — Hono sub-app mounted on `/v1/slack`. Routes: `/events`, `/commands`, `/interactions`.
- `apps/api/src/routes/slack/verify.ts` — Composio webhook verification (HMAC-SHA256 over the signing string with `COMPOSIO_WEBHOOK_SECRET`, 300s freshness window).
- `apps/api/src/routes/slack/handlers/dispatch.ts` — `/work` has stubbed sub-commands (new/link/status/archive); other commands return "not implemented yet — coming in Plan N" stubs.
- Mounted in `apps/api/src/index.ts`: `app.route('/v1/slack', slackRoute);`

### 4.2 [KARAN] Add Composio secrets to env + restart api

Add to `.env` (root, since `apps/api` reads `--env-file-if-exists=../../.env`):

```
COMPOSIO_API_KEY=ak_...
COMPOSIO_SLACK_CONNECTION_ID=conn_...
COMPOSIO_WEBHOOK_SECRET=...
SLACK_TEAM_ID=T...
```

Notice what's **not** here: no `SLACK_BOT_TOKEN`, no `SLACK_SIGNING_SECRET`, no `SLACK_APP_TOKEN`. Composio holds those.

Then:

```
pnpm --filter @shoppingmate/api dev
```

The api is now serving `http://localhost:$API_PORT/v1/slack/*`.

### 4.3 [KARAN] Expose api publicly so Composio can hit it

Composio's webhook relay needs a public HTTPS URL. Two options:

- **Dev** — `cloudflared tunnel --url http://localhost:$API_PORT` (or `ngrok http $API_PORT`). Update Composio's webhook URL (§3.5) to the tunnel URL.
- **Prod** — deploy `apps/api` behind a public domain (`api.shoppingmate.ai`). Hosting choice is open — Fly.io, Railway, or self-host on a small VM all work since this is a Node service. Once chosen, set Composio's webhook URL (§3.5) to `https://api.shoppingmate.ai/v1/slack/*`.

Test: in any Slack channel, type `/work status`. Composio relays it to `apps/api`, which replies `not implemented yet`. If verification fails, the api logs a `composio webhook verification failed` warning with the reason.

**Reversibility:** kill the tunnel / shut down the deploy. The Slack app keeps the manifest but commands fail until the URL responds again.

---

## 5. Bootstrap channels via Composio's Slack MCP

Slack's outbound actions (create channel, post message, pin, react, invite) are invoked through Composio's MCP — same connection (`COMPOSIO_SLACK_CONNECTION_ID`) that handles inbound. The MCP server is declared in `apps/api/slack/mcp-config.json`.

### 5.1 [CLAUDE] `apps/api/slack/mcp-config.json` (already generated)

Allowed tools: `SLACK_SEND_MESSAGE`, `SLACK_UPDATE_MESSAGE`, `SLACK_ADD_REACTION_TO_AN_ITEM`, `SLACK_REMOVE_REACTION_FROM_AN_ITEM`, `SLACK_FIND_CHANNELS`, `SLACK_LIST_MESSAGES`, `SLACK_INVITE_USER_TO_CHANNEL`, `SLACK_CREATE_CHANNEL`, `SLACK_ARCHIVE_CHANNEL`, `SLACK_PIN_MESSAGE`, `SLACK_UPLOAD_FILE`, `SLACK_LIST_USERS`.

Denied: deletes, kicks, admin/scim/team_* actions. Anything outside the allow list requires an explicit `/install request` scope expansion (per the install-flow spec).

Audit-log mirror: every MCP tool call posts a thread reply on the originating `/install` grant message in `#install-grants`.

### 5.2 [BOTH] Run the channel-creation script

The script reads `apps/api/slack/channels.yaml` (manifest matching `docs/operating-model.md` §1) and creates each channel via Composio's Slack MCP.

- **[CLAUDE]** I've written `apps/api/scripts/create-channels.ts`. One-time install:
  ```
  pnpm --filter @shoppingmate/api add yaml
  ```
- **[KARAN]** Run from the repo root with the Composio creds in env:
  ```
  pnpm tsx apps/api/scripts/create-channels.ts --dry-run
  pnpm tsx apps/api/scripts/create-channels.ts
  ```
  The script reads `COMPOSIO_API_KEY` + `COMPOSIO_SLACK_CONNECTION_ID` from env and routes all calls through Composio's MCP. It is idempotent — channels that exist are looked up and updated rather than recreated.

> **Note:** the current `create-channels.ts` was written against the Slack Web API directly (taking a `--token`). I'll rewrite it to call Composio's MCP in the same Plan-7 PR that fleshes out the rest of the dispatch handlers. Until then, you can either (a) generate a one-time user OAuth token from the bot for bootstrap, or (b) wait for the rewrite. Recommendation: wait — channels can land via the MCP path so we exercise it once before agents do.

### 5.3 [CLAUDE] Pin the canonical owner/purpose/archive-condition post in each channel

`apps/api/scripts/create-channels.ts` already does this in the same pass — for every channel it creates (or already exists), it sets the conversation purpose, posts the canonical 4-line owner block, and pins it.

### 5.4 [CLAUDE] Wire the MCP into the agent skill stack

The `karan-naidu-ceo` skill (§4 action surface) gains a Slack-MCP tool group. I'll add the tool list to the skill frontmatter's `allowed-tools` and add a §4.x invocation example showing the @karan clone posting a daily digest into `#exec-karan` via `SLACK_SEND_MESSAGE`.

This is a **skill update**, so it goes through PR review — only human Karan merges.

---

## 6. Bootstrap the Slack-GitHub sync (skeleton only — full impl is Plan 7)

### 6.1 [CLAUDE] Generate `apps/api/src/routes/slack/sync/` skeleton

Files:
- `apps/api/src/routes/slack/sync/reaction-watcher.ts` — handles `reaction_added` events from §4. If the reaction is on a message linked to a GitHub PR (looked up via `work_unit` table), translates per `docs/operating-model.md` §5.1 table.
- `apps/api/src/routes/slack/sync/work-unit.ts` — Drizzle CRUD for the `work_unit` table (schema added to `packages/db/src/schema/`):
  ```sql
  CREATE TABLE work_unit (
    id UUID PRIMARY KEY,
    slug TEXT NOT NULL,
    slack_channel_id TEXT NOT NULL UNIQUE,
    github_branch TEXT NOT NULL,
    github_pr_number INT,
    spec_path TEXT,
    plan_path TEXT,
    state TEXT NOT NULL DEFAULT 'spec' CHECK (state IN ('spec','plan','build','review','deploy','archived')),
    created_at TIMESTAMPTZ NOT NULL,
    archived_at TIMESTAMPTZ
  );
  ```
- `packages/jobs/src/syncReconciliation.ts` — BullMQ repeating job, every 5 min. Compares Slack reaction state (queried via `SLACK_LIST_MESSAGES` MCP tool) to GitHub label state for every active work unit; re-syncs drift.
- `apps/api/src/routes/slack/sync/audit-log.ts` — append-only `sync_audit` table writes for every state translation.

These are stubs; the full impl is Plan 7. The schema + interfaces being defined now means the @karan clone can already invoke them when Plan 7 lands.

### 6.2 [KARAN] Run the migration (when Plan 7 is ready, not now)

This is a **stub for the future**. Don't run it yet — flagged here so you remember it's the gating step before the sync turns live.

---

## 7. First test — end-to-end smoke

### 7.1 [BOTH] In `#exec-karan`, run:

```
/work new test-slack-bootstrap
```

Expected:
- Slack relays the slash command to Composio.
- Composio signs and POSTs the envelope to `apps/api/v1/slack/commands`.
- `apps/api` verifies the signature, dispatches to `handleCommand`, replies via the `response_url`.
- Bot replies (in Slack): `created work unit a1b2c3...; channel #work-a1b2c-test-slack-bootstrap; branch work/a1b2c3-test-slack-bootstrap`.
- New channel exists.
- New branch on GitHub (`work/a1b2c3-test-slack-bootstrap`).

If any of these fail, `apps/api` logs (`pnpm --filter @shoppingmate/api dev` console output) tell us where — verification failures show as `composio webhook verification failed` warnings with a `reason`.

### 7.2 [KARAN] React with 🛑 on the bot's reply

Expected:
- Composio relays the `reaction_added` event.
- The work-unit state transitions to `blocked` in Postgres.
- Bot acks with a 👀 reaction (posted via `SLACK_ADD_REACTION_TO_AN_ITEM`).

### 7.3 [KARAN] Run `/work archive` in the new channel

Expected:
- Bot archives the channel via `SLACK_ARCHIVE_CHANNEL`.
- GitHub branch is left alone (not auto-deleted — that's a Plan 7 setting).

---

## 8. Day-2 ops — what runs automatically after this

Once §1–6 are done:

| Cadence | Action | Owner |
|---|---|---|
| Every Slack event | Composio relays to `apps/api` | Composio webhook |
| Every 5 min | Sync reconciliation cron | sync-worker |
| Daily 09:00 IST | @karan posts daily digest to `#exec-karan` | @karan clone |
| Daily 09:30 IST | @margin-bot checks worst-case GM rolling 7d | @margin-bot |
| Weekly Mon 10:00 IST | @karan posts weekly review | @karan clone |
| Monthly 1st | Strategy-doc-diff digest | @karan clone |

---

## 9. What this runbook does NOT do (yet)

- **Doesn't create the @karan clone bot itself** — that's a separate skill + agent runtime (Plan 8 — TBD spec). The `karan-naidu-ceo` skill exists, but the agent loop that runs it on a schedule is a separate piece.
- **Doesn't wire SAML SSO** — defer until team > 5 humans.
- **Doesn't enable enterprise compliance / DLP** — defer until first enterprise customer signs.
- **Doesn't set up PagerDuty / incident management** — separate runbook (TBD).
- **Doesn't register the Slack connection in our `install_connection` table** — that lands when the install-flow spec ships (Plan 6-bis). Until then, Composio's dashboard is the source of truth for the connection.

---

## 10. What I (Claude) generated as files in this commit

- [x] `docs/runbooks/slack-setup-step-by-step.md` (this file)
- [x] `apps/api/slack/channels.yaml` — channel manifest
- [x] `apps/api/slack/manifests/shoppingmate-bot.yaml` — Slack app manifest (Composio webhook URLs)
- [x] `apps/api/slack/mcp-config.json` — Composio Slack MCP config (uppercase tool names)
- [x] `apps/api/scripts/create-channels.ts` — channel bootstrap script (will be rewritten to call Composio MCP; current version takes a Slack user token)
- [x] `apps/api/src/routes/slack/index.ts` — Hono route + Composio envelope dispatch
- [x] `apps/api/src/routes/slack/verify.ts` — Composio HMAC-SHA256 verification
- [x] `apps/api/src/routes/slack/handlers/dispatch.ts` — slash-command stubs

When you've finished §1–§5, I can flesh out the dispatch handlers + sync watcher in a Plan 7 PR.

---

## 11. Acceptance for this runbook

- Workspace exists, Business+, US region, owned by `karan@calmosis.com`.
- `shoppingmate-bot` Slack app exists at `api.slack.com`; Client ID + Secret pasted into Composio's Slack toolkit ("Bring your own OAuth app").
- Composio shows a green Slack connection with a `conn_...` ID; that value is in `COMPOSIO_SLACK_CONNECTION_ID`.
- `apps/api` is reachable from the public internet; Composio's webhook URL points at it.
- `/work status` in Slack returns the stub reply (proves end-to-end relay works).
- All channels from `docs/operating-model.md` §1 exist with pinned owner blocks.
- `SLACK_LIST_USERS` invoked from a Claude session via the MCP returns the workspace members.

When all six pass, the Slack workspace is the OS — and we're ready for the @karan clone agent runtime to land on top.
