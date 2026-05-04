export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

export type AgentSocketDeps = {
  sessionId: string;
  onEvent: (raw: string) => void;
  onStatus: (s: ConnectionStatus) => void;
};

export type AgentSocket = {
  send: (encoded: string) => void;
  close: () => void;
};

const BACKOFF_SCHEDULE_MS = [1000, 2000, 4000, 8000, 16000];
const MAX_FAILURES = 5;

export function connectAgentWs(url: string, deps: AgentSocketDeps): AgentSocket {
  let ws: WebSocket | null = null;
  let failures = 0;
  let stopped = false;
  let pending: string[] = [];

  function open() {
    if (stopped) return;
    deps.onStatus(failures > 0 ? 'reconnecting' : 'connecting');
    ws = new WebSocket(url);
    ws.onopen = () => {
      deps.onStatus('connected');
      // Resume on reconnect; first connect is implicit via the initial user_text.
      if (failures > 0) {
        ws?.send(JSON.stringify({ type: 'session_resume', sessionId: deps.sessionId }));
      }
      failures = 0;
      for (const m of pending) ws?.send(m);
      pending = [];
    };
    ws.onmessage = (ev) => deps.onEvent(typeof ev.data === 'string' ? ev.data : '');
    ws.onerror = () => {
      // onclose fires too; backoff scheduled there.
    };
    ws.onclose = () => {
      if (stopped) return;
      failures += 1;
      if (failures >= MAX_FAILURES) {
        deps.onStatus('disconnected');
        return;
      }
      const idx = Math.min(failures - 1, BACKOFF_SCHEDULE_MS.length - 1);
      const delay = BACKOFF_SCHEDULE_MS[idx] ?? 30000;
      deps.onStatus('reconnecting');
      setTimeout(open, delay);
    };
  }

  open();

  return {
    send: (encoded) => {
      if (ws && ws.readyState === 1) ws.send(encoded);
      else pending.push(encoded);
    },
    close: () => {
      stopped = true;
      ws?.close();
    },
  };
}
