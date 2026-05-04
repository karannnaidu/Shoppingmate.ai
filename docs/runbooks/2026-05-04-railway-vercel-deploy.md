# Railway + Vercel Deploy Runbook

**Created:** 2026-05-04 by the Phase 2 close pass.

This runbook captures the production topology for shoppingmate.ai and the manual steps the operator must run before traffic can flow. The Railway project itself was created via CLI; everything else (GitHub link, secrets, Vercel project, DNS, migrations) is the operator's job.

---

## Topology

```
                              ┌──────────────────────────┐
        shoppingmate.ai ────► │  Vercel (web/)           │
        app.shoppingmate.ai ► │  Next.js 16 dashboard    │
                              │  + (marketing) landing   │
                              └────────────┬─────────────┘
                                           │
                  shared Postgres + Redis  │  internal network
                                           ▼
                              ┌──────────────────────────┐
        api.shoppingmate.ai ► │  Railway: api            │
                              │  (apps/api, Hono)        │
                              ├──────────────────────────┤
                              │  Railway: worker         │
                              │  (apps/worker, BullMQ)   │
                              ├──────────────────────────┤
                              │  Railway: voice-agent    │
                              │  (LiveKit Agents JS)     │
                              ├──────────────────────────┤
                              │  Plugin: Postgres        │
                              │  Plugin: Redis           │
                              └──────────────────────────┘

External SaaS (not deployed by us): Stripe, Composio, Resend, LiveKit Cloud,
Cloudflare R2, Anthropic, Gemini, OpenAI, Slack.
```

## Railway state (already provisioned via CLI)

- Project: `shoppingmate` (id `dbebf90b-2f92-40d0-9f63-9a30320529a4`) on workspace `karannnaidu's Projects`
- Environment: `production`
- Plugins: `Postgres`, `Redis` (managed)
- Services: `api`, `worker`, `voice-agent` (empty — no source connected yet)
- API public URL (auto): `https://api-production-1ea1.up.railway.app` (Railway-issued; replace with `api.shoppingmate.ai` after DNS)
- Each service has `railway.json` checked into the repo pointing at its own Dockerfile + watch paths (`apps/api/Dockerfile`, `apps/worker/Dockerfile`, `apps/voice-agent/Dockerfile`).

Pre-set env vars on every app service:
- `DATABASE_URL = ${{Postgres.DATABASE_URL}}` (Railway internal)
- `REDIS_URL = ${{Redis.REDIS_URL}}` (Railway internal)
- `NODE_ENV = production`
- `LOG_LEVEL = info`
- `api` service additionally: `PORT=3000`, `API_PORT=3000`

---

## Operator checklist — Railway

### 1. Connect each service to GitHub

For each of `api`, `worker`, `voice-agent`:

1. Open the service in the Railway dashboard
2. Settings → Source → "Connect Repo" → `karannnaidu/Shoppingmate.ai`, branch `main`
3. The `railway.json` checked into the repo will auto-configure the Dockerfile path and watch patterns; nothing else to set
4. Trigger first deploy

### 2. Add external secrets per service

Required for `api`:
- `BETTER_AUTH_SECRET` — generate `openssl rand -base64 32`
- `BETTER_AUTH_URL` = `https://app.shoppingmate.ai` (Vercel URL — set after step 7)
- `RESEND_API_KEY`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_STARTER_MONTHLY`, `STRIPE_PRICE_GROWTH_MONTHLY`, `STRIPE_PRICE_SCALE_MONTHLY`
- `STRIPE_PRICE_TOPUP_50`, `STRIPE_PRICE_TOPUP_200`, `STRIPE_PRICE_TOPUP_1000`, `STRIPE_PRICE_TOPUP_5000`
- `COMPOSIO_API_KEY`, `COMPOSIO_SHOPIFY_AUTH_CONFIG_ID`, `COMPOSIO_WEBHOOK_SECRET`
- `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET`
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (or `GOOGLE_GENERATIVE_AI_API_KEY` depending on Plan 4 wiring)
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` (only if Slack ops hooks are enabled in this env)

Required for `worker`:
- All Stripe + Composio + R2 + Anthropic/Gemini keys (subset of api's — worker runs kb-ingest)
- `ANTHROPIC_API_KEY`, `GEMINI_API_KEY` (for KB embedding/chunking if applicable)

Required for `voice-agent`:
- `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- `GEMINI_API_KEY` (Live API for native audio)
- `ANTHROPIC_API_KEY` (Plan 4 cognition)

### 3. Set service target ports

- `api`: target port 3000 (set by `PORT=3000` env var; verify in Settings → Networking)
- `worker`, `voice-agent`: no inbound HTTP — leave Networking → Public empty

### 4. Apply Drizzle migrations

After `Postgres` plugin is up and `api` has deployed once, apply schema:

```
railway run --service api -- pnpm --filter @shoppingmate/db migrate
```

If the package script is named differently (`push`, `migrate:run`, etc.), use whatever `packages/db/package.json` exposes.

### 5. Wire custom domains

- `api.shoppingmate.ai` → CNAME to the Railway-issued domain (`api-production-1ea1.up.railway.app`). Add via Railway dashboard → Service → Settings → Networking → Custom Domain. Railway will return the exact CNAME target to put in your DNS.
- `app.shoppingmate.ai`, `shoppingmate.ai` → see Vercel section below.

### 6. Smoke tests

- `curl https://api.shoppingmate.ai/health` → `{ ok: true }` or similar
- Tail logs: `railway logs --service api`, same for worker + voice-agent — no crash loops
- Postgres: `railway connect postgres` → `\dt` shows the new dashboard tables (users, sessions, verifications, merchant_owners, brand_kb_documents, brand_kb_chunks, alerts, stripe_events) plus the merchants additions

---

## Operator checklist — Vercel

### 7. Create the Vercel project

```
cd web
vercel link
```

Settings to confirm in the dashboard:
- **Framework preset:** Next.js (auto-detected)
- **Root Directory:** `web`
- **Build Command:** `cd .. && pnpm install --frozen-lockfile && pnpm --filter web build` (Vercel needs the workspace install at repo root)
- **Output Directory:** `.next` (default)
- **Install Command:** leave default — overridden by build command above
- **Node version:** 20.x

### 8. Add Vercel env vars (Production scope)

- `DATABASE_URL` — copy from Railway Postgres "Public" URL (NOT internal `postgres.railway.internal`, which is only reachable inside Railway). Vercel will hit Postgres over the public proxy.
- `BETTER_AUTH_SECRET` — same value as on Railway api
- `BETTER_AUTH_URL` = `https://app.shoppingmate.ai`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_APP_URL` = `https://app.shoppingmate.ai`
- All `STRIPE_*`, `COMPOSIO_*`, `R2_*` keys (web has its own server actions and API routes that need them)
- `SHOPPINGMATE_API_BASE` (or whatever the widget bootstrap reads) = `https://api.shoppingmate.ai` — used by marketing pages that embed the widget

### 9. Domains

In Vercel project Settings → Domains:
- `shoppingmate.ai` (apex) — points to Vercel
- `app.shoppingmate.ai` — points to Vercel
- `www.shoppingmate.ai` — redirect to apex

DNS records the operator must add (Vercel will show exact targets):
- `A` apex → 76.76.21.21 (Vercel anycast) or `ALIAS` if your DNS supports it
- `CNAME app` → `cname.vercel-dns.com`
- `CNAME api` → Railway target (from step 5)
- `CNAME www` → `cname.vercel-dns.com` (with redirect rule in Vercel)

### 10. Cross-system smoke

After both deploys finish:
- Visit `https://shoppingmate.ai` — marketing landing renders
- Click "Get started — $30/mo" → `/signup` magic-link form
- Send magic link to a test inbox → click → land on `/app/onboarding`
- Run the 11-item Phase 2 acceptance checklist at `docs/runbooks/2026-05-04-phase2-acceptance.md` against the live env
- Once green, tag `git tag phase2-brand-dashboard-complete && git push origin phase2-brand-dashboard-complete`

---

## Cost guardrails

Railway Hobby plan: $5/mo trial credits, then $0.000231/GB-hr RAM + $0.000463/vCPU-hr. Expected steady-state for the four services + two plugins on smallest sizes: ~$15-25/mo. Set a usage cap in Project Settings → Usage limits.

Vercel Hobby: free for marketing + low-traffic dashboard. Upgrade to Pro ($20/seat/mo) if SSR traffic exceeds free quotas or you need preview-deploy passwords.

If billing trips a soft limit before live traffic, the most likely cause is the voice-agent leaking long-lived LiveKit sessions. Track $/conv via the cost-pilot ledger (Plan 6 phase J) before committing to scale.

---

## What's NOT done in this runbook

- **GitHub repo connection** — manual dashboard step per service
- **Secret values** — operator owns these; CLI cannot paste real keys safely
- **DNS** — operator owns the registrar
- **First deploy of api/worker/voice-agent** — triggered after step 1
- **Database migration apply** — step 4
- **Vercel project creation + domains** — steps 7-9
- **Acceptance checklist run** — `docs/runbooks/2026-05-04-phase2-acceptance.md`
- **Tag** — after acceptance passes

If any of these steps fail, the failure mode + remediation goes here as an addendum dated and signed.
