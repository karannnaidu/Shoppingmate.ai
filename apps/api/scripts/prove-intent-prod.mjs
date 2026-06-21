// PROD proof of the DEPLOYED Phase-1 wiring: drive a real multi-turn TEXT
// conversation through the live api WS, send session_end, then read back the
// conversationCompleted row the deployed code emitted and show tags.intent.
// Uses the DEMO merchant (not the live Calmosis customer) so no real dashboard
// is polluted.
//
// Usage: PUB=<DATABASE_PUBLIC_URL> node apps/api/scripts/prove-intent-prod.mjs
import WebSocket from 'ws';
import postgres from '../../../node_modules/.pnpm/postgres@3.4.9/node_modules/postgres/src/index.js';

const API_BASE = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT_ID = process.env.SHOPPINGMATE_DEMO_MERCHANT_ID || 'SM-XPK2EN';
const ORIGIN = process.env.SHOPPINGMATE_DEMO_DOMAIN || 'shoppingmate-web.vercel.app';

// A shopper with clear, extractable intent: sleep need + price objection + identity.
const TURNS = [
  'Hi, I keep waking up at 3am and cannot fall back asleep. Do you have something natural for sleep?',
  'Sounds good but it feels a little pricey for me honestly.',
  'Ok. My name is Karan and I am in Mumbai. Let me think about it and come back later.',
];

const sess = await fetch(`${API_BASE}/v1/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` },
  body: JSON.stringify({ merchantId: MERCHANT_ID, domain: ORIGIN }),
}).then((r) => r.json());
console.log(`[prod-smoke] session = ${sess.sessionId}`);

const ws = new WebSocket(sess.wsUrl);
let turn = 0;
const sendTurn = () => {
  if (turn >= TURNS.length) {
    console.log('[prod-smoke] all turns done → session_end');
    ws.send(JSON.stringify({ type: 'session_end', sessionId: sess.sessionId }));
    return;
  }
  const text = TURNS[turn++];
  console.log(`[prod-smoke] ⇒ user_text [${turn}]: ${text}`);
  ws.send(JSON.stringify({ type: 'user_text', sessionId: sess.sessionId, text, mode: 'text' }));
};

await new Promise((resolve) => {
  ws.on('open', () => { console.log('[prod-smoke] ws open'); sendTurn(); });
  ws.on('message', (raw) => {
    let ev;
    try { ev = JSON.parse(raw.toString()); } catch { return; }
    if (ev.type === 'host_action_request') {
      ws.send(JSON.stringify({ type: 'host_action_result', callId: ev.callId, result: { ok: true } }));
      return;
    }
    if (ev.type === 'say') console.log(`[prod-smoke] ⇐ say: ${String(ev.text).slice(0, 90)}`);
    if (ev.type === 'end_of_turn') sendTurn();
    if (ev.type === 'session_closed') { console.log(`[prod-smoke] session_closed: ${ev.reason}`); try { ws.close(); } catch {} resolve(); }
  });
  ws.on('error', (e) => { console.error('[prod-smoke] ws error', e.message); resolve(); });
  setTimeout(() => { console.log('[prod-smoke] timeout'); try { ws.close(); } catch {} resolve(); }, 60_000);
});

// The profiler runs fire-and-forget after session_end (an LLM call) — poll the
// prod DB until the conversationCompleted row for this session appears with intent.
const sql = postgres(process.env.PUB, { max: 1 });
let found = null;
for (let i = 0; i < 12 && !found; i++) {
  await new Promise((r) => setTimeout(r, 2500));
  const rows = await sql`
    select tags from metric_events
    where merchant_id = ${MERCHANT_ID} and metric_name = 'conversationCompleted'
      and tags->>'session_id' = ${sess.sessionId}
    order by ts desc limit 1`;
  if (rows[0]) found = rows[0].tags;
  console.log(`[prod-smoke] poll ${i + 1}/12 — ${found ? 'FOUND' : 'waiting for conversationCompleted...'}`);
}
await sql.end();

console.log('\n=== PROD PROOF RESULT ===');
if (!found) {
  console.log('NO conversationCompleted row found for this session yet.');
  process.exit(1);
}
console.log('session_id      :', found.session_id);
console.log('mode / turns    :', found.mode, '/', found.turns);
console.log('outcome         :', found.outcome);
console.log('tags.intent     :', JSON.stringify(found.intent, null, 2));
console.log('\nintent present  :', !!found.intent, '| intent =', found.intent?.intent, '| needs =', (found.intent?.needs || []).join(', '));
process.exit(found.intent ? 0 : 1);
