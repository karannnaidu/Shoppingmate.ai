import type { DataChannelMessage } from './bridge.js';

export type DataChannel = {
  publish: (msg: DataChannelMessage) => void;
};

export function createDataChannel(opts: {
  publish: (data: Uint8Array, opts: { reliable: boolean }) => void;
}): DataChannel {
  return {
    publish(msg) {
      const bytes = new TextEncoder().encode(JSON.stringify(msg));
      opts.publish(bytes, { reliable: true });
    },
  };
}
