import { WebSocket } from 'ws';

const sessionRes = await fetch('https://api-production-1ea1.up.railway.app/v1/session', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://shoppingmate.ai' },
  body: JSON.stringify({ merchantId: 'SM-XPK2EN', domain: 'shoppingmate.ai' }),
});
const { wsUrl, sessionId } = await sessionRes.json();
console.log('session ok:', sessionId);

const ws = new WebSocket(wsUrl);
let got = false;

const timer = setTimeout(() => {
  console.error('timeout waiting for agent reply');
  ws.close();
  process.exit(1);
}, 15000);

ws.on('open', () => {
  console.log('ws open, sending user_text');
  ws.send(JSON.stringify({ type: 'user_text', sessionId, text: 'hello sage', mode: 'text' }));
});
ws.on('message', (data) => {
  got = true;
  const ev = JSON.parse(data.toString());
  console.log('agent ev:', ev.type, ev.text ? `"${ev.text.slice(0, 80)}"` : '');
  if (ev.type === 'end_of_turn') {
    clearTimeout(timer);
    ws.close();
    process.exit(0);
  }
});
ws.on('error', (e) => { console.error('ws error:', e.message); process.exit(1); });
ws.on('close', () => { if (!got) { console.error('closed with no reply'); process.exit(1); } });
