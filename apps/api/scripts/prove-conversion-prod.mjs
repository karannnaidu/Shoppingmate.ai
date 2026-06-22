// PROD proof of the conversion → attribution → ledger chain. Simulates EXACTLY
// what the Calmosis backend will POST on a placed COD order: an HMAC-signed body
// to /v1/conversion for a real recorded visitor. Verifies the endpoint accepts
// it, attributes it (assisted/influenced) by matching the visitor's conversation,
// and writes a conversion_events row the Audit ledger reads.
// Usage: SECRET=<scriptSecret> PUB=<db url> node apps/api/scripts/prove-conversion-prod.mjs
import { createHmac } from 'node:crypto';
import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const API = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT = 'SM-2SCCLZ';
const VISITOR = process.env.PROVE_VISITOR || 'v_fc899895a0671004'; // recorded Karan visitor
const orderId = `smtest_${Date.now()}`;

const body = JSON.stringify({
  merchantId: MERCHANT,
  orderId,
  visitorId: VISITOR,
  totalCents: 510000,
  currency: 'INR',
  lineItems: [{ sku: 'green-mantra', quantity: 1, priceCents: 510000 }],
  matchSource: 'cod',
  occurredAt: Date.now(),
});
const sig = createHmac('sha256', process.env.SECRET).update(body).digest('base64');

console.log('=== POST /v1/conversion (HMAC-signed, as the Calmosis backend will) ===');
const res = await fetch(`${API}/v1/conversion`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'X-SM-Signature': sig },
  body,
});
const json = await res.json().catch(() => ({}));
console.log('HTTP', res.status, JSON.stringify(json));

const sql = postgres(process.env.PUB, { max: 1 });
await new Promise((r) => setTimeout(r, 1500));
console.log('\n=== conversion_events row(s) for this order ===');
const rows = await sql`select attribution_kind, total_cents, order_id, visitor_id from conversion_events where merchant_id=${MERCHANT} and order_id=${orderId}`;
for (const x of rows) console.log(` ${x.attribution_kind} | ₹${Math.round(x.total_cents/100)} | order ${x.order_id} | visitor ${x.visitor_id}`);
console.log('\n=== visitor had conversation sessions (basis for attribution)? ===');
const cs = await sql`select count(*) n, max(started_at) latest from conversation_sessions where merchant_id=${MERCHANT} and visitor_id=${VISITOR}`;
console.log(` sessions for ${VISITOR}: ${cs[0].n}, latest ${cs[0].latest?.toISOString?.()??cs[0].latest}`);
console.log('\n=== total conversion_events for Calmosis now ===', (await sql`select count(*) n from conversion_events where merchant_id=${MERCHANT}`)[0].n);
await sql.end();

console.log('\n=== PROOF ===');
console.log('endpoint accepted (ok)        :', res.status === 200 && json.ok === true);
console.log('attributed + wrote a row      :', rows.length > 0, rows.length ? `(${rows.map(r=>r.attribution_kind).join(', ')})` : `(wrote=${JSON.stringify(json.wrote)} miss=${json.missReason})`);
process.exit(res.status === 200 ? 0 : 1);
