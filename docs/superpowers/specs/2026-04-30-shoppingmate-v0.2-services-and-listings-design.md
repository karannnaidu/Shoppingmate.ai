# shoppingmate.ai v0.2 — Services & Listings Verticals (Parked Design)

**Date:** 2026-04-30 (last revised 2026-05-01)
**Owner:** Karan (Calmosis)
**Status:** Parked — sketch only, not in v0.1 scope. Implementation begins after v0.1 acceptance criteria pass.
**Roadmap:** Referenced from `docs/superpowers/roadmap.md` § 8

> **2026-05-01 revisions:** voice-stack mention in §3 updated to LiveKit + Gemini Live (ADR-0001). v0.2 inherits the consumption-based pricing model + margin-floor invariant from strategy §5 — services/bookings and listings will use the same per-conversation metering with per-vertical caps (revisit caps once a v0.2 design partner is signed). Wave 3 geographies (India / Brazil / Mexico / SEA) are month 13+ even for v0.2 — US / UK / CA / AU first.

---

## 0. Why this is its own spec

v0.1 ships a products-and-cart vertical (Shopify, Woo, Magento, BigCommerce, Wix, Squarespace, custom DOM). Services and listings have a fundamentally different conversation flow, a different platform ecosystem, and a different definition of "conversion." They reuse shoppingmate.ai's runtime architecture (gtag → orchestrator → adapter dispatcher → voice stack → self-healing) but introduce **new vertical adapter families** and a **new tool surface**.

This file exists so the v0.2 design isn't re-litigated as an "open question" during v0.1 implementation, and so that v0.1 architecture decisions stay compatible with these v0.2 verticals.

---

## 1. Verticals in scope

### 1.1 Services & Bookings
Salons, spas, fitness studios, clinics, tutors, consultants, hospitality. The visitor's intent is to **book a time slot with a person/resource**, optionally with options (60-min vs 90-min, choice of stylist, choice of treatment).

### 1.2 Listings
Apartments, real estate, vehicle rentals, equipment rentals, events. The visitor's intent is to **discover a specific listing** and either schedule a visit, submit an inquiry, or place a hold/application.

---

## 2. What changes vs v0.1

| Layer | v0.1 (commerce) | v0.2 (services + listings) |
|---|---|---|
| **Tool surface** | `product.*`, `cart.*`, `coupons.*`, `checkout.handoff` | + `booking.*`, `listing.*`, `inquiry.*`; `cart.*` & `coupons.*` not used in services/listings flows |
| **Domain entity** | `products` | + `services` (offerings + duration + price) , `listings` (units + attributes + location) |
| **Inventory model** | SKU + variants + stock count | Time slots + resource availability (services); listing availability + visit slots (listings) |
| **Conversion event** | `order_id + total_cents` | `booking_id + appointment_at + deposit_cents` (services); `inquiry_id` or `visit_id + scheduled_at` (listings) |
| **Adapter families** | ShopifyAdapter, WooAdapter, etc. | + BookingAdapter family, ListingAdapter family |
| **Persona library** | 8 commerce personas | + 4 services personas (`receptionist`, `wellness-host`, `clinical-aide`, `concierge-luxury`) + 2 listings personas (`property-host`, `agent-pro`) |
| **Conversation patterns** | Greet → recommend → cart → checkout | Greet → qualify (intent) → discover (slots/listings) → confirm (slot or visit) → handoff |
| **Time handling** | Not needed | Time zones, business hours, holiday calendars, slot durations |
| **Payment handoff** | Always full payment redirect | Often deposit-only or no payment (just confirmation), then balance at venue |

---

## 3. What stays the same (reused from v0.1)

- gtag bundle (Shadow DOM widget, voice + text, action executor, self-healing snapshot)
- Backend orchestrator (uWebSockets.js, WebSocket session model, LLM tool-call loop)
- Adapter dispatcher pattern + common `Adapter` interface (extended with new methods, see §6)
- Onboarding worker (platform fingerprint, Playwright crawl, Sonnet 4.6 selector extraction, BullMQ)
- DOMAdapter for custom sites + SuggestAdapter fallback
- Runtime selector resolver (Haiku 4.5)
- selector_cache table + override-permanence rule (`source='merchant_override'` immune to auto-heal)
- Voice stack (LiveKit Agents WebRTC + Gemini 2.5 Flash Live native audio + persona voice-descriptor prompts — see [ADR-0001](../../adr/2026-05-01-voice-stack-livekit-gemini-live.md))
- Brand KB chunks (`brand_kb_chunks` table + `kb.lookup` tool)
- Postgres / Redis / S3 storage tiers
- Conversion attribution pattern (gtag detects post-action page → POST /v1/conversion)
- Privacy guardrails (no payment fields, no password fields, conversation TTL)
- Cost ledger writes (Phase 3 invoicing reuses the same ledger)

The v0.2 work is **additive**, not a rewrite.

---

## 4. New tool surface

### 4.1 Services (Bookings)

| Tool | Purpose | Adapter call |
|---|---|---|
| `service.search` | Find services matching free-text ("60-min Swedish massage") | adapter.searchServices |
| `service.get` | Full service details + duration + base price | adapter.getService |
| `booking.search_slots` | Available time slots for a service, with optional resource (stylist/professional) filter | adapter.searchSlots |
| `booking.hold_slot` | Soft-hold a slot for N minutes during the conversation | adapter.holdSlot |
| `booking.confirm` | Confirm the held slot → returns booking_id + payment URL (if deposit required) | adapter.confirmBooking |
| `booking.cancel` | Release a held slot | adapter.cancelBooking |
| `resource.list` | List bookable resources (stylists, therapists, doctors, courts) | adapter.listResources |

### 4.2 Listings (Real Estate / Rentals)

| Tool | Purpose | Adapter call |
|---|---|---|
| `listing.search` | Find listings matching filters (location, price range, BHK, dates) | adapter.searchListings |
| `listing.get` | Full listing details + photos + attributes | adapter.getListing |
| `listing.schedule_visit` | Book an in-person viewing slot | adapter.scheduleVisit |
| `inquiry.submit` | Submit interest / application / contact request | adapter.submitInquiry |
| `inquiry.qualify` | LLM-side qualification before submission (asks about budget, move-in date, employment, etc.) | local |

---

## 5. Adapter families

### 5.1 Services / Bookings adapters

| Adapter | Platform |
|---|---|
| `MindBodyAdapter` | MindBody Online (large salons, fitness, wellness) |
| `VagaroAdapter` | Vagaro (salons, spas, beauty) |
| `BooksyAdapter` | Booksy (barbers, beauty, wellness) |
| `CalendlyAdapter` | Calendly (consultants, professional services) |
| `AcuityAdapter` | Acuity Scheduling (broad small-business) |
| `SquareAppointmentsAdapter` | Square Appointments |
| `Set​MoreAdapter` | Setmore |
| `WordPressBookingsAdapter` | WooCommerce Bookings, Amelia, BookingPress |
| `BookingDOMAdapter` | Custom booking sites — DOM-driven, same self-heal pattern as v0.1 DOMAdapter |
| `BookingSuggestAdapter` | Fallback ("tap Book Now on the page") |

India-specific (priority for Calmosis-adjacent merchants): `UrbanCompanyPartnerAdapter` (if they expose a partner API), custom-DOM for everything else.

### 5.2 Listings adapters

| Adapter | Platform |
|---|---|
| `MagicbricksAdapter` | Magicbricks (India) |
| `99AcresAdapter` | 99acres (India) |
| `HousingAdapter` | Housing.com (India) |
| `NoBrokerAdapter` | NoBroker.in (where API exposed) |
| `ZillowAdapter` | Zillow (US, where partner API exists; else DOM) |
| `RealtorAdapter` | Realtor.com |
| `AirbnbHostAdapter` | Airbnb (host-side; API or DOM) |
| `ListingDOMAdapter` | Custom property sites — DOM-driven |
| `ListingSuggestAdapter` | Fallback |

---

## 6. Adapter interface extension

```ts
// v0.1 base interface (commerce-only)
interface CommerceAdapter {
  searchProducts(merchant, query): Promise<Product[]>;
  getProduct(merchant, sku): Promise<Product>;
  cartAdd(merchant, session, sku, variant, qty): Promise<CartState>;
  cartUpdate(merchant, session, lineId, qty): Promise<CartState>;
  cartGet(merchant, session): Promise<CartState>;
  couponApply(merchant, session, code): Promise<CartState>;
  checkoutUrl(merchant, session): Promise<string>;
}

// v0.2 additions
interface BookingAdapter {
  searchServices(merchant, query): Promise<Service[]>;
  getService(merchant, serviceId): Promise<Service>;
  listResources(merchant, serviceId?): Promise<Resource[]>;
  searchSlots(merchant, serviceId, opts: { resourceId?, fromDate, toDate, durationMin? }): Promise<Slot[]>;
  holdSlot(merchant, session, slotId): Promise<{ holdId, expiresAt }>;
  confirmBooking(merchant, session, holdId, visitorInfo): Promise<{ bookingId, paymentUrl?, confirmAt }>;
  cancelBooking(merchant, session, holdOrBookingId): Promise<void>;
}

interface ListingAdapter {
  searchListings(merchant, filters: ListingFilters): Promise<Listing[]>;
  getListing(merchant, listingId): Promise<Listing>;
  scheduleVisit(merchant, session, listingId, slot): Promise<{ visitId, confirmAt }>;
  submitInquiry(merchant, session, listingId, payload): Promise<{ inquiryId }>;
}
```

A single merchant may implement one or more interfaces. The dispatcher decides which tool group to expose to the LLM based on `merchants.vertical` (`commerce` | `services` | `listings` | `mixed`).

---

## 7. Schema additions

```sql
-- Add to merchants
ALTER TABLE merchants ADD COLUMN vertical text NOT NULL DEFAULT 'commerce';
  -- 'commerce' | 'services' | 'listings' | 'mixed'
ALTER TABLE merchants ADD COLUMN timezone text;            -- IANA tz, required for services
ALTER TABLE merchants ADD COLUMN business_hours jsonb;     -- per-day open/close, holidays
ALTER TABLE merchants ADD COLUMN booking_buffer_min integer DEFAULT 0;

-- New tables
services (
  merchant_id  text REFERENCES merchants(id),
  service_id   text NOT NULL,
  name         text NOT NULL,
  description  text,
  duration_min integer NOT NULL,
  price_cents  integer,
  currency     text,
  resource_required boolean DEFAULT false,
  options      jsonb,                  -- e.g. { length: ['60min','90min'], style:[...] }
  PRIMARY KEY (merchant_id, service_id)
);

resources (
  merchant_id text REFERENCES merchants(id),
  resource_id text NOT NULL,
  name        text NOT NULL,
  bio         text,
  photo_url   text,
  service_ids text[],                  -- which services this resource can deliver
  PRIMARY KEY (merchant_id, resource_id)
);

bookings (
  id              bigserial PRIMARY KEY,
  merchant_id     text REFERENCES merchants(id),
  session_id      text NOT NULL,
  service_id      text NOT NULL,
  resource_id     text,
  start_at        timestamptz NOT NULL,
  end_at          timestamptz NOT NULL,
  status          text NOT NULL,        -- 'held' | 'confirmed' | 'cancelled'
  hold_expires_at timestamptz,
  visitor_name    text,
  visitor_email   text,
  visitor_phone   text,
  deposit_cents   integer,
  payment_url     text,
  external_ref    text,                 -- platform's own booking ID
  created_at      timestamptz NOT NULL
);

listings (
  merchant_id text REFERENCES merchants(id),
  listing_id  text NOT NULL,
  title       text NOT NULL,
  description text,
  attributes  jsonb,                    -- bhk, sqft, price, location, amenities, photos, ...
  available_from date,
  available_to   date,
  PRIMARY KEY (merchant_id, listing_id)
);

inquiries (
  id            bigserial PRIMARY KEY,
  merchant_id   text REFERENCES merchants(id),
  session_id    text NOT NULL,
  listing_id    text,                   -- optional; null for general inquiries
  type          text NOT NULL,          -- 'visit_request' | 'callback' | 'application'
  payload       jsonb,                  -- visitor info, qualifying answers, message
  external_ref  text,
  created_at    timestamptz NOT NULL
);
```

`conversion_events` extends to recognize new event types: `booking_confirmed`, `visit_scheduled`, `inquiry_submitted`.

---

## 8. Conversation patterns (system prompt augments per vertical)

Each vertical gets a pattern library appended to the persona prompt at session start:

### 8.1 Services pattern

```
Goal: book the visitor a time slot with the right resource.

Required slots before booking.confirm:
  - service_id (what they want)
  - date or date_range
  - time-of-day preference (morning / afternoon / evening / specific)
  - resource preference (if applicable)
  - visitor name + phone or email

Discovery flow:
  1. Acknowledge intent + ask 1 clarifying question (e.g. "haircut or color?")
  2. Use service.search → render top 3 as ui.show_card
  3. Once service chosen, use booking.search_slots → render slot grid
  4. Use booking.hold_slot the moment visitor picks one (10-min hold)
  5. Collect contact info, then booking.confirm
  6. If deposit_cents > 0, checkout.handoff to paymentUrl
  7. Confirm booking + send to merchant's lead webhook
```

### 8.2 Listings pattern

```
Goal: get the visitor to a high-quality lead state — either visit scheduled or inquiry submitted.

Discovery flow:
  1. Use listing.search with filters from natural-language query
  2. Render top 3 as ui.show_card with photos + key attributes
  3. If visitor likes one, offer two paths:
       (a) listing.schedule_visit → pick a time slot
       (b) inquiry.submit → "want me to have the agent call you?"
  4. Run inquiry.qualify before submission (budget, timeline, employment, etc.) to
     filter low-quality leads — store qualification in inquiry.payload
  5. lead.capture to merchant's webhook with full session transcript link
```

---

## 9. Acceptance criteria (for v0.2)

v0.2 is done when **all** of the following pass:

1. **Salon happy path:** A Vagaro or MindBody salon installs gtag. Within 8 min, status='live'. Visitor says "I want a balayage with Priya next Saturday afternoon." Widget books the slot via the platform API, takes deposit if required, sends confirmation. Booking lands in salon's existing calendar.
2. **Custom booking site happy path:** Same on a hand-built booking site with no recognized platform. BookingDOMAdapter handles the slot grid via DOM control + selector self-heal.
3. **Apartment listing happy path:** A Magicbricks-style listing site visitor says "2BHK in Indiranagar under 50k." Widget filters listings, presents top 3, qualifies the visitor (budget, move-in date, profession), schedules a visit OR submits inquiry. Lead lands in merchant's CRM webhook.
4. **Mixed-vertical merchant:** A wellness merchant selling both products (skincare) and services (consultations). Widget detects intent per turn and routes to the right tool group.
5. **Time-zone correctness:** Booking made by a visitor in IST against a US-based salon resolves to the salon's local time on the calendar.
6. **All v0.1 happy paths still pass.** No regressions to commerce vertical.

---

## 10. Implementation phasing within v0.2

Same shape as v0.1's three-phase split:

- **v0.2-Phase 1:** Services runtime end-to-end. Calendly + Vagaro + custom DOM. Single persona per merchant.
- **v0.2-Phase 2:** Listings runtime. Magicbricks + 99acres + custom DOM. Inquiry qualification flow.
- **v0.2-Phase 3:** Mixed-vertical merchants, full platform breadth (MindBody, Booksy, Acuity, Square Appointments, Setmore, WordPress Bookings; Housing, NoBroker, Zillow, Realtor, Airbnb-host).

---

## 11. Don't-drift guardrails (for v0.2 design)

These are explicit non-goals even within v0.2:

- ❌ Building a calendar UI from scratch — always use the merchant platform's slot data
- ❌ Holding payment money ourselves — deposits always go to merchant via their existing payment processor
- ❌ Handling appointment changes/cancellations after the conversation ends (out-of-session changes go through the merchant's existing tools)
- ❌ Cross-merchant booking (no marketplace mode)
- ❌ Multi-resource booking (couples massage with two therapists at once) — parked v0.3
- ❌ Recurring bookings ("every Tuesday for 6 weeks") — parked v0.3
- ❌ Real-estate transaction execution — listings is lead-gen only

---

## 12. Open questions (to resolve before v0.2 starts)

- **Time-slot caching strategy:** salon slots change minute-by-minute as other channels book. Hard cache with short TTL, or always live-fetch?
- **Deposit handling on platforms that don't expose it:** for Calendly/Acuity which take payment themselves, do we let them redirect or do we do our own?
- **Apartment lead scoring:** do we share qualification heuristics across merchants, or per-merchant only? (v0.1 has zero cross-merchant data sharing — does that hold for lead scoring?)
- **Identity reuse:** if a returning visitor on a salon site has booked before, do we recognize them across sessions? (v0.1 says no persistent visitor profiles beyond 24h — does that hold for services?)

These are deliberately left open. They get resolved during v0.2 brainstorming, not now.
