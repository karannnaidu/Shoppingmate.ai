// Headless cold-start timer for the two-phase voice flow.
//
// Simulates the real user journey:
//   t0 = page-load → POST /v1/session + /v1/voice/token + room.connect (Phase A overlap)
//   tClick = user clicks call → publishData(start_voice) + setMicEnabled
//   tReady = agent_ready arrives → tray flips CONNECTING → listening
//
// The metric that matters for perceived latency is `tReady - tClick` because
// Phase A runs entirely before the visitor clicks. The headless test simulates
// a 2-second dwell between page-load and click.
//
// Run: node apps/voice-agent/scripts/time-voice-cold-start.mjs
//
// Env (defaulted to prod):
//   API_BASE=https://api-production-1ea1.up.railway.app
//   MERCHANT_ID=SM-XPK2EN
//   ORIGIN=https://shoppingmate-web.vercel.app
//   DWELL_MS=2000  (sleep between page-load and simulated click)

const API_BASE = process.env.API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT_ID = process.env.MERCHANT_ID || 'SM-XPK2EN';
const ORIGIN = process.env.ORIGIN || 'https://shoppingmate-web.vercel.app';
const DWELL_MS = Number(process.env.DWELL_MS ?? 2000);

const { Room, RoomEvent } = await import('@livekit/rtc-node');

const t0 = Date.now();
const mark = (label) => console.log(`+${(Date.now() - t0).toString().padStart(5)} ms  ${label}`);

mark('start (page-load)');

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

// 3. join LiveKit room (Phase A — pre-connect at page-load)
const room = new Room();
let agentJoined = null;
let agentWarmedAt = null;
let agentReadyAt = null;
let tClick = null;
room.on(RoomEvent.ParticipantConnected, (p) => {
  if (p.identity?.startsWith('AG_') || p.identity?.includes('agent')) {
    agentJoined = Date.now();
    mark(`agent participant joined (${p.identity})`);
  }
});
room.on(RoomEvent.DataReceived, (payload) => {
  try {
    const msg = JSON.parse(new TextDecoder().decode(payload));
    if (msg.type === 'agent_warmed') {
      agentWarmedAt = Date.now();
      mark(`🟡 agent_warmed received (Phase A done)`);
    } else if (msg.type === 'agent_ready') {
      agentReadyAt = Date.now();
      mark(`✅ agent_ready received (Phase B done)`);
    }
  } catch {}
});

await room.connect(tok.wsUrl, tok.token);
mark('room.connect resolved (visitor joined)');

// Wait for Phase A (agent_warmed) — up to 15s
const warmDeadline = Date.now() + 15000;
while (!agentWarmedAt && Date.now() < warmDeadline) {
  await new Promise((r) => setTimeout(r, 25));
}
if (!agentWarmedAt) {
  mark('❌ TIMEOUT — agent_warmed never arrived');
  await room.disconnect();
  process.exit(1);
}

// Simulate visitor dwell time before clicking call.
mark(`💤 simulating ${DWELL_MS}ms dwell before click`);
await new Promise((r) => setTimeout(r, DWELL_MS));

// 4. Click: send start_voice over data channel.
tClick = Date.now();
mark(`👆 CLICK — publishing start_voice`);
const startMsg = new TextEncoder().encode(
  JSON.stringify({ type: 'start_voice', sessionId: sessionBody.sessionId }),
);
await room.localParticipant.publishData(startMsg, { reliable: true });

// Wait for Phase B (agent_ready) — up to 15s
const readyDeadline = Date.now() + 15000;
while (!agentReadyAt && Date.now() < readyDeadline) {
  await new Promise((r) => setTimeout(r, 25));
}

if (!agentReadyAt) {
  mark('❌ TIMEOUT — agent_ready never arrived after click');
} else {
  const totalWall = agentReadyAt - t0;
  const warmMs = agentWarmedAt - t0;
  const clickToReady = agentReadyAt - tClick;
  console.log('');
  console.log(`=== summary ===`);
  console.log(`Phase A (page-load → agent_warmed):      ${warmMs} ms`);
  console.log(`Dwell (simulated):                       ${DWELL_MS} ms`);
  console.log(`Phase B (click → agent_ready):           ${clickToReady} ms  ← USER-PERCEIVED`);
  console.log(`Total wall-clock (page-load → ready):    ${totalWall} ms`);
  console.log('');
  console.log(`The user sees CONNECTING for ${clickToReady}ms (Phase B only).`);
}

await room.disconnect();
process.exit(0);
