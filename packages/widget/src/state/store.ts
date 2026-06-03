import type { AgentEvent, CardItem, Mode } from '../transport/codec.js';

export type TranscriptItem =
  | { id: string; role: 'agent'; kind: 'text'; text: string; ts: number; partial?: boolean }
  | { id: string; role: 'user'; kind: 'text'; text: string; ts: number }
  | { id: string; role: 'agent'; kind: 'cards'; items: CardItem[]; ts: number }
  | { id: string; role: 'system'; kind: 'cap_warning'; remaining: number; ts: number }
  | { id: string; role: 'system'; kind: 'closed'; reason: 'user' | 'cap' | 'error'; ts: number };

export type WidgetState = {
  sessionId: string;
  mode: 'pill' | 'expanded' | 'call' | 'chat';
  voiceState: 'idle' | 'connecting' | 'listening' | 'speaking' | 'muted';
  transcript: TranscriptItem[];
  thinking: boolean;
  closed: boolean;
  closedReason: 'user' | 'cap' | 'error' | null;
  checkoutUrl: string | null;
  capWarning: { reason: 'turns' | 'voice_ms' | 'duration_ms'; remaining: number } | null;
  connection: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  voiceError: { code: string; message: string } | null;
};

export type Action =
  | { type: 'set_mode'; mode: WidgetState['mode'] }
  | { type: 'set_voice_state'; state: WidgetState['voiceState'] }
  | { type: 'set_connection'; status: WidgetState['connection'] }
  | { type: 'set_voice_error'; error: WidgetState['voiceError'] }
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
      // Successful voice transitions clear the last error so a retry doesn't
      // keep showing the previous failure copy after recovery.
      return a.state !== 'idle'
        ? { ...state, voiceState: a.state, voiceError: null }
        : { ...state, voiceState: a.state };
    case 'set_connection':
      return { ...state, connection: a.status };
    case 'set_voice_error':
      return { ...state, voiceError: a.error };
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
        case 'say': {
          // Final caption for the current turn. If we've been streaming
          // partials into the last agent bubble, finalize it in place;
          // otherwise append a fresh bubble.
          const last = state.transcript[state.transcript.length - 1];
          if (last && last.role === 'agent' && last.kind === 'text' && last.partial) {
            return {
              ...state,
              thinking: false,
              transcript: [
                ...state.transcript.slice(0, -1),
                { ...last, text: ev.text, partial: false, ts: Date.now() },
              ],
            };
          }
          return {
            ...state,
            thinking: false,
            transcript: [
              ...state.transcript,
              { id: nextId(), role: 'agent', kind: 'text', text: ev.text, ts: Date.now() },
            ],
          };
        }
        case 'say_partial': {
          // Streaming caption update. Replace the active partial agent bubble
          // in place; create one if this is the first chunk of the turn.
          const last = state.transcript[state.transcript.length - 1];
          if (last && last.role === 'agent' && last.kind === 'text' && last.partial) {
            return {
              ...state,
              thinking: false,
              transcript: [
                ...state.transcript.slice(0, -1),
                { ...last, text: ev.text, ts: Date.now() },
              ],
            };
          }
          return {
            ...state,
            thinking: false,
            transcript: [
              ...state.transcript,
              {
                id: nextId(),
                role: 'agent',
                kind: 'text',
                text: ev.text,
                ts: Date.now(),
                partial: true,
              },
            ],
          };
        }
        case 'user_text':
          return {
            ...state,
            transcript: [
              ...state.transcript,
              { id: nextId(), role: 'user', kind: 'text', text: ev.text, ts: Date.now() },
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
    voiceError: null,
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
