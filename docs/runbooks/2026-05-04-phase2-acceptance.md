# Phase 2 — Brand Dashboard Acceptance Checklist

Run through each item against a live dev environment with Stripe test mode + Composio sandbox + Resend test domain. Tick when verified.

- [ ] /signup — enter email, click magic link, land on /app/onboarding
- [ ] Step 2 — Stripe Checkout for Starter $30 in test mode → real merchant_id provisioned
- [ ] Step 3 — Connect Shopify dev store via Composio OAuth → catalog sync visible in real time
- [ ] Step 4 — Copy script tag, paste into a test page, click "I've pasted it" → green check
- [ ] /app — 4 KPI tiles render (zero values), "No conversations yet" empty state
- [ ] /app/knowledge — upload 2-page returns-policy.pdf → status flips to ready
- [ ] /app/settings — set persona (Warm Brit / brand notes / neutral) and lead webhook → save
- [ ] Trigger synthetic agent session against widget → KPI tile increments → conversation visible in /app/conversations → click into transcript
- [ ] Sign out, sign back in via magic link → land back on /app with state intact
- [ ] /app/billing — click "Manage billing" → Stripe Customer Portal opens
- [ ] Force payment_failed via Stripe CLI → red banner appears at top → "Update payment" link → Stripe Portal

Notes / blockers:
-
