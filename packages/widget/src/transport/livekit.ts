const DEFAULT_CDN_BASE = 'https://cdn.jsdelivr.net/npm';
const DEFAULT_VERSION = '2.7.0';

declare global {
  // eslint-disable-next-line no-var
  var __SHOPPINGMATE_LIVEKIT_LOADER__: (() => Promise<unknown>) | undefined;
}

export type LiveKitHandle = {
  setMicEnabled: (enabled: boolean) => Promise<void>;
  onData: (cb: (bytes: Uint8Array) => void) => void;
  onAgentSpeaking: (cb: (speaking: boolean) => void) => void;
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

// Opt-in to the heavier mic pipeline (autoGainControl + Krisp) for noisy rooms.
// Checked at call-connect time so it can be toggled per-call with no redeploy:
// `?smAudioFull=1` on the page URL, or `window.__SM_AUDIO_FULL__ = true`.
function audioFullRequested(): boolean {
  try {
    if (typeof window !== 'undefined' && (window as { __SM_AUDIO_FULL__?: boolean }).__SM_AUDIO_FULL__) {
      return true;
    }
    const q = new URLSearchParams(location.search).get('smAudioFull');
    return q === '1' || q === 'true';
  } catch {
    return false;
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
  // and the Krisp ML filter, however, were found to OVER-process accented /
  // code-switched speech and DEGRADE Gemini's transcription (garbled names &
  // emails — 2026-06-21 report), so they are OFF by default. To restore the
  // heavier pipeline for very noisy environments, add `?smAudioFull=1` to the
  // page URL or set `window.__SM_AUDIO_FULL__ = true` before the widget loads.
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
  room.on('trackSubscribed', (track: unknown) => {
    const t = track as RemoteTrackShape;
    if (t.kind !== 'audio') return;
    const el = t.attach();
    el.style.display = 'none';
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
      // Krisp ML noise filter is OFF by default (it can distort accented speech
      // and hurt transcription); only apply it when the heavier pipeline is
      // explicitly requested via the `smAudioFull` flag (noisy-environment opt-in).
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
    publishData: (bytes) => room.localParticipant.publishData(bytes, { reliable: true }),
    disconnect: async () => {
      for (const el of attached.values()) el.remove();
      attached.clear();
      await room.disconnect();
    },
  };
}
