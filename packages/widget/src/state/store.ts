import type { AgentEvent, CardItem, Mode } from '../transport/codec.js';

export type TranscriptItem =
  | { id: string; role: 'agent'; kind: 'text'; text: string; ts: number }
  | { id: string; role: 'user'; kind: 'text'; text: string; ts: number }
  | { id: string; role: 'agent'; kind: 'cards'; items: CardItem[]; ts: number }
  | { id: string; role: 'system'; kind: 'cap_warning'; remaining: number; ts: number }
  | { id: string; role: 'system'; kind: 'closed'; reason: 'user' | 'cap' | 'error'; ts: number };

export type WidgetState = {
  sessionId: string;
  mode: 'pill' | 'expanded' | 'call' | 'chat';
  voiceState: 'idle' | 'listening' | 'speaking' | 'muted';
  transcript: TranscriptItem[];
  thinking: boolean;
  closed: boolean;
  closedReason: 'user' | 'cap' | 'error' | null;
  checkoutUrl: string | null;
  capWarning: { reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number } | null;
  connection: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
};

export type Action =
  | { type: 'set_mode'; mode: WidgetState['mode'] }
  | { type: 'set_voice_state'; state: WidgetState['voiceState'] }
  | { type: 'set_connection'; status: WidgetState['connection'] }
  | { type: 'user_input'; text: string; mode: Mode }
  | { type: 'agent_event'; event: AgentEvent }
  | { type: 'reset' };

export type Store = {
  get: () => WidgetState;
  dispatch: (a: Action) => void;
  subscribe: (cb: (s: WidgetState) => void) => () => void;
};

let idCounter = 0;
const nextId = () => {
  idCounter += 1;
  return `t${idCounter}`;
};

function reduce(state: WidgetState, a: Action): WidgetState {
  switch (a.type) {
    case 'set_mode':
      return { ...state, mode: a.mode };
    case 'set_voice_state':
      return { ...state, voiceState: a.state };
    case 'set_connection':
      return { ...state, connection: a.status };
    case 'reset':
      return {
        ...state,
        transcript: [],
        thinking: false,
        closed: false,
        closedReason: null,
        checkoutUrl: null,
        capWarning: null,
      };
    case 'user_input':
      return {
        ...state,
        transcript: [
          ...state.transcript,
          { id: nextId(), role: 'user', kind: 'text', text: a.text, ts: Date.now() },
        ],
      };
    case 'agent_event': {
      const ev = a.event;
      switch (ev.type) {
        case 'thinking':
          return { ...state, thinking: true };
        case 'end_of_turn':
          return { ...state, thinking: false };
        case 'say':
          return {
            ...state,
            thinking: false,
            transcript: [
              ...state.transcript,
              { id: nextId(), role: 'agent', kind: 'text', text: ev.text, ts: Date.now() },
            ],
          };
        case 'cards':
          return {
            ...state,
            transcript: [
              ...state.transcript,
              { id: nextId(), role: 'agent', kind: 'cards', items: ev.items, ts: Date.now() },
            ],
          };
        case 'tool_result':
          return state;
        case 'checkout_redirect':
          return { ...state, checkoutUrl: ev.url };
        case 'cap_warning':
          return {
            ...state,
            capWarning: { reason: ev.reason, remaining: ev.remaining },
            transcript: [
              ...state.transcript,
              {
                id: nextId(),
                role: 'system',
                kind: 'cap_warning',
                remaining: ev.remaining,
                ts: Date.now(),
              },
            ],
          };
        case 'session_closed':
          return {
            ...state,
            closed: true,
            closedReason: ev.reason,
            transcript: [
              ...state.transcript,
              { id: nextId(), role: 'system', kind: 'closed', reason: ev.reason, ts: Date.now() },
            ],
          };
        default:
          return state;
      }
    }
    default:
      return state;
  }
}

export function createStore(opts: { sessionId: string }): Store {
  let state: WidgetState = {
    sessionId: opts.sessionId,
    mode: 'pill',
    voiceState: 'idle',
    transcript: [],
    thinking: false,
    closed: false,
    closedReason: null,
    checkoutUrl: null,
    capWarning: null,
    connection: 'connecting',
  };
  const subs: ((s: WidgetState) => void)[] = [];
  return {
    get: () => state,
    dispatch: (a) => {
      state = reduce(state, a);
      for (const cb of subs) cb(state);
    },
    subscribe: (cb) => {
      subs.push(cb);
      return () => {
        const i = subs.indexOf(cb);
        if (i >= 0) subs.splice(i, 1);
      };
    },
  };
}
