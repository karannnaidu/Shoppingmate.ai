import { createSTT } from './audio/stt.js';
import { createTTS } from './audio/tts.js';
import { type VoiceMode, createVoiceMode } from './audio/voiceMode.js';
import { createVoiceModeFactory } from './audio/voiceModeFactory.js';
import { type Ambience, createAmbience } from './audio/ambience.js';
import { type VoiceBootstrap, bootstrap } from './bootstrap.js';
import { startActivityTracker } from './host/activity.js';
import { getOrCreateVisitorId } from './identity.js';
import { executeHostAction } from './host/actions.js';
import { type PersonaDisplay, getPersonaDisplay, getPersonaPlaceholder } from './persona.js';
import { type Store, createStore } from './state/store.js';
import { SHADOW_CSS } from './styles/shadow.css.js';
import { decodeAgentEvent, encodeWidgetMessage } from './transport/codec.js';
import { preloadLiveKit } from './transport/livekit.js';
import { type AgentSocket, connectAgentWs } from './transport/ws.js';
import { makeDraggable } from './ui/drag.js';
import { renderCall } from './ui/call.js';
import { renderChat } from './ui/chat.js';
import { renderPill } from './ui/pill.js';

const TAG = 'shoppingmate-widget';

// Merchants that get the proactive "incoming call" launcher invite.
const DEMO_MERCHANT_ID = 'SM-XPK2EN';
const CALMOSIS_MERCHANT_ID = 'SM-2SCCLZ';

const POSITION_CLASSES = new Set([
  'bottom-right',
  'bottom-left',
  'bottom-center',
  'center',
  'center-left',
  'center-right',
  'top-right',
  'top-left',
]);

// Resting launcher shrinks to just the avatar after this many idle ms so it
// stops covering the host page's own CTAs. Any hover / focus / tap wakes it.
const COLLAPSE_IDLE_MS = 6000;

// If a proactive "incoming call" invite is ignored for this long, drop it back
// to the resting (collapsible) launcher instead of ringing forever over the
// page. Keeps the nudge from permanently blocking content.
const INVITE_DISMISS_MS = 12000;

function resolveVoiceStack(): 'live-kit' | 'web-speech' {
  // Build-time replaced via esbuild `define`. Default ships as 'live-kit'.
  const stack = (globalThis as unknown as { __SHOPPINGMATE_VOICE_STACK__?: string })
    .__SHOPPINGMATE_VOICE_STACK__;
  return stack === 'web-speech' ? 'web-speech' : 'live-kit';
}

class WidgetElement extends HTMLElement {
  private rootEl: HTMLElement | null = null;
  private pillHost: HTMLElement | null = null;
  private panelHost: HTMLElement | null = null;
  private store: Store = createStore({ sessionId: 'pending' });
  private socket: AgentSocket | null = null;
  private voiceMode: VoiceMode = createVoiceMode(null, createTTS());
  private voice: VoiceBootstrap | null = null;
  private persona: PersonaDisplay = getPersonaPlaceholder();
  private apiBase = '';
  private merchantId = '';
  private domain = window.location.host;
  private stopActivityTracker: (() => void) | null = null;
  private inviteTimer: ReturnType<typeof setTimeout> | null = null;
  private inviteDismissTimer: ReturnType<typeof setTimeout> | null = null;
  private collapseTimer: ReturnType<typeof setTimeout> | null = null;
  private stopCollapse: (() => void) | null = null;
  private stopDrag: (() => void) | null = null;
  // Subtle office room tone during a live call. Configured in connectedCallback
  // from the data-ambience attribute ("off" disables). The switch the user asked
  // for: set data-ambience="off" on the widget element, or pass false here.
  private ambience: Ambience = createAmbience(false);

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
    // Office ambience during calls — on by default, disabled with data-ambience="off".
    this.ambience = createAmbience(this.getAttribute('data-ambience') !== 'off');
    const sr = this.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = SHADOW_CSS;
    sr.appendChild(style);
    const root = document.createElement('div');
    // Placement override (stop-gap until Task 8 wires it through the
    // dashboard). Reads `data-position` from the host element: bottom-right
    // (default), bottom-left, bottom-center, center, center-left, center-right,
    // top-right, top-left. Invalid values fall back to the merchant default.
    // Calmosis defaults to center-left (mid of the left edge) so the launcher
    // clears the storefront's right-aligned CTAs; the host can still override
    // with an explicit data-position. Everyone else stays bottom-right.
    const defaultPosition =
      this.merchantId === CALMOSIS_MERCHANT_ID ? 'center-left' : 'bottom-right';
    const position = (this.getAttribute('data-position') ?? defaultPosition).toLowerCase();
    const positionClass = POSITION_CLASSES.has(position) ? `pos-${position}` : 'pos-bottom-right';
    root.className = `root ${positionClass}`;
    sr.appendChild(root);
    this.rootEl = root;
    this.panelHost = document.createElement('div');
    this.pillHost = document.createElement('div');
    root.appendChild(this.panelHost);
    root.appendChild(this.pillHost);
    this.store.subscribe(() => this.render());
    this.render();
    // Let the visitor drag the launcher anywhere so it never blocks the page.
    // Position is anchored by quadrant (panel always opens on-screen) and saved
    // per-merchant. Works on every brand site the widget ships to.
    this.stopDrag = makeDraggable({
      root,
      surface: this.pillHost,
      storageKey: `sm-widget-pos:${this.merchantId}`,
    });
    // Shrink the resting launcher to just the avatar when the visitor isn't
    // using it, so it stops covering the page's own buttons.
    this.stopCollapse = this.setupAutoCollapse(root, this.pillHost);
    // Warm the livekit-client ESM import now (it's ~120KB lazy-loaded from a
    // CDN). If we wait until the visitor clicks voice, the click→listening
    // path eats the full fetch + parse latency (~500-1500ms first visit). This
    // is fire-and-forget; preloadLiveKit caches the import promise so the
    // actual connect at click time just awaits the already-resolved module.
    if (resolveVoiceStack() === 'live-kit') preloadLiveKit();
    void this.start();
  }

  disconnectedCallback() {
    this.socket?.close();
    this.voiceMode.stop();
    this.ambience.stop();
    this.stopActivityTracker?.();
    if (this.inviteTimer) clearTimeout(this.inviteTimer);
    if (this.inviteDismissTimer) clearTimeout(this.inviteDismissTimer);
    if (this.collapseTimer) clearTimeout(this.collapseTimer);
    this.stopCollapse?.();
    this.stopDrag?.();
  }

  // Auto-collapse the resting launcher to just the avatar after a few idle
  // seconds (and immediately arm it on load) so it never blocks the host page's
  // CTAs. Hover / focus / pointer activity on the launcher wakes it back to the
  // full pill and re-arms the idle timer. The `collapsed` class only takes
  // effect in the resting phase (see shadow.css) — a live call or an incoming
  // invite always shows its controls.
  private setupAutoCollapse(root: HTMLElement, surface: HTMLElement): () => void {
    const arm = () => {
      if (this.collapseTimer) clearTimeout(this.collapseTimer);
      this.collapseTimer = setTimeout(() => root.classList.add('collapsed'), COLLAPSE_IDLE_MS);
    };
    const wake = () => {
      root.classList.remove('collapsed');
      arm();
    };
    surface.addEventListener('pointerenter', wake);
    surface.addEventListener('pointerdown', wake);
    surface.addEventListener('focusin', wake);
    surface.addEventListener('pointerleave', arm);
    arm();
    return () => {
      surface.removeEventListener('pointerenter', wake);
      surface.removeEventListener('pointerdown', wake);
      surface.removeEventListener('focusin', wake);
      surface.removeEventListener('pointerleave', arm);
    };
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
    this.voice = result.voice;
    this.persona = getPersonaDisplay(result.personaId ?? result.voice?.personaId ?? null);

    const stack = resolveVoiceStack();
    const stt = createSTT();
    if (stack === 'live-kit' && this.voice) {
      const lkVoiceMode = createVoiceModeFactory({
        stack: 'live-kit',
        livekit: {
          sessionId: result.sessionId,
          wsUrl: this.voice.wsUrl,
          token: this.voice.token,
          roomName: this.voice.roomName,
          onTranscriptEvent: (bytes) => this.handleLiveKitData(bytes),
        },
      });
      if (lkVoiceMode) {
        this.voiceMode = lkVoiceMode;
        // Pre-connect the LiveKit room now so Phase A (agent dispatch +
        // job.connect + track publish) overlaps with the visitor scrolling
        // the landing page. By the time they click, agent_warmed has usually
        // arrived and the click → agent_ready path is just one Gemini WS open.
        this.voiceMode.warm?.();
      }
    } else {
      // Plan 5 fallback (web-speech) or live-kit unavailable.
      const wsVoiceMode = createVoiceModeFactory({ stack: 'web-speech' });
      if (wsVoiceMode) this.voiceMode = wsVoiceMode;
      stt?.onFinal((text) => {
        this.store.dispatch({ type: 'user_input', text, mode: 'voice' });
        this.socket?.send(
          encodeWidgetMessage({
            type: 'user_text',
            sessionId: result.sessionId,
            text,
            mode: 'voice',
            visitorId: getOrCreateVisitorId(),
          }),
        );
      });
    }
    this.voiceMode.onStateChange((s) => this.store.dispatch({ type: 'set_voice_state', state: s }));
    this.voiceMode.onError?.((info) => {
      console.warn('[shoppingmate] voice error', info);
      this.store.dispatch({ type: 'set_voice_error', error: info });
    });
    this.socket = connectAgentWs(result.wsUrl, {
      sessionId: result.sessionId,
      onEvent: (raw) => {
        const ev = decodeAgentEvent(raw);
        if (!ev) return;
        void this.handleAgentEvent(ev);
      },
      onStatus: (status) => this.store.dispatch({ type: 'set_connection', status }),
    });

    // Proactive "incoming call" invite. After a few seconds of silent browsing
    // the launcher flips to the INCOMING CALL treatment (magenta caption + green
    // Accept) to entice the visitor to start a call. Enabled for the demo and
    // for Calmosis (first paid client — drives conversion on ad traffic).
    if (this.merchantId === DEMO_MERCHANT_ID || this.merchantId === CALMOSIS_MERCHANT_ID) {
      this.inviteTimer = setTimeout(() => {
        if (this.store.get().voiceState === 'idle' && this.store.get().mode === 'pill') {
          this.store.dispatch({ type: 'set_invited', invited: true });
          // Ring briefly, then fall back to the resting launcher (which can
          // collapse to the avatar) so an ignored nudge never keeps blocking
          // the page. Accepting or opening chat clears it first via openCall/
          // onChat, which makes this a no-op.
          this.inviteDismissTimer = setTimeout(() => {
            const s = this.store.get();
            if (s.invited && s.voiceState === 'idle' && s.mode === 'pill') {
              this.store.dispatch({ type: 'set_invited', invited: false });
            }
          }, INVITE_DISMISS_MS);
        }
      }, 5000);
    }

    // Task 15: start activity tracker for this session.
    // TODO Task 15 follow-up: load hints from /v1/site-graph/:merchantId/intents
    this.stopActivityTracker = startActivityTracker({
      sessionId: result.sessionId,
      hints: new Map(),
      send: (msg) => this.publishWidgetMessage(msg),
    });
  }

  private async handleAgentEvent(
    ev: import('./transport/codec.js').AgentEvent,
    origin: 'ws' | 'livekit' = 'ws',
  ): Promise<void> {
    if (ev.type === 'host_action_request') {
      const result = await executeHostAction(ev.action);
      this.publishWidgetMessage(
        {
          type: 'host_action_result',
          callId: ev.callId,
          result,
        },
        origin,
      );
      return;
    }
    if (ev.type === 'persona_swap') {
      // v0.1: voice-agent owns the transport reconnect; widget no-ops.
      return;
    }
    if (ev.type === 'agent_warmed') {
      // Phase A done: voice-agent has joined the room + published an empty
      // track. We don't change UI here (visitor hasn't clicked yet) — this
      // is purely telemetry/sequencing for the two-phase agent split.
      return;
    }
    if (ev.type === 'agent_ready') {
      // Voice-agent says Gemini WS is open + Sage's audio track is published.
      // Flip the tray immediately so the visitor stops staring at CONNECTING.
      this.voiceMode.signalAgentReady?.();
      return;
    }
    this.store.dispatch({ type: 'agent_event', event: ev });
    if (ev.type === 'say') void this.voiceMode.speak(ev.text);
  }

  private publishWidgetMessage(
    msg: import('./transport/codec.js').WidgetMessage,
    origin: 'ws' | 'livekit' = 'ws',
  ): void {
    const encoded = encodeWidgetMessage(msg);
    if (origin === 'livekit' && this.voiceMode.publishData) {
      // host_action_request came in over the LiveKit data channel from the
      // voice-agent's bridge, so the result must land in the voice-agent's
      // pending map — not the api WS pending map. Encode the same WidgetMessage
      // and ship the bytes over LiveKit.
      const bytes = new TextEncoder().encode(encoded);
      void this.voiceMode.publishData(bytes);
      return;
    }
    this.socket?.send(encoded);
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
        personaName: this.persona.name,
        voiceError: s.voiceError,
        onClose: () => this.store.dispatch({ type: 'set_mode', mode: 'pill' }),
        onCardTap: (p) => this.cardTap(p),
        onCheckout: () => {},
      });
    } else if (s.mode === 'chat' || s.mode === 'expanded') {
      renderChat(this.panelHost, {
        transcript: s.transcript,
        checkoutUrl: s.checkoutUrl,
        personaName: this.persona.name,
        personaInitial: this.persona.initial,
        personaAvatarUrl: this.persona.avatarUrl,
        onSend: (text) => this.userText(text, 'text'),
        onCall: () => this.openCall(),
        onClose: () => this.store.dispatch({ type: 'set_mode', mode: 'pill' }),
        onCardTap: (p) => this.cardTap(p),
        closed: s.closed,
      });
    } else {
      this.panelHost.innerHTML = '';
    }
    renderPill(this.pillHost, {
      mode: s.mode,
      callable,
      voiceState: s.voiceState,
      connection: s.connection,
      voiceError: s.voiceError,
      invited: s.invited,
      personaName: this.persona.name,
      personaInitial: this.persona.initial,
      personaAvatarUrl: this.persona.avatarUrl,
      onCall: () => this.openCall(),
      onMute: (next) => this.voiceMode.setMuted(next),
      onEnd: () => {
        this.voiceMode.stop();
        this.ambience.stop();
        this.store.dispatch({ type: 'set_mode', mode: 'pill' });
      },
      onChat: () => {
        // Opening text chat also dismisses any pending "incoming call" invite
        // so the pill doesn't keep ringing behind the open panel.
        if (s.invited) this.store.dispatch({ type: 'set_invited', invited: false });
        this.store.dispatch({ type: 'set_mode', mode: 'chat' });
      },
      onClose: () => this.store.dispatch({ type: 'set_mode', mode: 'pill' }),
    });
  }

  private openCall() {
    // Accepting a proactive invite also asks Sage to run the guided tour
    // (preserves the retired soft-prompt's tour_request). Clear the invite so
    // the launcher leaves the INCOMING CALL state as the call begins.
    if (this.store.get().invited) {
      // The guided tour is demo-only. Real merchants (Calmosis) accept the
      // invite straight into a normal call — no tour_request.
      if (this.merchantId === DEMO_MERCHANT_ID) {
        this.publishWidgetMessage({ type: 'tour_request' });
      }
      this.store.dispatch({ type: 'set_invited', invited: false });
    }
    if (this.inviteTimer) {
      clearTimeout(this.inviteTimer);
      this.inviteTimer = null;
    }
    this.store.dispatch({ type: 'set_mode', mode: 'call' });
    this.voiceMode.start();
    this.ambience.start();
  }

  private userText(text: string, mode: 'voice' | 'text') {
    this.store.dispatch({ type: 'user_input', text, mode });
    const sid = this.store.get().sessionId;
    this.socket?.send(
      encodeWidgetMessage({
        type: 'user_text',
        sessionId: sid,
        text,
        mode,
        visitorId: getOrCreateVisitorId(),
      }),
    );
  }

  private handleLiveKitData(bytes: Uint8Array) {
    // LiveKit data channel carries server-published JSON events from the
    // voice-agent (user_text echo, say, cards, checkout_redirect,
    // host_action_request). Decode and route, tagging origin so any
    // widget→agent reply (host_action_result) goes back over LiveKit
    // instead of the api WS.
    let raw: string;
    try {
      raw = new TextDecoder().decode(bytes);
    } catch {
      return;
    }
    const ev = decodeAgentEvent(raw);
    if (!ev) return;
    void this.handleAgentEvent(ev, 'livekit');
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
