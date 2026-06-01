import { WebSocket } from 'ws';

const API = 'https://api-production-1ea1.up.railway.app';
const MERCHANT = 'SM-2SCCLZ';
const DOMAIN = 'calmosis.com';

console.log(`[smoke] bootstrap merchant=${MERCHANT} domain=${DOMAIN}`);
const sessionRes = await fetch(`${API}/v1/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: `https://${DOMAIN}` },
  body: JSON.stringify({ merchantId: MERCHANT, domain: DOMAIN }),
});
if (!sessionRes.ok) {
  console.error('[smoke] bootstrap failed', sessionRes.status, await sessionRes.text());
  process.exit(1);
}
const boot = await sessionRes.json();
console.log('[smoke] session ok', { sessionId: boot.sessionId, personaId: boot.personaId, wsUrl: boot.wsUrl });

const ws = new WebSocket(boot.wsUrl);
let gotAny = false;
let endedTurn = false;

const timer = setTimeout(() => {
  console.error(`[smoke] TIMEOUT after 20s — gotAny=${gotAny} endedTurn=${endedTurn}`);
  ws.close();
  process.exit(2);
}, 20000);

ws.on('open', () => {
  console.log('[smoke] ws open, sending user_text');
  ws.send(JSON.stringify({
    type: 'user_text',
    sessionId: boot.sessionId,
    text: 'what does calmosis sell?',
    mode: 'text',
  }));
});

ws.on('message', (data) => {
  gotAny = true;
  let ev;
  try { ev = JSON.parse(data.toString()); } catch { console.log('[smoke] non-json msg:', data.toString().slice(0, 120)); return; }
  const preview = ev.text ? ` "${ev.text.slice(0, 100)}"` : '';
  console.log('[smoke] agent ev:', ev.type + preview);
  if (ev.type === 'end_of_turn') {
    endedTurn = true;
    clearTimeout(timer);
    setTimeout(() => { ws.close(); process.exit(0); }, 250);
  }
});

ws.on('error', (err) => {
  console.error('[smoke] ws error:', err.message);
});

ws.on('close', (code, reason) => {
  console.log(`[smoke] ws closed code=${code} reason="${reason}"`);
});
