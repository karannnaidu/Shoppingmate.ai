// Headless cold-start timer for the voice flow. Hits the live api, joins the
// LiveKit room as the visitor's widget would, and reports wall-clock ms from
// each milestone to "agent_ready" — the signal that flips the widget tray
// from CONNECTING → listening.
//
// Run: node apps/api/scripts/time-voice-cold-start.mjs
//
// Env (defaulted to prod):
//   API_BASE=https://shoppingmate-web.vercel.app/api
//   MERCHANT_ID=SM-XPK2EN
//   ORIGIN=https://shoppingmate-web.vercel.app

const API_BASE = process.env.API_BASE || 'https://api.shoppingmate.ai';
const MERCHANT_ID = process.env.MERCHANT_ID || 'SM-XPK2EN';
const ORIGIN = process.env.ORIGIN || 'https://shoppingmate.ai';

const { Room, RoomEvent } = await import('@livekit/rtc-node');

const t0 = Date.now();
const mark = (label) => console.log(`+${(Date.now() - t0).toString().padStart(5)} ms  ${label}`);

mark('start');

// 1. session
const sessionRes = await fetch(`${API_BASE}/v1/session`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: ORIGIN, referer: `${ORIGIN}/` },
  body: JSON.stringify({ merchantId: MERCHANT_ID, domain: new URL(ORIGIN).hostname }),
});
const sessionBody = await sessionRes.json();
mark(`POST /v1/session → ${sessionRes.status} sid=${sessionBody.sessionId}`);

// 2. voice token
const tokRes = await fetch(`${API_BASE}/v1/voice/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', origin: ORIGIN, referer: `${ORIGIN}/` },
  body: JSON.stringify({ sessionId: sessionBody.sessionId, merchantId: MERCHANT_ID }),
});
if (!tokRes.ok) {
  console.error('voice token failed', tokRes.status, await tokRes.text());
  process.exit(1);
}
const tok = await tokRes.json();
mark(`POST /v1/voice/token → ${tokRes.status} room=${tok.roomName}`);

// 3. join LiveKit room
const room = new Room();
let agentJoined = null;
let agentReadyAt = null;
let firstAudio = null;
room.on(RoomEvent.ParticipantConnected, (p) => {
  if (p.identity?.startsWith('AG_') || p.identity?.includes('agent')) {
    agentJoined = Date.now();
    mark(`agent participant joined (${p.identity})`);
  }
});
room.on(RoomEvent.DataReceived, (payload) => {
  try {
    const msg = JSON.parse(new TextDecoder().decode(payload));
    if (msg.type === 'agent_ready') {
      agentReadyAt = Date.now();
      mark(`✅ agent_ready received`);
    }
  } catch {}
});
room.on(RoomEvent.TrackSubscribed, (track, _pub, participant) => {
  if (track.kind === 1 && !firstAudio) {
    firstAudio = Date.now();
    mark(`first remote audio track subscribed (${participant.identity})`);
  }
});

await room.connect(tok.wsUrl, tok.token);
mark('room.connect resolved (visitor joined)');

// Wait up to 15s for agent_ready
const deadline = Date.now() + 15000;
while (!agentReadyAt && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 50));
}

if (!agentReadyAt) {
  mark('❌ TIMEOUT — agent_ready never arrived');
} else {
  const connectMs = Date.now() - t0;
  console.log('');
  console.log(`=== summary ===`);
  console.log(`total wall-clock to agent_ready: ${connectMs} ms`);
  console.log(`(that's the time the user sees the tray on CONNECTING…)`);
}

await room.disconnect();
process.exit(0);
