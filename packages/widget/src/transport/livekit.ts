const DEFAULT_CDN_BASE = 'https://cdn.shoppingmate.ai/vendor';
const DEFAULT_VERSION = '2.7.0';

declare global {
  // eslint-disable-next-line no-var
  var __SHOPPINGMATE_LIVEKIT_LOADER__: (() => Promise<unknown>) | undefined;
}

export type LiveKitHandle = {
  setMicEnabled: (enabled: boolean) => Promise<void>;
  onData: (cb: (bytes: Uint8Array) => void) => void;
  disconnect: () => Promise<void>;
};

type RoomShape = {
  connect: (url: string, token: string) => Promise<void>;
  on: (ev: string, cb: (...args: unknown[]) => void) => void;
  localParticipant: { setMicrophoneEnabled: (b: boolean) => Promise<void> };
  disconnect: () => Promise<void>;
};

async function loadLiveKit(): Promise<{ Room: new () => RoomShape }> {
  if (typeof globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__ === 'function') {
    return (await globalThis.__SHOPPINGMATE_LIVEKIT_LOADER__()) as {
      Room: new () => RoomShape;
    };
  }
  const url = `${DEFAULT_CDN_BASE}/livekit-client@${DEFAULT_VERSION}/dist/livekit-client.esm.min.js`;
  return (await import(/* @vite-ignore */ url)) as { Room: new () => RoomShape };
}

export async function connectToRoom(opts: {
  wsUrl: string;
  token: string;
  roomName: string;
}): Promise<LiveKitHandle> {
  const lk = await loadLiveKit();
  const room = new lk.Room();
  await room.connect(opts.wsUrl, opts.token);
  return {
    setMicEnabled: (enabled) => room.localParticipant.setMicrophoneEnabled(enabled),
    onData: (cb) => {
      room.on('dataReceived', (payload: unknown) => {
        if (payload instanceof Uint8Array) cb(payload);
      });
    },
    disconnect: () => room.disconnect(),
  };
}
