# Customer Intent & Data Capture — Design

**Date:** 2026-06-21
**Status:** Approved (brainstorm) → ready for implementation plan
**Drives:** (1) brand dashboard insights, (3) personalization — live *and* cross-session, voice-first (voice **and** text).
**Deferred (later phases):** retargeting/ads audiences, sales/ops lead routing, consent UI/retention/deletion.

## Problem

Today, per conversation we store only: transcript, outcome (purchased/abandoned), cart-adds, checkout-reached, attributed revenue, coupon, source. There is **no structured layer of customer intent, needs, objections, preferences, identity, or affect** — so the merchant gets no insight into *what* visitors want or *why* they drop, and the bot can't personalize for a returning visitor or adapt to emerging intent.

This design adds a deterministic capture layer that (a) structures intent/signal per conversation for the dashboard, and (b) builds a persistent per-visitor profile that personalizes future and in-progress sessions, in both voice and text.

## Approach: two-tier capture (chosen)

A lightweight **live classifier** runs during the call for low-latency in-session use; a thorough **session-end profiler** does one extraction over the full transcript for the dashboard record + the visitor profile. Both are **deterministic** (run by the runtime/worker), not dependent on the bot choosing to call a tool — avoiding the voice tool-calling unreliability seen elsewhere.

Rejected: full extraction every turn (cost/latency), and a bot-invoked `capture_signal` tool (unreliable in voice).

## 1. Captured data model (per conversation)

Session-end profiler extracts the full record. The live classifier captures only the **bold** subset each cycle.

- **Intent** — one primary + confidence + trigger phrase. Enum: `browsing · researching · comparing · ready_to_buy · price_sensitive · support_issue · medical_consult · bulk_b2b · post_purchase`.
- **Needs / concerns** — normalized tags (`sleep, stress, pain, focus, recovery, pet, …`) + free text.
- **Objections / friction** — `price · safety_ingredients · trust_doubt · delivery_time · dosage_uncertainty · payment`.
- **Preferences / interest** — products viewed/added, flavours, quantity, Bliss Club interest, coupon used.
- **Identity** (when provided) — name, phone, email, location (city/pincode), age, **language/dialect**.
- **Behavioral / session** — pages visited (site graph), products viewed, cart actions, **funnel drop-stage**, device (mobile/desktop), session length, mode (voice/text).
- **Affect** — **sentiment** (pos/neutral/neg), confusion/hesitation flags, repeated questions.
- **Outcome** — `purchased · abandoned(+stage) · consulted · inquiry_sent · left` + attributed revenue.

Most of this is already latent in the transcript + funnel events we record; the profiler structures it.

## 2. Storage

Two stores in Postgres:

- **Conversation record** — extends the existing `conversationCompleted` tags (`ConversationTags`): add `intent`, `intent_confidence`, `needs[]`, `objections[]`, `preferences` (jsonb), `affect` (jsonb), `identity` (jsonb), `drop_stage`. One row per conversation. Powers the dashboard.
- **Visitor profile** — new table keyed by the existing `visitor_id` (widget localStorage `sm_visitor_id`). A latest-wins rollup across that visitor's conversations: `identity` (jsonb), `top_intents[]`, `needs[]`, `objections[]`, `products_of_interest[]`, `last_outcome`, `last_drop_stage`, `session_count`, `lifetime_value_cents`, `last_seen`, `merchant_id`. This is what personalization reads/writes.

Stored transcripts keep PII **redacted** (existing `redactPii`); structured identity lives only in the access-controlled conversation record + profile.

## 3. Capture pipeline (3 deterministic hooks)

1. **During the call** — a tiny classifier (cheap model) runs every few turns over the conversation-so-far → emits the live signal (intent, urgency, top objection, named need). Held in session state for in-session use. Cheap enough to run per cycle; not a full extraction.
2. **At session end** — on the existing `conversationCompleted` emission, the profiler runs **one** extraction over the full transcript + funnel events → writes the conversation record **and** upserts/merges the visitor profile (latest-wins for identity, accumulate for intents/needs/objections, sum LTV, bump session_count).
3. **At session start** — load the visitor profile by `visitor_id`; if present, build a compact summary string for personalization (see §4).

## 4. Personalization — voice **and** text

Same captured signal, two delivery paths. Voice is first-class via three mechanisms (none rely on fragile per-turn mid-call injection):

- **Session-start baking (primary lever, voice + text).** For a returning visitor, the profile summary is injected into the system instruction *before* the session opens (Gemini `systemInstruction` for voice; the system prompt for text). The bot opens already knowing who they are, what they came for, and where they left off.
- **Live signal → side-channel executor (voice + text).** The per-turn classifier signal feeds the runtime/executor that already drives actions — surfacing the right products, offer, or navigation as intent emerges. This is how voice already acts on the conversation, so it is robust.
- **Event-driven spoken nudges (voice).** On a *strong* signal (clear buy intent, returning-visitor moment, detected objection), a single well-timed nudge via the **existing checkout-grounding channel** (`gemini.speak`) makes the bot proactively say the right thing. Event-driven, not per turn, to avoid straining the session.

Text in-session personalization simply feeds the live signal into the next turn's prompt.

## 5. Dashboard surfacing

Extends the existing conversations/consultations/audit pages:

- **Intent overview** — distribution of primary intents over time.
- **Demand & needs** — top needs/concerns, and **unmet demand**: things asked for that aren't stocked or the bot couldn't find.
- **Friction / drop-off** — abandonment by funnel stage + top objections (the *why*).
- **Audience** — visitor-profile list (identity + top intents + LTV + last seen) → spot high-value/returning visitors.
- **Per-conversation** — the existing detail page gains the extracted intent/needs/objections/identity tags.

## 6. Privacy (v1 minimal)

- Full identity is captured and stored (merchant's call). Profiles/identity are visible **only to the merchant** via existing dashboard auth — never exposed publicly.
- Stored transcripts keep PII redacted.
- **Deferred to a later phase (not built in v1):** consent UI/notice, retention window + purge, data-subject deletion path. To be added if/when required.

## 7. Phasing

1. **Capture + store** — data model, conversation record extension, visitor profile table, session-end profiler, profile upsert/merge. (Foundation; no UI yet.)
2. **Cross-session personalization** — load profile at session start, bake summary into the system instruction/prompt (voice + text).
3. **Dashboard views** — intent overview, demand/unmet-demand, friction, audience, per-conversation tags.
4. **Live signal** — per-turn classifier + executor steering + event-driven voice nudges.

## Open questions / non-goals

- Non-goals (v1): ads audiences, lead routing/CRM, consent/retention/deletion UI.
- The live classifier model + cadence (every N turns) to be tuned for cost/latency during implementation.
