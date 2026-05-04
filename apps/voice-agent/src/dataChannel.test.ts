import { describe, expect, it, vi } from 'vitest';
import type { DataChannelMessage } from './bridge.js';
import { createDataChannel } from './dataChannel.js';

describe('createDataChannel', () => {
  it('JSON-encodes messages and pushes to the room publisher', () => {
    const publish = vi.fn();
    const ch = createDataChannel({ publish });
    const msg: DataChannelMessage = { type: 'say', text: 'Hi.' };
    ch.publish(msg);
    expect(publish).toHaveBeenCalledOnce();
    const call = publish.mock.calls[0]!;
    const bytes = call[0] as Uint8Array;
    const opts = call[1] as { reliable: boolean };
    expect(opts).toMatchObject({ reliable: true });
    const decoded = JSON.parse(new TextDecoder().decode(bytes));
    expect(decoded).toEqual({ type: 'say', text: 'Hi.' });
  });

  it('handles user_text payloads', () => {
    const publish = vi.fn();
    const ch = createDataChannel({ publish });
    ch.publish({ type: 'user_text', text: 'hello' });
    const bytes = publish.mock.calls[0]![0] as Uint8Array;
    const decoded = JSON.parse(new TextDecoder().decode(bytes));
    expect(decoded.text).toBe('hello');
  });
});
