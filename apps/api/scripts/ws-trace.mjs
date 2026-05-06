import { WebSocket } from 'ws';
const sessionRes = await fetch('https://api-production-1ea1.up.railway.app/v1/session', {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: 'https://shoppingmate.ai' },
  body: JSON.stringify({ merchantId: 'SM-XPK2EN', domain: 'shoppingmate.ai' }),
});
const j = await sessionRes.json();
console.log('wsUrl:', j.wsUrl);
const ws = new WebSocket(j.wsUrl);
ws.on('open', () => console.log('OPEN'));
ws.on('error', (e) => console.error('ERR', e.message, e.code, e.statusCode));
ws.on('unexpected-response', (req, res) => {
  console.error('unexpected-response status:', res.statusCode);
  res.on('data', (d) => console.error('body:', d.toString()));
});
setTimeout(() => process.exit(0), 8000);
