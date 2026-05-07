// Voice-path smoke: create session, fetch voice token, join LiveKit room as
// visitor, wait for the voice-agent to join (proves it can complete its
// regions handshake + WebRTC join), then disconnect.
import { Room, RoomEvent } from '../../../node_modules/.pnpm/@livekit+rtc-node@0.13.27/node_modules/@livekit/rtc-node/dist/index.js';

const API = 'https://api-production-1ea1.up.railway.app';
const ORIGIN = 'https://shoppingmate.ai';

const sessRes = await fetch(`${API}/v1/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: ORIGIN },
  body: JSON.stringify({ merchantId: 'SM-XPK2EN', domain: 'shoppingmate.ai' }),
});
const sess = await sessRes.json();
console.log('session ok:', sess.sessionId);

const tokRes = await fetch(`${API}/v1/voice/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: ORIGIN },
  body: JSON.stringify({ merchantId: 'SM-XPK2EN', sessionId: sess.sessionId }),
});
const tok = await tokRes.json();
console.log('voice-token ok:', tok.roomName, tok.personaId);

const room = new Room();
room.on(RoomEvent.ParticipantConnected, (p) => {
  console.log('participant joined:', p.identity);
  if (p.identity?.startsWith('agent')) {
    console.log('AGENT_JOINED');
    setTimeout(async () => {
      await room.disconnect();
      process.exit(0);
    }, 3000);
  }
});
room.on(RoomEvent.Disconnected, (reason) => {
  console.log('room disconnected, reason:', reason);
});

console.log('connecting to', tok.wsUrl, 'as visitor...');
try {
  await room.connect(tok.wsUrl, tok.token, { autoSubscribe: true });
  console.log('VISITOR_CONNECTED room=', room.name);
} catch (err) {
  console.error('VISITOR_CONNECT_FAILED', err.message);
  process.exit(1);
}

setTimeout(() => {
  console.error('timeout waiting for voice-agent to join');
  room.disconnect().then(() => process.exit(2));
}, 30000);
