# shoppingmate.ai — Operating Model (Slack-as-OS)

**Date:** 2026-05-01
**Owner:** Karan (Calmosis)
**Status:** v0 — establishes the canonical Slack workspace structure, agent roster, and human/agent escalation rules. Update via PR; only human Karan merges.

> **Operating principle:** every operational signal — revenue, churn, billing, support, hiring, content, incidents, code reviews, deploys — routes through Slack **before** any other tool. We build automation for Slack first.

---

## 1. Channel taxonomy

Channels are grouped by **purpose**, not by team. Every channel has one **owner** (human or agent), one **purpose**, and a fixed **archive condition**.

### 1.1 Top-level groups

| Prefix | Purpose | Examples |
|---|---|---|
| `#exec-*` | Strategy, board, CEO clone interactions | `#exec-karan`, `#exec-board-prep` |
| `#work-*` | Per-work-unit threads (UUID-named, ephemeral) | `#work-12af3-onboarding-crawl` |
| `#dev-*` | Engineering / builds / PRs | `#dev-builds`, `#dev-pull-requests`, `#dev-incidents` |
| `#alerts-*` | Automated alerts (paging) | `#alerts-margin`, `#alerts-overrides`, `#alerts-uptime`, `#alerts-cost-spike` |
| `#install-*` | OAuth install requests + grants | `#install-requests`, `#install-grants`, `#install-revoke` |
| `#growth-*` | Marketing, content, GTM | `#growth-marketing`, `#growth-content`, `#growth-design-partners` |
| `#support-*` | Merchant support routing | `#support-inbox`, `#support-pii-vault` (private), `#support-ack` |
| `#hire-*` | Hiring loop (agent-driven, human-gated) | `#hire-pipeline`, `#hire-interviews`, `#hire-offers` |
| `#docs-*` | Documentation agent activity | `#docs-changes`, `#docs-stale`, `#docs-runbook-rehearsal` |
| `#money-*` | Revenue, billing, finance | `#money-revenue` (daily roll-up), `#money-stripe-events`, `#money-margin-floor` |
| `#compete-*` | Competitor monitoring | `#compete-feed` (raw signals), `#compete-pipeline` (curated) |

### 1.2 Per-work-unit channels

Every spec → plan → PR(s) → deploy is one **work unit** with a UUID. The work-unit channel is created at spec acceptance, archived after the deploy is verified in production. Naming: `#work-{first-5-chars-of-uuid}-{slug}`.

This is the abstraction that prevents channel sprawl. Don't create ad-hoc channels for "this feature" — open a work unit, get a UUID, get a channel.

### 1.3 Channel ownership

Every channel has a pinned post:

```
Owner: @karan / @docs-agent / @margin-bot / etc.
Purpose: <one sentence>
Archive condition: <e.g. "deploy verified" / "never" / "30d after last message">
Linked work-unit: <uuid or N/A>
```

If a channel has no pinned-post owner after 24h, the docs-agent comments and asks; if no answer in 7d, archives.

---

## 2. Reaction protocol

Reactions are the canonical way to signal state on a Slack message:

| Emoji | Meaning | Who applies |
|---|---|---|
| ✅ | Approved / accept the proposal | Human or agent with authority |
| 🔍 | Needs review (not yet approved) | Anyone |
| 🛑 | Blocked / do not proceed | Human or agent with authority |
| 🚀 | Ship it / merged / deployed | Human or sync bot |
| ⏸ | On hold / parked | Anyone |
| ❌ | Wrong / agent should self-correct | Human (high signal — triggers feedback memory write) |
| 👀 | Acknowledged / I'm looking | Human |

The Slack↔GitHub sync service watches these reactions on linked PR/issue threads and translates them into GitHub state changes (label, comment, merge if owner is authorized).

---

## 3. Slash commands

All commands relay through **Composio's Slack webhook trigger**, which signs an HMAC-SHA256 envelope and POSTs it to `apps/api/v1/slack/commands`. Our handler verifies the signature (`COMPOSIO_WEBHOOK_SECRET`), unwraps the inner Slack-format payload, and replies via the `response_url`. Slow commands (>3s) reply via webhook async. We never see a Slack token — Composio holds it. See `docs/runbooks/slack-setup-step-by-step.md` and `apps/api/src/routes/slack/`.

### 3.1 Work-unit commands

- `/work new <slug>` — create a new work unit + channel + GitHub branch + initial spec stub
- `/work link <pr-url>` — attach a GitHub PR to the current work-unit thread
- `/work status` — print the current work unit's spec / plan / PR / deploy state
- `/work archive` — close out the work unit (only after deploy verified)

### 3.2 Build / deploy commands

- `/ship <env>` — trigger a deploy of the current work-unit branch to staging or prod (prod requires ✅ from @karan)
- `/rollback <env>` — roll back the last deploy in env
- `/checks` — show CI status for the linked PR

### 3.3 Money / revenue commands

- `/revenue today|week|month` — print revenue + active merchants + new signups
- `/margin <plan>` — print measured GM for a plan over the last 7d
- `/cost-cut explain` — explain the latest auto cost-cut action (Haiku-default routing kicks in, etc.)

### 3.4 Install commands (Composio)

- `/install request <toolkit> <scopes> --why <reason>` — agent asks for an OAuth install (see `docs/superpowers/specs/2026-05-01-slack-install-flow.md`)
- `/install list` — show active connections (toolkit, scopes, expiry, agent owner)
- `/install revoke <connection-id>` — revoke a connection

### 3.5 Hiring commands (human-gated)

- `/hire intake <role>` — agent drafts JD + scoring rubric for human review
- `/hire pipeline` — show candidates by stage (sourced / reached / interviewed / offered)
- `/hire approve <candidate-id> <stage>` — human-only, advances candidate (no auto-advance ever)

### 3.6 Docs commands

- `/docs new <type>` — create a new doc (runbook / process / decision / reference / playbook) from template
- `/docs stale` — list docs whose `valid_until` has passed
- `/docs validate <path>` — run the docs validator (frontmatter, links, citations)

### 3.7 Competitor commands

- `/compete summary <competitor>` — agent summarizes recent signals
- `/compete pipeline` — show curated competitor product pipeline (parsed from blogs, GitHub, changelogs)

---

## 4. Agent roster

Each agent is a Claude instance with a specific skill, an action surface, and a confidence-band publishing rule (see `karan-naidu-ceo` skill §8).

| Agent | Channel home | Skill | Authority | Escalates to |
|---|---|---|---|---|
| **@karan** (CEO clone) | `#exec-karan` | `.agents/skills/karan-naidu-ceo/SKILL.md` | Strategic, product, hiring (human-gated), billing decisions; can ✅ work-unit specs | Human Karan on ❌, > $5K spend, hiring final round, legal/compliance, brand-risk content |
| **@docs-agent** | `#docs-changes`, `#docs-stale` | `.agents/skills/docs-agent/SKILL.md` (TBD) | Create/update docs, run validation crons, rehearse runbooks | @karan when a doc would change a §5.4 invariant or roadmap §6 guardrail |
| **@margin-bot** | `#alerts-margin`, `#money-margin-floor` | (script + agent) | Page when measured worst-case GM dips below 70% in a rolling 7d window | @karan immediately on breach |
| **@hire-agent** | `#hire-pipeline`, `#hire-interviews` | `.agents/skills/hire-agent/SKILL.md` (TBD) | Source, draft outreach (never auto-send), schedule, score interviews | @karan for every outreach send and every advance/offer |
| **@growth-agent** | `#growth-marketing`, `#growth-content` | `.agents/skills/growth-agent/SKILL.md` (TBD) | Draft posts, plan campaigns, run Meta MCP, A/B test landing copy | @karan on > $1K ad spend or brand-voice deviation |
| **@compete-agent** | `#compete-feed`, `#compete-pipeline` | `.agents/skills/compete-agent/SKILL.md` (TBD) | Monitor 10+ sources, summarize signals, flag pipeline shifts | @karan when a signal triggers a kill-switch (e.g. Sidekick announces cross-platform) |
| **@support-agent** | `#support-inbox`, `#support-ack` | `.agents/skills/support-agent/SKILL.md` (TBD) | Acknowledge tickets, draft replies (human-sent), run dogfood reproductions | @karan on PII, refund > $100, public complaint |
| **@install-agent** | `#install-requests`, `#install-grants` | (Composio Connector Service handler) | Request OAuth installs via Slack, store connections, enforce trust budget | @karan on every grant request (human ✅ required) |

### 4.1 Confidence-band publishing rule

Every agent message that proposes an action must end with a confidence band:

- **HIGH (≥90%):** "I'll proceed unless ❌ in 30 min." (Auto-proceed for reversible actions only.)
- **MEDIUM (70–89%):** "Asking for ✅ before I proceed."
- **LOW (40–69%):** "Here's what I'd do; please decide." (Always human ✅.)
- **NO-GO (<40%):** "I don't have enough signal — paging @karan."

Agents NEVER skip the band. Without it, the action is rejected on review.

---

## 5. Slack ↔ GitHub sync

The sync service is a Cloudflare Worker (in `web/sync/` — TBD). State lives in KV (idempotency) + Postgres (audit log). Reconciliation cron every 5 min catches missed events.

### 5.1 What syncs

| Slack signal | GitHub action |
|---|---|
| `/work new <slug>` | Create branch `work/<uuid>-<slug>` from main + open empty PR draft |
| `/work link <pr-url>` | Attach PR # to work-unit thread metadata |
| ✅ on PR thread (by authorized owner) | Add `approved` label; if all checks green, auto-merge |
| 🛑 on PR thread | Add `blocked` label; convert PR to draft |
| 🚀 on PR thread (by authorized owner after merge) | Trigger deploy workflow |
| ❌ on agent message | Write `feedback_*.md` memory + ping agent owner |
| GitHub PR opened | Cross-post into the work-unit thread |
| GitHub PR review-requested | Add 🔍 reaction in Slack |
| GitHub deploy succeeded | Add 🚀 reaction in Slack + post deploy URL |
| GitHub deploy failed | Page `#alerts-uptime` |

### 5.2 Authority table

A reaction only triggers an action if the reactor is on the authority list for that work unit:

- **Code merges:** PR author + @karan + (later) any teammate listed in `.agents/codeowners.yaml`
- **Deploys:** @karan + on-call (when on-call exists)
- **Spec ✅:** @karan only for v0.1
- **Hire approvals:** human Karan only; @karan clone cannot ✅ hires
- **Margin breach overrides:** none — `#alerts-margin` cannot be muted by anyone but human Karan

### 5.3 Idempotency

Every Slack event carries an `event_id`. Sync writes `(event_id, processed_at)` to KV with 7d TTL before acting. Replays are no-ops. Reconciliation cron compares Slack message states against GitHub label states every 5 min and re-syncs drift.

---

## 6. Escalation rules (when humans must intervene)

Per `karan-naidu-ceo` skill §14, the CEO clone (and every other agent) **must** page human Karan in `#exec-karan` for:

1. Any spend decision > $5K (per quarter, cumulative)
2. Any hiring final-round / offer / reference call
3. Any legal / compliance / privacy / IP question
4. Any margin-floor breach (`#alerts-margin`)
5. Any brand-risk content (founder-voice posts, press, investor comms)
6. Any kill-switch trigger (Sidekick goes cross-platform; > 50% of beta cohort churns; etc.)
7. Any ❌ from a teammate the agent doesn't already have a feedback memory for
8. Any work-unit change that touches a §5.4 invariant or roadmap §6 guardrail
9. Any cross-merchant data action or connection-request that asks for non-default scopes
10. Any deploy of voice-path code (Plan 4-bis pilot is the gate)

Format for escalation messages:

```
@karan [escalation:reason]
Context: <one paragraph>
Options: <2-3 with confidence + impact + reversibility>
Recommendation: <pick one, say why>
Reversibility: <minutes / hours / days / permanent>
Confidence: HIGH / MEDIUM / LOW / NO-GO
```

---

## 7. Review cadences

- **Daily** (auto, 09:00 IST): @karan posts a digest in `#exec-karan` — yesterday's revenue + new signups + open PRs + open escalations + open margin alerts
- **Weekly** (Mon, 10:00 IST): @karan posts the weekly review — 7d revenue, churn, GM by plan, top 3 customer signals, top 3 competitor signals, blockers
- **Monthly** (1st of month): @karan posts the strategy-doc-diff digest — what changed in `docs/strategy/` + viability `🟢🟡🔴` shifts
- **Quarterly:** human Karan reviews the strategy + viability docs end-to-end and updates invariants if needed (skill update goes through PR review)

---

## 8. Source documents

- **Strategy:** `docs/strategy/2026-05-01-shoppingmate-strategy.md`
- **Viability:** `docs/strategy/2026-05-01-shoppingmate-viability-analysis.md`
- **CEO skill:** `.agents/skills/karan-naidu-ceo/SKILL.md`
- **Voice-stack ADR:** `docs/adr/2026-05-01-voice-stack-livekit-gemini-live.md`
- **Slack-driven OAuth install spec:** `docs/superpowers/specs/2026-05-01-slack-install-flow.md`
- **Slack setup runbook:** `docs/runbooks/slack-setup-step-by-step.md`
- **Roadmap:** `docs/superpowers/roadmap.md`
