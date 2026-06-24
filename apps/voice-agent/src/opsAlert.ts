import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ mod: 'ops-alert' });

// Best-effort ops alerting for the voice worker. Decoupled from the Composio
// Slack integration in apps/api: posts to a plain Slack Incoming Webhook URL if
// OPS_ALERT_WEBHOOK_URL is set, otherwise a silent no-op (the dedicated metric +
// error log in agentWorker still fire regardless). Throttled per-process so a
// sustained outage pings once, not on every failed turn.
const THROTTLE_MS = 10 * 60 * 1000;
let lastExhaustedAlertAt = 0;

async function postWebhook(text: string): Promise<void> {
  const url = process.env.OPS_ALERT_WEBHOOK_URL;
  if (!url) return; // not configured — metric + error log are the fallback
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
  } catch (err) {
    log.warn({ err }, 'ops alert webhook post failed');
  } finally {
    clearTimeout(timer);
  }
}

/** Fire when the OpenRouter side-channel executor returns 402 (out of credits) —
 *  every turn's tools fail until topped up, so this needs immediate visibility. */
export async function alertExecutorExhausted(merchantId: string, sessionId: string): Promise<void> {
  const now = Date.now();
  if (now - lastExhaustedAlertAt < THROTTLE_MS) return;
  lastExhaustedAlertAt = now;
  await postWebhook(
    `:rotating_light: *Voice bot tools DOWN* — OpenRouter executor 402 (insufficient credits). ` +
      `Cart/checkout/navigate are failing for every conversation until topped up. ` +
      `merchant=${merchantId} session=${sessionId}. Top up: https://openrouter.ai/settings/credits`,
  );
}
