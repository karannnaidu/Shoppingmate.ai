# PRD — Customer Care in the assistant: order tracking, complaints, feedback, photo proof

**Date:** 2026-10-28 · **Owner:** Karan · **Status:** Decided 2026-10-28 — Phase 1 in build
**Builds on:** `2026-10-06-smart-site-navigation-and-case-capture-prd.md` (case capture is live; its Phase 7 "order lookup" was blocked).

## 1. Problem

Shoppers ask the assistant "where is my order?", want to complain ("it arrived broken"), or leave feedback. Today the assistant can only *log* those as a case and email the brand owner. It cannot:

- tell the shopper their live order status or tracking link,
- take a photo of the problem (proof) with the order ID,
- send the shopper a confirmation / update email,
- record praise or feedback as its own thing.

So the shopper still has to email or call the brand, and the brand re-types what the bot already heard.

## 2. Goals

1. **Answer "where is my order?" with live data** (status, courier, tracking link, expected date) for Shopify, WooCommerce and custom backends — after verifying the shopper owns the order.
2. **Take complaints, returns and feedback end to end**: collect the order ID, a short description, and optional photos; save one tidy case; email the brand **and** the shopper.
3. **Keep the shopper informed**: a confirmation email with a reference number, and an email when the brand replies or resolves it.
4. **Near-zero work for brands**: one click to connect a store; everything else has sensible defaults.
5. Works in **text and voice** (in a voice call, photos are added from the call panel).

## 3. Non-goals (this PRD)

- Issuing refunds, cancelling or editing orders automatically (the bot creates the request; a human acts). Revisit in v2.
- A full helpdesk (assignment, SLAs, macros). We integrate with one if a brand already has it (§8, later).
- WhatsApp/SMS notifications (email first; WhatsApp is a v2 channel).

## 4. What exists today (reuse, don't rebuild)

| Piece | State | Where |
|---|---|---|
| `case.open` tool (types: order_tracking, complaint, return_refund, bad_review, product_question, booking, quote, other) | Live behind `CASE_CAPTURE` | `packages/agent/src/tools.ts:455`, `case.ts` |
| `support_cases` table | Live; no `order_id`, no attachments, no replies | `packages/db/src/schema/supportCases.ts` |
| Brand email on new case (Resend) | Live; owners only | `packages/db/src/notify/submitCase.ts` |
| Dashboard "Customer requests" inbox | Live; open/resolved only | `web/src/app/app/cases/` |
| Shopify Admin token per merchant (encrypted) | Stored; used for catalog only | `merchants.shopify_admin_token_enc` |
| Shopify webhooks | `orders/create` (attribution) only | `apps/api/src/routes/webhooks/shopify.ts` |
| R2 storage + presigned uploads | Live for brand KB docs | `web/src/lib/r2.ts` |
| One-brain voice tools | Live for Calmosis | `apps/voice-agent/src/liveTools.ts` |

Missing: order lookup on any platform, customer emails, photo upload, `feedback` type, case replies/history, per-brand support email.

## 5. User experience

### 5.1 "Where is my order?"
> **Shopper:** Where's my order?
> **Olivia:** I can check that. What's your order number, and the email or phone you ordered with?
> **Shopper:** It's 1043, karan@…
> **Olivia:** Found it — it shipped yesterday with Delhivery and should arrive Thursday. I've put the tracking link on your screen.

- Order card on screen: status, items, courier, tracking number, **Track package** button, expected date.
- Voice never reads a full tracking number or URL aloud ("the link is on your screen").
- If not verified after 3 tries → no details shown; offer to raise a request for the team.
- Not connected / not found → creates an `order_tracking` case (today's behaviour) and tells the shopper when to expect a reply.

### 5.2 Complaint / return with photo proof
> **Shopper:** My bottle arrived broken.
> **Olivia:** Sorry about that. What's the order number? … Could you add a photo of it? Tap the camera button below.
> *(shopper adds 1–3 photos)*
> **Olivia:** Got it — I've logged this as request #212 with your photos. The team usually replies within a day, and I've emailed you a copy.

- Camera/attach button in the chat box and in the voice-call panel (opens the phone camera or gallery).
- If the order is connected, the bot pre-fills the order (items, date) into the case so the brand sees it without looking it up.

### 5.3 Feedback
> **Shopper:** Just wanted to say the Sleep Mantra really helped.
> **Olivia:** That's lovely to hear — mind if I pass that to the team?

- New case type `feedback` (positive or negative). Positive feedback can optionally go into the brand's review flow later.

### 5.4 Emails
| To | When | Contents |
|---|---|---|
| Brand (exists, improved) | New case | Type, urgency, order + items, photos (thumbnails + links), transcript link |
| Shopper (new) | New case | "We've got your request #212" + summary + what happens next |
| Shopper (new) | Brand replies or resolves in the dashboard | The brand's reply text; "reply to this email to continue" |

Sender: **"<Brand> Care <care@mail.shoppingmate.ai>"**, reply-to = the brand's support email (so shopper replies land in the brand's inbox). Brands that want their own domain can verify it later (Resend domain).

### 5.5 Brand dashboard
- Inbox gets **To do / In progress / Done**, an order panel, photo gallery, and a **Reply to customer** box (sends the email in §5.4).
- Settings → **Customer care**: support email (pre-filled with the owner's), which request types are on, store connection status.

## 6. Connecting order data — best, simplest options per platform

The bot only needs one capability from every backend: **"look up this order, given order number + email/phone"**, returning a standard shape:

```json
{ "orderNumber": "1043", "status": "shipped", "placedAt": "...", "items": [{"title":"Sleep Mantra","qty":1}],
  "fulfillment": { "carrier": "Delhivery", "trackingNumber": "...", "trackingUrl": "...", "eta": "2026-10-30" },
  "customerEmail": "k***@gmail.com", "customerPhoneLast4": "1728" }
```

Each platform is one small adapter behind that shape.

| Platform | Brand effort | How | Notes |
|---|---|---|---|
| **Shopify** (recommended first) | **One click** (approve scopes when installing/updating the shoppingmate app) | Admin GraphQL `orders(query:"name:#1043")` + `fulfillments.trackingInfo`, using the stored per-merchant token. Add scopes `read_orders`, `read_fulfillments` (+ `read_all_orders` for orders older than 60 days, needs Shopify approval). Webhooks `fulfillments/create`, `fulfillments/update` for proactive updates. | Pilot brands on the custom-app token already granted `read_orders`. |
| **WooCommerce** | **One click** | WooCommerce's built-in "Authorize app" flow (`/wc-auth/v1/authorize`) gives us read-only REST keys automatically — the brand just clicks Approve. Orders via `/wp-json/wc/v3/orders?search=1043`; tracking from the common "Shipment Tracking" plugin meta when present. | No plugin to install. |
| **Shiprocket / AfterShip** (covers most custom & Indian D2C stores) | **Paste one API login** | Look up by order ID / AWB straight from the shipping aggregator. Gives courier status even when the store backend has no API. | Calmosis already uses Shiprocket (`SHIPROCKET_*` on its backend). AfterShip for non-India brands. |
| **Custom backend** (fallback) | A developer adds one endpoint (~1 hour) | We publish a tiny spec: `GET https://brand.com/shoppingmate/order?number=&email=` → the JSON above, signed with a shared secret (HMAC). | Calmosis: we own the backend — add this endpoint ourselves. |
| **Nothing connected** | None | Bot logs an `order_tracking` case + emails the brand (works today). | Always the safety net. |

**Recommendation:** Shopify one-click first (largest share of target brands), Shiprocket second (unlocks Calmosis and most Indian custom stores with zero dev work), WooCommerce one-click third, custom endpoint spec published for anyone else.

### 6.1 Proactive updates (phase 3)
Shopify fulfillment webhooks / Shiprocket status webhooks → if the shopper has an open tracking case or opted in during the chat, email them "Your order has shipped / is out for delivery".

## 7. Safety, privacy and trust

- **Ownership check before showing anything:** order number **and** matching email or phone (last 4 digits OK). Max 3 failed attempts per session, then stop and offer a case.
- Never show full address, full phone or payment details; the order card shows city + masked contact only.
- Never invent a status: the tool returns the real status or "not found"; the prompt keeps the existing "never invent tracking" rule.
- Photos: private R2 bucket, images only (JPEG/PNG/HEIC/WebP), ≤10 MB each, ≤3 per case, metadata (EXIF/location) stripped on upload, shown via short-lived signed links, auto-deleted after 180 days (configurable).
- Consent: the bot asks before saving contact details (existing `consent` field); customer emails include a one-line privacy note. India DPDP / GDPR: delete-on-request covers cases + photos.
- Voice: order numbers and phone digits read back for confirmation; tracking numbers/URLs only on screen.

## 8. Data & system changes

- `support_cases`: add `order_id text`, `order_snapshot jsonb` (items/status at the time), type `feedback`; start using `in_progress`.
- New `case_attachments` (id, case_id, merchant_id, r2_key, mime, bytes, created_at).
- New `case_events` (id, case_id, kind: note | reply_to_customer | status_change | customer_email_sent, body, actor, created_at).
- `merchants`: `support_email`, `care_settings jsonb` (enabled types, retention), order-source credentials (encrypted, like the Shopify token).
- API: `POST /v1/care/upload-url` (widget session token → presigned PUT, image-only, size-capped), `POST /v1/care/attach`.
- Agent tools: `order.lookup {orderNumber, email|phone}` (verify + return the standard shape) and `case.attach_photos`; `case.open` gains `order_id`.
- Widget: attach button (chat + call panel), order card component, upload progress chip.
- Email templates: brand (improved), shopper confirmation, shopper reply.
- Later (v2): push cases into the brand's helpdesk if they use one (Gorgias / Zendesk / Freshdesk) instead of our inbox.

## 9. Phases

| Phase | Scope | Works for | Effort (est.) |
|---|---|---|---|
| **1. Care basics** | `feedback` type, photo upload (chat + voice panel), attachments on cases, shopper confirmation email, dashboard reply + In progress, support-email setting | Every platform, no connection needed | ~1 week |
| **2. Live order status — Shopify** | `order.lookup` + ownership check, order card, scopes + reinstall prompt, pre-fill orders into complaints | Shopify brands | ~1 week |
| **3. Shiprocket + Calmosis** | Shiprocket adapter, Calmosis endpoint, fulfillment/status webhooks → proactive shopper emails | Calmosis, Indian custom stores | ~4–5 days |
| **4. WooCommerce + custom spec** | Woo one-click auth, published endpoint spec + signed requests, AfterShip | Woo + any custom backend | ~1 week |

Each phase ships behind a per-merchant flag and is verified the same way as voice: real calls on a live store before turning on.

## 10. Success metrics

- ≥70% of "where is my order?" questions answered with live status (connected brands), no human needed.
- Complaint cases with order ID **and** photo: ≥80% (vs today: no photos).
- Shopper confirmation email delivered on 100% of cases with an email address.
- Brand time-to-first-reply on cases (dashboard) — track; target < 24h.
- Zero order details shown to a shopper who failed the ownership check.

## 11. Decisions (Karan, 2026-10-28)

1. **Shopper email sender:** our domain with the brand's name, reply-to = brand support email. ✅
2. **Shipping service:** **Shiprocket** first. **Plus a brand Order Data API**: brands' IT teams can *push* order + shipment updates to us (REST + webhook, signed with a per-brand key) — no endpoint on their side needed. We store the latest status and answer lookups from it. This replaces the "custom endpoint spec" as the default for custom backends (the pull endpoint stays optional).
3. **Shopify history:** launch with the last **60 days**; the brand dashboard says "Order tracking covers orders from the last 60 days". Request `read_all_orders` later.
4. **Photo retention:** **180 days**.
5. **Returns & cancellations:** Olivia **can start** return and cancellation requests (new type `cancellation_request`; `return_refund` already exists). A person at the brand approves and contacts the shopper themselves; Olivia never promises approval.

### 11.1 Brand Order Data API (from decision 2)
- `POST /v1/orders` (upsert) and `POST /v1/orders/{orderNumber}/shipments` — JSON in the standard order shape (§6), auth `Authorization: Bearer <brand order key>` (created in Settings → Customer care). Idempotent on `orderNumber`.
- Or point their system's webhook at `https://api.shoppingmate.ai/v1/orders/webhook/<merchantId>` with an HMAC signature header.
- Stored in a new `orders` table (merchant_id, order_number, customer email/phone hash + last4, status, items, fulfillment, updated_at); lookups verify ownership against it.
