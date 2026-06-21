// PROD proof of Phase-4 live in-session signal (text path). The visitor raises a
// clear PRICE objection at turn 2, then says a NEUTRAL "tell me more" at turn 3.
// If the live signal steered the next turn, the bot proactively addresses the
// price/ROI concern at turn 3 even though turn 3 never mentioned price.
// Usage: node apps/api/scripts/prove-live-signal-prod.mjs
import WebSocket from 'ws';

const API_BASE = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT_ID = process.env.SHOPPINGMATE_DEMO_MERCHANT_ID || 'SM-XPK2EN';
const ORIGIN = process.env.SHOPPINGMATE_DEMO_DOMAIN || 'shoppingmate-web.vercel.app';
const VISITOR = `prove_live_${Date.now()}`;

const TURNS = [
  'What does shoppingmate do for a small store?',
  'Honestly that sounds way too expensive for a small store like mine.', // PRICE objection
  'Tell me more.', // NEUTRAL — bot should proactively handle the price concern if steered
];

const sess = await fetch(`${API_BASE}/v1/session`, {
  method: 'POST', headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` },
  body: JSON.stringify({ merchantId: MERCHANT_ID, domain: ORIGIN }),
}).then((r) => r.json());
console.log('[live-smoke] session =', sess.sessionId);

const ws = new WebSocket(sess.wsUrl);
let turn = 0;
const replies = [[], [], []];
const sendTurn = () => {
  if (turn >= TURNS.length) { ws.send(JSON.stringify({ type: 'session_end', sessionId: sess.sessionId })); return; }
  const text = TURNS[turn++];
  console.log(`\n[live-smoke] ⇒ T${turn}: ${text}`);
  ws.send(JSON.stringify({ type: 'user_text', sessionId: sess.sessionId, text, mode: 'text', visitorId: VISITOR }));
};
await new Promise((resolve) => {
  ws.on('open', sendTurn);
  ws.on('message', (raw) => {
    let ev; try { ev = JSON.parse(raw.toString()); } catch { return; }
    if (ev.type === 'host_action_request') { ws.send(JSON.stringify({ type: 'host_action_result', callId: ev.callId, result: { ok: true } })); return; }
    if (ev.type === 'say' && ev.text) { replies[turn - 1]?.push(ev.text); console.log(`[live-smoke] ⇐ T${turn} say: ${String(ev.text).slice(0, 120)}`); }
    if (ev.type === 'end_of_turn') sendTurn();
    if (ev.type === 'session_closed') { try { ws.close(); } catch {} resolve(); }
  });
  ws.on('error', () => resolve());
  setTimeout(() => { try { ws.close(); } catch {} resolve(); }, 90_000);
});

const t3 = (replies[2] || []).join(' ').toLowerCase();
const addressesPrice = /(price|pricing|cost|expensive|afford|roi|return on investment|payback|value|budget|worth|invest)/.test(t3);
console.log('\n=== PHASE 4 PROOF (text live-signal steering) ===');
console.log('T3 was a NEUTRAL "tell me more" (no price word).');
console.log('T3 bot reply proactively addresses the price/ROI concern:', addressesPrice);
console.log('\nFull T3 reply:\n', (replies[2] || []).join('\n'));
console.log('\nNOTE: after T2 the api logs a "live signal" line with the steer (objection=...);');
console.log('verify with:  railway logs --service api | grep "live signal"');
process.exit(addressesPrice ? 0 : 2);
