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
  };
  disconnect: () => Promise<void>;
};

// Cache the dynamic import promise so subsequent callers share the network
// request. Without this, calling preloadLiveKit() at widget init then again
// at start() would either race or re-fetch. The promise itself is the cache.
let _livekitImport: Promise<{ Room: new () => RoomShape }> | null = null;

function loadLiveKit(): Promise<{ Room: new () => RoomShape }> {
  if (_livekitImport) return _livekitImport;
  if (typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__ === 'function') {
    _livekitImport = globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__() as Promise<{
      Room: new () => RoomShape;
    }>;
    return _livekitImport;
  }
  const url = `${DEFAULT_CDN_BASE}/livekit-client@${DEFAULT_VERSION}/dist/livekit-client.esm.mjs`;
  _livekitImport = import(/* @vite-ignore */ url) as Promise<{
    Room: new () => RoomShape;
  }>;
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

export async function connectToRoom(opts: {
  wsUrl: string;
  token: string;
  roomName: string;
}): Promise<LiveKitHandle> {
  const lk = await loadLiveKit();
  const room = new lk.Room();

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
    setMicEnabled: (enabled) => room.localParticipant.setMicrophoneEnabled(enabled),
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
