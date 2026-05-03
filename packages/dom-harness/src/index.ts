import type { DomAck, DomAction } from '@shoppingmate/adapters';
import { type Browser, chromium, type Page } from 'playwright';
import WebSocket from 'ws';

// Server-side WS + auth — re-exported so callers (apps/api, CLI smoke,
// worker smoke) get a single import for the whole DOM transport pipe.
export { mountWs } from './wsServer.js';
export type { MountedWs } from './wsServer.js';
export { signWsToken, verifyWsToken } from './wsAuth.js';
export type { WsTokenPayload } from './wsAuth.js';

export type HarnessOptions = {
  /** ws://host:port/v1/widget/<sessionId>/ws?token=... */
  wsUrl: string;
  /** Initial page to load — usually `https://${merchant.domain}`. */
  initialUrl: string;
  /** Optional: launched browser; if omitted, we launch headless chromium. */
  browser?: Browser;
};

export type Harness = {
  page: Page;
  stop: () => Promise<void>;
};

type IncomingActionEnvelope = {
  type: 'action';
  actionId: string;
  action: DomAction;
};

/**
 * Playwright-driven "fake gtag": opens a headless browser, connects to the
 * server WebSocket as if it were the visitor's widget, and translates incoming
 * `action` envelopes into Playwright calls. Used by:
 *   - `pnpm shoppingmate adapter-smoke <merchantId>` for DOM merchants
 *   - `apps/worker` onboarding smoke for `adapterType='dom'`
 *
 * On Playwright errors, returns `{ ok:false, reason:'selector_not_found', html }`
 * so the resolver/healer pipeline gets the page HTML to ask Haiku for a fix.
 */
export async function startHarness(opts: HarnessOptions): Promise<Harness> {
  const browser = opts.browser ?? (await chromium.launch({ headless: true }));
  const ownsBrowser = !opts.browser;
  const page: Page = await browser.newPage();
  await page.goto(opts.initialUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

  const ws = new WebSocket(opts.wsUrl);
  await new Promise<void>((resolve, reject) => {
    const onOpen = (): void => {
      ws.off('error', onErr);
      resolve();
    };
    const onErr = (e: Error): void => {
      ws.off('open', onOpen);
      reject(e);
    };
    ws.once('open', onOpen);
    ws.once('error', onErr);
  });

  ws.on('message', async (raw) => {
    let msg: IncomingActionEnvelope;
    try {
      msg = JSON.parse(raw.toString()) as IncomingActionEnvelope;
    } catch {
      return;
    }
    if (msg.type !== 'action') return;
    const ack = await runAction(page, msg.action);
    ws.send(JSON.stringify({ type: 'ack', actionId: msg.actionId, ...ack }));
  });

  return {
    page,
    stop: async () => {
      try {
        ws.close();
      } catch {
        // ignore
      }
      try {
        await page.close();
      } catch {
        // ignore
      }
      if (ownsBrowser) {
        try {
          await browser.close();
        } catch {
          // ignore
        }
      }
    },
  };
}

async function runAction(page: Page, action: DomAction): Promise<DomAck> {
  try {
    switch (action.type) {
      case 'dom.navigate':
        await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 20_000 });
        return { ok: true };
      case 'dom.click':
        await page.click(action.selector, { timeout: 5000 });
        return { ok: true };
      case 'dom.fill':
        await page.fill(action.selector, action.value, { timeout: 5000 });
        return { ok: true };
      case 'dom.read': {
        const text = (await page.textContent(action.selector, { timeout: 5000 })) ?? '';
        return { ok: true, value: text };
      }
      case 'dom.wait_for':
        await page.waitForSelector(action.selector, { timeout: action.timeoutMs });
        return { ok: true };
      case 'dom.snapshot':
        return { ok: true };
      case 'ui.show_message':
      case 'ui.show_product_card':
        // UI actions are no-ops for the smoke harness.
        return { ok: true };
      default: {
        const exhaustive: never = action;
        return { ok: false, reason: 'safety_blocked', html: String(exhaustive) };
      }
    }
  } catch (err) {
    const errMsg = (err as Error).message ?? '';
    let html = '';
    try {
      html = (await page.content()).slice(0, 24_000);
    } catch {
      // page may be closed; leave html empty
    }
    if (/timeout|Timeout/.test(errMsg)) return { ok: false, reason: 'timeout', html };
    return { ok: false, reason: 'selector_not_found', html };
  }
}
