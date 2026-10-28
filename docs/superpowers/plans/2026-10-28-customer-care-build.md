# Build plan — Customer Care (PRD 2026-10-28)

Flags: `CASE_CAPTURE` (existing, per merchant) + new `CARE_ORDERS` (per merchant) for live order lookup.

## Phase 1 — Care basics
- [ ] DB: support_cases.order_id/order_snapshot; types feedback + cancellation_request; tables case_attachments, case_events, orders; merchants.support_email, care_settings, order_api_key_hash, shiprocket_enc
- [ ] Agent: case types + validation (return/cancel need order number; feedback needs no contact); prompt rules (never promise approval)
- [ ] API: POST /v1/care/upload (widget session) — image only, ≤10MB, ≤3/case; R2 private; auto-link to session's case
- [ ] Widget: attach button (chat composer + call panel), client resize/re-encode (strips EXIF), thumbnail chip, tells the bot
- [ ] Email: shopper confirmation (sender "<Brand> Care", reply-to support email); brand email with photo links; "photos added" update
- [ ] Dashboard: In progress, photos, order info, Reply to customer (emails shopper), Settings → Customer care (support email, Order API key, Shiprocket, 60-day note)
- [ ] Worker: 180-day photo retention purge
- [ ] Verify (real Chrome on calmosis.com + dashboard): complaint w/ photo (text + voice), feedback, cancellation request, emails sent, dashboard reply

## Phase 2 — Shopify live status
- [ ] order.lookup tool + ownership check (number + email/phone last4; 3 tries) + order card in widget
- [ ] Shopify adapter (Admin GraphQL, 60 days) on dev store SM-FE3HKR; pre-fill order into complaints
- [ ] Verify with a real dev-store order

## Phase 3 — Shiprocket + Calmosis + proactive
- [ ] Shiprocket adapter (token login, order/awb tracking); Calmosis wired via its Shiprocket account
- [ ] Shipment-status webhooks → shopper emails
- [ ] Verify against a real Calmosis/Shiprocket order

## Phase 4 — Order Data API + WooCommerce
- [ ] POST /v1/orders, /v1/orders/:n/shipments, /v1/orders/webhook/:merchantId (HMAC); API key in Settings
- [ ] WooCommerce one-click (wc-auth) + REST lookup
- [ ] Verify push → lookup end to end; Woo against a mocked store (no test store available)
