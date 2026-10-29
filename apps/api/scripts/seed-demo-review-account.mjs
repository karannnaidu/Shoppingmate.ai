#!/usr/bin/env node
// Demo login for payment-gateway / app-store reviewers (e.g. Razorpay KYC):
// a separate "Demo Store" with sample data only — no real customer details —
// and a password login (password sign-in is enabled with sign-up disabled, so
// only accounts created here can use it). Idempotent: re-running resets the
// password and tops up the sample data.
//   DBURL=… DEMO_PASSWORD=… node apps/api/scripts/seed-demo-review-account.mjs
import { createRequire } from 'node:module';
import { randomBytes, randomUUID } from 'node:crypto';

const webRequire = createRequire(new URL('../../../web/package.json', import.meta.url));
const { hashPassword } = webRequire('better-auth/crypto');
const postgres = createRequire(new URL('../../../packages/db/package.json', import.meta.url))('postgres');

const EMAIL = process.env.DEMO_EMAIL ?? 'demo@shoppingmate.shop';
const MERCHANT_ID = 'SM-DEMORZ';
const password = process.env.DEMO_PASSWORD ?? `Demo-${randomBytes(4).toString('hex')}-Store`;
const sql = postgres(process.env.DBURL, { ssl: 'require', max: 1 });

try {
  await sql`
    insert into merchants (id, name, domain, allowed_domains, status, adapter_config, plan, business_type)
    values (${MERCHANT_ID}, 'Demo Store (sample data)', 'demo.shoppingmate.shop', ${['demo.shoppingmate.shop']}, 'live', ${sql.json({})}, 'starter', 'beauty')
    on conflict (id) do update set name = excluded.name`;
  // Past onboarding, so reviewers see the full dashboard (Billing still shows
  // plan changes and conversation packs through Razorpay).
  await sql`update merchants set billing_status = 'active', last_widget_ping = now() where id = ${MERCHANT_ID}`;

  let [user] = await sql`select id from users where email = ${EMAIL}`;
  if (!user) {
    [user] = await sql`insert into users (id, email, email_verified, name) values (${randomUUID()}, ${EMAIL}, true, 'Demo Reviewer') returning id`;
  }
  const hash = await hashPassword(password);
  const [acct] = await sql`select id from accounts where user_id = ${user.id} and provider_id = 'credential'`;
  if (acct) await sql`update accounts set password = ${hash}, updated_at = now() where id = ${acct.id}`;
  else await sql`insert into accounts (id, user_id, account_id, provider_id, password) values (${randomUUID()}, ${user.id}, ${user.id}, 'credential', ${hash})`;
  await sql`insert into merchant_owners (user_id, merchant_id, role) values (${user.id}, ${MERCHANT_ID}, 'owner') on conflict do nothing`;

  // Sample data so the dashboard isn't empty (all invented; marked as sample).
  const [{ n }] = await sql`select count(*)::int as n from metric_events where merchant_id = ${MERCHANT_ID} and metric_name = 'conversationCompleted'`;
  if (n === 0) {
    const convs = [
      { mode: 'text', outcome: 'converted', cart_adds: 1, checkout_reached: true, turns: 6, duration_sec: 140, attributed_cents: 2400,
        transcript: [
          { role: 'agent', content: 'Hi! I can help you find the right product. What are you looking for?' },
          { role: 'user', content: 'A gentle moisturiser for dry skin.' },
          { role: 'agent', content: 'Our Hydra Daily Cream suits dry skin — fragrance-free and light. Want me to add it to your cart?' },
          { role: 'user', content: 'Yes please, and take me to checkout.' },
          { role: 'agent', content: 'Added. Taking you to checkout now.' },
        ] },
      { mode: 'voice', outcome: 'abandoned', cart_adds: 0, checkout_reached: false, turns: 4, duration_sec: 75, attributed_cents: 0,
        transcript: [
          { role: 'agent', content: 'Hi, how can I help you today?' },
          { role: 'user', content: 'Do you ship to Mumbai and how long does it take?' },
          { role: 'agent', content: 'Yes, we deliver across India — usually 3 to 5 days to Mumbai.' },
        ] },
      { mode: 'text', outcome: 'abandoned', cart_adds: 0, checkout_reached: false, turns: 5, duration_sec: 95, attributed_cents: 0,
        transcript: [
          { role: 'user', content: 'My order arrived with a broken lid.' },
          { role: 'agent', content: "I'm sorry about that. Could you share your order number and a photo? I'll raise it for the team." },
          { role: 'user', content: 'Order 10234, photo attached.' },
          { role: 'agent', content: "Thanks — it's logged as request #1 and the team will reach you by email." },
        ] },
    ];
    for (const [i, c] of convs.entries()) {
      await sql`insert into metric_events (merchant_id, metric_name, tags, ts)
        values (${MERCHANT_ID}, 'conversationCompleted', ${sql.json({ ...c, session_id: `ws_demo${i}${randomBytes(3).toString('hex')}`, intent: { intent: 'browsing' } })}, now() - ${`${(i + 1) * 5} hours`}::interval)`;
    }
  }
  const [{ c }] = await sql`select count(*)::int as c from support_cases where merchant_id = ${MERCHANT_ID}`;
  if (c === 0) {
    await sql`insert into support_cases (merchant_id, type, summary, details, contact_name, contact_email, consent, urgency, sentiment, order_id)
      values (${MERCHANT_ID}, 'complaint', 'Order 10234 arrived with a broken lid — wants a replacement (sample)', ${sql.json({ product: 'Hydra Daily Cream', desired_resolution: 'Replacement' })}, 'Sample Customer', 'customer@example.com', true, 'high', 'negative', '10234'),
             (${MERCHANT_ID}, 'feedback', 'Loved the fast delivery and packaging (sample)', ${sql.json({})}, null, null, false, 'normal', 'positive', null)`;
  }

  console.log(JSON.stringify({ login: 'https://www.shoppingmate.shop/login', email: EMAIL, password, merchant: MERCHANT_ID }));
} finally {
  await sql.end();
}
