import type { AgentEvent, RunTurnDeps, SessionState, WidgetMessage } from '@shoppingmate/agent';
import type { Adapter } from '@shoppingmate/adapters';
import type { Merchant } from '@shoppingmate/db';
import { childLogger } from '@shoppingmate/shared';

const log = childLogger({ mod: 'bridge' });

export type DataChannelMessage =
  | { type: 'user_text'; text: string }
  | { type: 'say'; text: string }
  | { type: 'say_partial'; text: string }
  | { type: 'cards'; items: unknown[] }
  | { type: 'checkout_redirect'; url: string }
  | { type: 'cap_warning'; remaining: number }
  | { type: 'session_closed'; reason: string };

export type BridgeDeps = {
  sessionId: string;
  merchantId: string;
  runTurn: (
    deps: RunTurnDeps,
    merchant: Merchant,
    session: SessionState,
    msg: WidgetMessage,
  ) => AsyncGenerator<AgentEvent, void, void>;
  loadMerchant: (id: string) => Promise<Merchant>;
  loadSession: (sessionId: string) => Promise<SessionState>;
  saveSession: (s: SessionState) => Promise<void>;
  recordMetric: (
    name: string,
    tags: Record<string, string | number | boolean>,
    value?: number,
  ) => Promise<void>;
  loadAdapter: (m: Merchant, sid: string) => Adapter;
  speak: (text: string) => Promise<void>;
  publishData: (msg: DataChannelMessage) => void;
  closeRoom: () => void;
  interrupt: () => void;
  caps?: { recordTurn: () => void };
};

export type Bridge = {
  handleUserText: (text: string) => Promise<void>;
  handleBargeIn: () => void;
};

export function createBridge(deps: BridgeDeps): Bridge {
  let aborted = false;

  return {
    async handleUserText(text) {
      aborted = false;
      deps.caps?.recordTurn();
      deps.publishData({ type: 'user_text', text });

      const merchant = await deps.loadMerchant(deps.merchantId);
      const session = await deps.loadSession(deps.sessionId);
      const widgetMsg: WidgetMessage = {
        type: 'user_text',
        sessionId: deps.sessionId,
        text,
        mode: 'voice',
      };

      const runDeps: RunTurnDeps = {
        loadAdapter: deps.loadAdapter,
        saveSession: deps.saveSession,
        recordMetric: deps.recordMetric,
      };

      try {
        for await (const event of deps.runTurn(runDeps, merchant, session, widgetMsg)) {
          if (aborted) {
            log.info(
              { sessionId: deps.sessionId },
              'bridge: abort flag set, dropping remaining events',
            );
            return;
          }
          await routeEvent(event, deps);
        }
      } catch (err) {
        log.error({ err, sessionId: deps.sessionId }, 'runTurn failed in bridge');
        deps.publishData({ type: 'session_closed', reason: 'error' });
        deps.closeRoom();
      }
    },
    handleBargeIn() {
      aborted = true;
      deps.interrupt();
      deps
        .recordMetric('voice.barge_in_succeeded', { sessionId: deps.sessionId })
        .catch(() => {});
    },
  };
}

async function routeEvent(event: AgentEvent, deps: BridgeDeps): Promise<void> {
  switch (event.type) {
    case 'say':
      deps.publishData({ type: 'say', text: event.text });
      await deps.speak(event.text);
      return;
    case 'cards':
      deps.publishData({ type: 'cards', items: event.items });
      return;
    case 'checkout_redirect':
      deps.publishData({ type: 'checkout_redirect', url: event.url });
      return;
    case 'cap_warning':
      deps.publishData({ type: 'cap_warning', remaining: event.remaining });
      return;
    case 'session_closed':
      deps.publishData({ type: 'session_closed', reason: event.reason });
      deps.closeRoom();
      return;
    case 'thinking':
    case 'tool_result':
    case 'end_of_turn':
      return;
    default: {
      const t = (event as { type: string }).type;
      log.debug({ type: t }, 'bridge: ignoring unknown event');
    }
  }
}
