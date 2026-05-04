import { createSTT } from './audio/stt.js';
import { createTTS } from './audio/tts.js';
import { type VoiceMode, createVoiceMode } from './audio/voiceMode.js';
import { bootstrap } from './bootstrap.js';
import { type Store, createStore } from './state/store.js';
import { SHADOW_CSS } from './styles/shadow.css.js';
import { decodeAgentEvent, encodeWidgetMessage } from './transport/codec.js';
import { type AgentSocket, connectAgentWs } from './transport/ws.js';
import { renderCall } from './ui/call.js';
import { renderChat } from './ui/chat.js';
import { renderPill } from './ui/pill.js';

const TAG = 'shoppingmate-widget';

class WidgetElement extends HTMLElement {
  private rootEl: HTMLElement | null = null;
  private pillHost: HTMLElement | null = null;
  private panelHost: HTMLElement | null = null;
  private store: Store = createStore({ sessionId: 'pending' });
  private socket: AgentSocket | null = null;
  private voiceMode: VoiceMode = createVoiceMode(null, createTTS());
  private apiBase = '';
  private merchantId = '';
  private domain = window.location.host;

  connectedCallback() {
    if (this.shadowRoot) return;
    const id = this.getAttribute('data-id');
    const api = this.getAttribute('data-api') ?? this.apiBase;
    if (!id) {
      console.warn('[shoppingmate] data-id missing on widget element');
      return;
    }
    this.merchantId = id;
    this.apiBase = api;
    const sr = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    sr.appendChild(style);
    const root = document.createElement('div');
    root.className = 'root';
    sr.appendChild(root);
    this.rootEl = root;
    this.panelHost = document.createElement('div');
    this.pillHost = document.createElement('div');
    root.appendChild(this.panelHost);
    root.appendChild(this.pillHost);
    this.store.subscribe(() => this.render());
    this.render();
    void this.start();
  }

  disconnectedCallback() {
    this.socket?.close();
    this.voiceMode.stop();
  }

  private async start() {
    const result = await bootstrap({
      apiBase: this.apiBase,
      merchantId: this.merchantId,
      domain: this.domain,
    });
    if (result.kind === 'err') {
      console.warn('[shoppingmate] bootstrap failed:', result.reason);
      return;
    }
    this.store = createStore({ sessionId: result.sessionId });
    this.store.subscribe(() => this.render());
    const stt = createSTT();
    this.voiceMode = createVoiceMode(stt, createTTS());
    stt?.onFinal((text) => {
      this.store.dispatch({ type: 'user_input', text, mode: 'voice' });
      this.socket?.send(
        encodeWidgetMessage({
          type: 'user_text',
          sessionId: result.sessionId,
          text,
          mode: 'voice',
        }),
      );
    });
    this.voiceMode.onStateChange((s) => this.store.dispatch({ type: 'set_voice_state', state: s }));
    this.socket = connectAgentWs(result.wsUrl, {
      sessionId: result.sessionId,
      onEvent: (raw) => {
        const ev = decodeAgentEvent(raw);
        if (!ev) return;
        this.store.dispatch({ type: 'agent_event', event: ev });
        if (ev.type === 'say') void this.voiceMode.speak(ev.text);
      },
      onStatus: (status) => this.store.dispatch({ type: 'set_connection', status }),
    });
  }

  private render() {
    if (!this.pillHost || !this.panelHost) return;
    const s = this.store.get();
    const callable = createSTT() !== null;
    if (s.mode === 'call') {
      renderCall(this.panelHost, {
        voiceState: s.voiceState,
        muted: s.voiceState === 'muted',
        transcript: s.transcript,
        checkoutUrl: s.checkoutUrl,
        onMute: (next) => this.voiceMode.setMuted(next),
        onEnd: () => {
          this.voiceMode.stop();
          this.store.dispatch({ type: 'set_mode', mode: 'expanded' });
        },
        onChat: () => this.store.dispatch({ type: 'set_mode', mode: 'chat' }),
        onCardTap: (p) => this.cardTap(p),
        onCheckout: () => {},
      });
    } else if (s.mode === 'chat') {
      renderChat(this.panelHost, {
        transcript: s.transcript,
        checkoutUrl: s.checkoutUrl,
        onSend: (text) => this.userText(text, 'text'),
        onCall: () => this.openCall(),
        onCardTap: (p) => this.cardTap(p),
        closed: s.closed,
      });
    } else {
      this.panelHost.innerHTML = '';
    }
    renderPill(this.pillHost, {
      mode: s.mode,
      callable,
      onCall: () => this.openCall(),
      onChat: () => this.store.dispatch({ type: 'set_mode', mode: 'chat' }),
      onClose: () => this.store.dispatch({ type: 'set_mode', mode: 'pill' }),
    });
  }

  private openCall() {
    this.store.dispatch({ type: 'set_mode', mode: 'call' });
    this.voiceMode.start();
  }

  private userText(text: string, mode: 'voice' | 'text') {
    this.store.dispatch({ type: 'user_input', text, mode });
    const sid = this.store.get().sessionId;
    this.socket?.send(encodeWidgetMessage({ type: 'user_text', sessionId: sid, text, mode }));
  }

  private cardTap(p: { sku: string; variantId: string | null }) {
    const sid = this.store.get().sessionId;
    this.socket?.send(
      encodeWidgetMessage({
        type: 'card_tap',
        sessionId: sid,
        action: 'cartAdd',
        sku: p.sku,
        variantId: p.variantId,
        qty: 1,
      }),
    );
  }
}

export function defineWidget(): void {
  if (customElements.get(TAG)) return;
  customElements.define(TAG, WidgetElement);
}
