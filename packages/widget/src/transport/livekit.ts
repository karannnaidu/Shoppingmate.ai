const DEFAULT_CDN_BASE = 'https://cdn.jsdelivr.net/npm';
const DEFAULT_VERSION = '2.7.0';

declare global {
  // eslint-disable-next-line no-var
  var __SHOPPINGMATE_LIVEKIT_LOADER__: (() => Promise<unknown>) | undefined;
}

export type LiveKitHandle = {
  setMicEnabled: (enabled: boolean) => Promise<void>;
  // Mute/unmute the BOT's audio playback (so muting the mic also silences Sage).
  setAgentAudioMuted: (muted: boolean) => void;
  onData: (cb: (bytes: Uint8Array) => void) => void;
  onAgentSpeaking: (cb: (speaking: boolean) => void) => void;
  // Fires after LiveKit auto-reconnects the room (mobile network blip, or the
  // voice-agent worker restarting). On reconnect LiveKit dispatches a NEW agent
  // job that waits for start_voice — so the caller must re-send it or the bot
  // hangs silent. See voiceModeLiveKit.
  onReconnected: (cb: () => void) => void;
  publishData: (bytes: Uint8Array) => Promise<void>;
  disconnect: () => Promise<void>;
};

type RemoteTrackShape = {
  kind: string;
  attach: () => HTMLMediaElement;
  detach: () => HTMLMediaElement[];
};

type RoomShape = {
  connect: (url: string, token: string) => Promise<void>;
  on: (ev: string, cb: (...args: unknown[]) => void) => void;
  localParticipant: {
    setMicrophoneEnabled: (b: boolean) => Promise<void>;
    publishData: (bytes: Uint8Array, opts?: { reliable?: boolean }) => Promise<void>;
    getTrackPublication?: (source: string) =>
      | { audioTrack?: TrackWithProcessor; track?: TrackWithProcessor }
      | undefined;
  };
  disconnect: () => Promise<void>;
};

type TrackWithProcessor = { setProcessor?: (p: unknown) => Promise<void> };

// Krisp AI noise filter — far better and more consistent across devices (esp.
// mobile, where the browser's native noiseSuppression is weak/ignored) than the
// getUserMedia constraints. Lazy-loaded from CDN and applied to the mic track.
// ANY failure (unsupported device, load/WASM error) is a SILENT no-op that
// leaves the browser-native cleanup in place — so it can never break voice.
const KRISP_VERSION = '0.3.0';
type KrispModule = { KrispNoiseFilter: () => unknown; isKrispNoiseFilterSupported?: () => boolean };
let _krispImport: Promise<KrispModule | null> | null = null;
function loadKrisp(): Promise<KrispModule | null> {
  if (_krispImport) return _krispImport;
  const url = `${DEFAULT_CDN_BASE}/@livekit/krisp-noise-filter@${KRISP_VERSION}/dist/index.mjs`;
  _krispImport = (import(/* @vite-ignore */ url) as Promise<KrispModule>).catch(() => null);
  return _krispImport;
}
async function applyKrisp(room: RoomShape): Promise<void> {
  const mod = await loadKrisp();
  if (!mod?.KrispNoiseFilter) return;
  if (mod.isKrispNoiseFilterSupported && !mod.isKrispNoiseFilterSupported()) return;
  const pub = room.localParticipant.getTrackPublication?.('microphone');
  const track = pub?.audioTrack ?? pub?.track;
  if (track?.setProcessor) await track.setProcessor(mod.KrispNoiseFilter());
}

// Cache the dynamic import promise so subsequent callers share the network
// request. Without this, calling preloadLiveKit() at widget init then again
// at start() would either race or re-fetch. The promise itself is the cache.
// Room ctor accepts RoomOptions; we pass audioCaptureDefaults to turn on the
// browser's audio cleanup (see connectToRoom). Typed loosely — we only use this
// one option.
type RoomOpts = {
  audioCaptureDefaults?: {
    echoCancellation?: boolean;
    noiseSuppression?: boolean;
    autoGainControl?: boolean;
    channelCount?: number;
  };
};
type RoomCtor = { Room: new (opts?: RoomOpts) => RoomShape };

let _livekitImport: Promise<RoomCtor> | null = null;

function loadLiveKit(): Promise<RoomCtor> {
  if (_livekitImport) return _livekitImport;
  if (typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__ === 'function') {
    _livekitImport = globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__() as Promise<RoomCtor>;
    return _livekitImport;
  }
  const url = `${DEFAULT_CDN_BASE}/livekit-client@${DEFAULT_VERSION}/dist/livekit-client.esm.mjs`;
  _livekitImport = import(/* @vite-ignore */ url) as Promise<RoomCtor>;
  return _livekitImport;
}

// Kick off the livekit-client CDN fetch as soon as the widget mounts so the
// ~500-1500ms ESM import doesn't happen on the click→CONNECTING path. Idempotent.
export function preloadLiveKit(): void {
  void loadLiveKit().catch(() => {
    // Network might be flaky; we'll just re-attempt at start() time.
    _livekitImport = null;
  });
}

// Heavier mic pipeline (autoGainControl + Krisp ML noise filter). ON by default
// as of 2026-06-23: a soft / accented "hey Calmio" was under-picked-up under the
// lean pipeline. AGC normalizes loudness so quiet/distant speech is still
// captured cleanly; Krisp strips ambient noise more aggressively than the
// browser's native suppression. This reverses the 2026-06-21 default-off stance
// (AGC/Krisp were found to over-process accented speech) — being A/B'd live.
// Toggle OFF per-call with NO redeploy if it degrades transcription:
// `?smAudioFull=0` on the page URL, or `window.__SM_AUDIO_FULL__ = false`.
function audioFullRequested(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const w = window as { __SM_AUDIO_FULL__?: boolean };
      if (typeof w.__SM_AUDIO_FULL__ === 'boolean') return w.__SM_AUDIO_FULL__;
    }
    const q = new URLSearchParams(location.search).get('smAudioFull');
    if (q === '0' || q === 'false') return false;
    // Default ON (any other value, including absent, enables the heavier pipeline).
    return true;
  } catch {
    return true;
  }
}

export async function connectToRoom(opts: {
  wsUrl: string;
  token: string;
  roomName: string;
}): Promise<LiveKitHandle> {
  const lk = await loadLiveKit();
  // Mic capture cleanup. echoCancellation + noiseSuppression + mono are ESSENTIAL
  // for clean STT (echoCancellation stops the bot transcribing its own voice;
  // noiseSuppression cuts ambient noise; mono keeps it simple). autoGainControl
  // is now ON by default (2026-06-23) so soft/distant speech is normalized up
  // and actually picked up — see audioFullRequested(). Disable per-call with
  // `?smAudioFull=0` if AGC over-processes accented speech.
  const audioFull = audioFullRequested();
  const room = new lk.Room({
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: audioFull,
      channelCount: 1,
    },
  });

  // Attach Sage's audio as soon as it arrives. livekit-client doesn't auto-play
  // remote tracks — it returns an HTMLMediaElement from attach() that must be
  // appended somewhere visible-or-not for the browser to actually play it.
  // We park the <audio> element on document.body (display:none) so policies
  // that gate playback behind a user gesture still apply correctly (the
  // start() click that opened the call counts as the gesture).
  const attached = new Map<unknown, HTMLMediaElement>();
  // When the visitor mutes, they should NOT hear the bot either — mute the
  // agent's audio playback, not just our mic. Applied to current + future tracks.
  let agentAudioMuted = false;
  room.on('trackSubscribed', (track: unknown) => {
    const t = track as RemoteTrackShape;
    if (t.kind !== 'audio') return;
    const el = t.attach();
    el.style.display = 'none';
    el.muted = agentAudioMuted;
    document.body.appendChild(el);
    attached.set(track, el);
  });
  room.on('trackUnsubscribed', (track: unknown) => {
    const el = attached.get(track);
    if (el) {
      el.remove();
      attached.delete(track);
    }
    (track as RemoteTrackShape).detach?.();
  });

  // Speaker activity drives the listening/speaking waveform. activeSpeakers
  // includes both local and remote participants; we surface remote-only.
  const speakingListeners: ((s: boolean) => void)[] = [];
  room.on('activeSpeakersChanged', (speakers: unknown) => {
    const list = (speakers ?? []) as { isLocal?: boolean }[];
    const remoteSpeaking = list.some((p) => !p.isLocal);
    for (const cb of speakingListeners) cb(remoteSpeaking);
  });

  await room.connect(opts.wsUrl, opts.token);
  return {
    setMicEnabled: async (enabled) => {
      await room.localParticipant.setMicrophoneEnabled(enabled);
      // Krisp ML noise filter is ON by default as of 2026-06-23 (part of the
      // heavier pipeline). Disable per-call via `?smAudioFull=0` if it distorts
      // accented speech; the browser's native NS remains as the fallback.
      if (enabled && audioFull) void applyKrisp(room).catch(() => { /* no-op: browser NS remains */ });
    },
    onData: (cb) => {
      room.on('dataReceived', (payload: unknown) => {
        if (payload instanceof Uint8Array) cb(payload);
      });
    },
    onAgentSpeaking: (cb) => {
      speakingListeners.push(cb);
    },
    setAgentAudioMuted: (m) => {
      agentAudioMuted = m;
      for (const el of attached.values()) el.muted = m;
    },
    onReconnected: (cb) => {
      room.on('reconnected', () => cb());
    },
    publishData: (bytes) => room.localParticipant.publishData(bytes, { reliable: true }),
    disconnect: async () => {
      for (const el of attached.values()) el.remove();
      attached.clear();
      await room.disconnect();
    },
  };
}
