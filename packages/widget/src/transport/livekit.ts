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

async function loadLiveKit(): Promise<{ Room: new () => RoomShape }> {
  if (typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__ === 'function') {
    return (await globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__()) as {
      Room: new () => RoomShape;
    };
  }
  const url = `${DEFAULT_CDN_BASE}/livekit-client@${DEFAULT_VERSION}/dist/livekit-client.esm.mjs`;
  return (await import(/* @vite-ignore */ url)) as { Room: new () => RoomShape };
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
