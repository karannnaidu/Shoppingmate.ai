// Voice-agent watchdog: proves a real agent can JOIN a LiveKit room, and if it
// can't (the job-executor wedge — worker stays registered + receives jobs but
// never joins), redeploys the voice-agent and fires a Slack alert. Meant to run
// on a schedule (GitHub Actions cron). Every external action is gated on its
// secret, so with no secrets it's a safe probe-only run.
//
//   healthy  -> exit 0
//   wedged   -> (alert + redeploy if configured) -> exit 1
//
// Env:
//   SHOPPINGMATE_API_BASE   (default prod api)
//   WATCHDOG_MERCHANT_ID    (default SM-XPK2EN)   WATCHDOG_ORIGIN (default shoppingmate.ai)
//   PROBE_TIMEOUT_MS        (default 30000)
//   OPS_ALERT_WEBHOOK_URL   Slack incoming webhook (optional)
//   RAILWAY_API_TOKEN + RAILWAY_VOICE_SERVICE_ID + RAILWAY_ENVIRONMENT_ID  (optional; all 3 needed to auto-redeploy)
//   DRY_RUN=1               probe + report only, never redeploy
import { Room, RoomEvent } from '@livekit/rtc-node';

const API = process.env.SHOPPINGMATE_API_BASE || 'https://api-production-1ea1.up.railway.app';
const MERCHANT = process.env.WATCHDOG_MERCHANT_ID || 'SM-XPK2EN';
const ORIGIN = process.env.WATCHDOG_ORIGIN || 'shoppingmate.ai';
const TIMEOUT = Number(process.env.PROBE_TIMEOUT_MS || 30000);

const log = (...a) => console.log(`[watchdog ${new Date().toISOString()}]`, ...a);

async function alert(text) {
  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!url) return log('alert skipped (OPS_ALERT_WEBHOOK_URL unset):', text);
  try {
    await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
    log('alert posted');
  } catch (e) {
    log('alert failed:', e.message);
  }
}

async function redeploy() {
  const token = process.env.RAILWAY_API_TOKEN;
  const serviceId = process.env.RAILWAY_VOICE_SERVICE_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
  if (process.env.DRY_RUN === '1') return log('redeploy skipped (DRY_RUN=1)');
  if (!token || !serviceId || !environmentId) {
    return log('redeploy skipped — set RAILWAY_API_TOKEN + RAILWAY_VOICE_SERVICE_ID + RAILWAY_ENVIRONMENT_ID to auto-recover');
  }
  const query = `mutation($serviceId: String!, $environmentId: String!) { serviceInstanceRedeploy(serviceId: $serviceId, environmentId: $environmentId) }`;
  try {
    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables: { serviceId, environmentId } }),
    });
    const body = await res.json();
    if (body.errors) throw new Error(JSON.stringify(body.errors));
    log('redeploy triggered:', JSON.stringify(body.data));
  } catch (e) {
    log('redeploy FAILED:', e.message);
    await alert(`:x: voice-agent watchdog could not auto-redeploy: ${e.message}. Redeploy manually: railway redeploy --service voice-agent`);
  }
}

// Probe: session -> voice token -> join room -> wait for an agent participant.
async function agentJoins() {
  const sess = await fetch(`${API}/v1/session`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` },
    body: JSON.stringify({ merchantId: MERCHANT, domain: ORIGIN }),
  }).then((r) => r.json());
  const tok = await fetch(`${API}/v1/voice/token`, {
    method: 'POST', headers: { 'content-type': 'application/json', origin: `https://${ORIGIN}` },
    body: JSON.stringify({ merchantId: MERCHANT, sessionId: sess.sessionId }),
  }).then((r) => r.json());
  log(`probe room=${tok.roomName} persona=${tok.personaId}`);

  const room = new Room();
  const joined = new Promise((resolve) => {
    room.on(RoomEvent.ParticipantConnected, (p) => {
      if (p.identity?.startsWith('agent')) resolve(true);
    });
  });
  await room.connect(tok.wsUrl, tok.token, { autoSubscribe: true });
  const result = await Promise.race([joined, new Promise((r) => setTimeout(() => r(false), TIMEOUT))]);
  await room.disconnect().catch(() => {});
  return result;
}

let healthy = false;
try {
  healthy = await agentJoins();
} catch (e) {
  log('probe error:', e.message);
}

if (healthy) {
  log('HEALTHY — agent joined');
  process.exit(0);
}
log('WEDGED — agent did not join within', TIMEOUT, 'ms');
await alert(`:rotating_light: *Voice bot DOWN* — voice-agent worker wedged (no agent joined a probe call in ${TIMEOUT / 1000}s). Auto-recovery ${process.env.RAILWAY_API_TOKEN ? 'redeploying now' : 'NOT configured'}.`);
await redeploy();
process.exit(1);
