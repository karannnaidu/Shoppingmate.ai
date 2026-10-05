#!/usr/bin/env node
// Multi-turn conversation over the plain agent WebSocket (no browser, no voice
// agent). Prints replies + tool results per turn. Host actions are acked ok.
//   node apps/api/scripts/nav-ws-convo.mjs "turn 1" "turn 2" ...
import { createRequire } from 'node:module';

const require = createRequire(new URL('../package.json', import.meta.url));
const WebSocket = require('ws');
const API = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT = process.env.BENCH_MERCHANT_ID || 'SM-2SCCLZ';
const ORIGIN = process.env.BENCH_ORIGIN || 'calmosis.com';

const sess = await fetch(`${API}/v1/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` },
  body: JSON.stringify({ merchantId: MERCHANT, domain: ORIGIN }),
}).then((r) => r.json());
const ws = new WebSocket(sess.wsUrl);
await new Promise((r) => ws.once('open', r));
console.log('session', sess.sessionId);
for (const text of process.argv.slice(2)) {
  console.log(`\n> ${text}`);
  await new Promise((resolve) => {
    const t = setTimeout(resolve, 60_000);
    const on = (raw) => {
      const ev = JSON.parse(String(raw));
      if (ev.type === 'host_action_request') {
        ws.send(JSON.stringify({ type: 'host_action_result', callId: ev.callId, result: { ok: true } }));
      } else if (ev.type === 'say') console.log(`  bot: ${ev.text}`);
      else if (ev.type === 'tool_result') console.log(`  [tool] ${ev.toolName} ok=${ev.ok}`);
      else if (ev.type === 'end_of_turn') {
        clearTimeout(t);
        ws.off('message', on);
        resolve();
      }
    };
    ws.on('message', on);
    ws.send(JSON.stringify({ type: 'user_text', sessionId: sess.sessionId, text, mode: 'text' }));
  });
}
ws.close();
