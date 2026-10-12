import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { signVoiceToken } from '@shoppingmate/shared';
import WebSocket from 'ws';
import type { VoiceRoom } from './voiceRoom.js';
import { startVoiceWsServer } from './wsServer.js';

const PORT = 18_000 + Math.floor(Math.random() * 1000);
const SECRET = 'test-secret';
const seen: { room?: VoiceRoom; mic: number[]; data: string[]; shutdown: boolean; closed: boolean } = {
  mic: [],
  data: [],
  shutdown: false,
  closed: false,
};

beforeAll(async () => {
  process.env.VOICE_WS_SECRET = SECRET;
  process.env.VOICE_WS_PORT = String(PORT);
  startVoiceWsServer(async (room) => {
    seen.room = room;
    room.onMicAudio((b) => seen.mic.push(b.byteLength));
    room.onData((b) => {
      const msg = new TextDecoder().decode(b);
      seen.data.push(msg);
      if (JSON.parse(msg).type === 'start_voice') {
        room.publishData(new TextEncoder().encode(JSON.stringify({ type: 'agent_ready' })));
        void room.playAudio(new Int16Array([1, 2, 3, 4]));
        room.clearAudio();
      }
    });
    room.onDisconnected(() => {
      seen.closed = true;
    });
    room.addShutdownCallback(async () => {
      seen.shutdown = true;
    });
  });
  await new Promise((r) => setTimeout(r, 300));
});
afterAll(() => {
  delete process.env.VOICE_WS_SECRET;
});

describe('WebSocket voice transport', () => {
  it('rejects a bad token', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/v1/voice?token=nope`);
    const err = await new Promise<string>((r) => ws.on('unexpected-response', (_req, res) => r(String(res.statusCode))));
    expect(err).toBe('401');
  });

  it('carries mic audio + messages in, bot audio + events out, and tears down', async () => {
    const token = signVoiceToken({ sessionId: 'ws_abc', merchantId: 'SM-2SCCLZ' }, SECRET);
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/v1/voice?token=${token}`);
    const texts: string[] = [];
    const binaries: number[] = [];
    ws.on('message', (d, isBinary) => (isBinary ? binaries.push((d as Buffer).length) : texts.push(String(d))));
    await new Promise((r) => ws.on('open', r));
    ws.send(Buffer.alloc(640), { binary: true }); // 20 ms of 16 kHz PCM16
    ws.send(Buffer.alloc(3), { binary: true }); // odd length — dropped
    ws.send(JSON.stringify({ type: 'start_voice', sessionId: 'ws_abc' }));
    await new Promise((r) => setTimeout(r, 300));
    expect(seen.room?.sessionId).toBe('ws_abc');
    expect(seen.mic).toEqual([640]);
    expect(texts.map((t) => JSON.parse(t).type)).toEqual(['agent_ready', 'audio_clear']);
    expect(binaries).toEqual([8]);
    ws.close();
    await new Promise((r) => setTimeout(r, 300));
    expect(seen.closed).toBe(true);
    expect(seen.shutdown).toBe(true);
  });
});
