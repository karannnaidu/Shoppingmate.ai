import { createServer } from 'node:http';
import { childLogger, verifyVoiceToken } from '@shoppingmate/shared';
import { type WebSocket, WebSocketServer } from 'ws';
import type { VoiceRoom } from './voiceRoom.js';

// Our own voice transport — replaces LiveKit for merchants in
// VOICE_WS_MERCHANTS. One WebSocket per call:
//   browser → server  binary: visitor mic, 16 kHz mono PCM16
//                     text:   widget JSON messages (start_voice, host_action_result, …)
//   server → browser  binary: Olivia's voice, 24 kHz mono PCM16
//                     text:   agent JSON events, plus {"type":"audio_clear"} on barge-in
// Runs inside the voice-agent process next to the LiveKit worker.

const log = childLogger({ mod: 'voice-ws' });
const MAX_MIC_FRAME = 64 * 1024;

type RunSession = (room: VoiceRoom, t: { tEntry: number; tConnected: number }) => Promise<void>;

export function createWsVoiceRoom(ws: WebSocket, sessionId: string): VoiceRoom {
  const dataCbs: Array<(b: Uint8Array) => void> = [];
  const micCbs: Array<(b: Uint8Array) => void> = [];
  const closeCbs: Array<() => void> = [];
  const shutdownCbs: Array<() => Promise<void>> = [];
  let closed = false;

  ws.on('message', (data, isBinary) => {
    const buf = Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data as ArrayBuffer);
    if (isBinary) {
      if (buf.length === 0 || buf.length > MAX_MIC_FRAME || buf.length % 2 !== 0) return;
      const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      for (const cb of micCbs) cb(bytes);
    } else {
      const bytes = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      for (const cb of dataCbs) cb(bytes);
    }
  });
  ws.on('close', () => {
    if (closed) return;
    closed = true;
    for (const cb of closeCbs) {
      try {
        cb();
      } catch (err) {
        log.warn({ err: (err as Error).message }, 'close handler failed');
      }
    }
    void (async () => {
      for (const cb of shutdownCbs) await cb().catch((err) => log.warn({ err: (err as Error).message }, 'shutdown cb failed'));
    })();
  });

  const sendText = (s: string) => {
    if (ws.readyState === ws.OPEN) ws.send(s);
  };
  return {
    transport: 'ws',
    sessionId,
    publishData(bytes) {
      sendText(Buffer.from(bytes).toString('utf8'));
    },
    onData(cb) {
      dataCbs.push(cb);
    },
    async prepareAudioOut() {
      // Nothing to publish: audio goes straight down this socket.
    },
    async playAudio(pcm) {
      if (ws.readyState !== ws.OPEN) return;
      ws.send(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength), { binary: true });
    },
    clearAudio() {
      // The browser holds the playback queue — tell it to drop what's unheard.
      sendText(JSON.stringify({ type: 'audio_clear' }));
    },
    onMicAudio(cb) {
      micCbs.push(cb);
    },
    onVisitorSpeaking() {
      // Gemini's own voice-activity detection handles barge-in here.
    },
    async disconnect() {
      if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) ws.close(1000, 'bye');
    },
    onDisconnected(cb) {
      closeCbs.push(cb);
    },
    addShutdownCallback(cb) {
      shutdownCbs.push(cb);
    },
  };
}

export function startVoiceWsServer(run: RunSession): void {
  const secret = process.env.VOICE_WS_SECRET?.trim() ?? '';
  const port = Number(process.env.VOICE_WS_PORT ?? process.env.PORT ?? 8080);
  if (!secret) {
    log.warn('VOICE_WS_SECRET not set — WebSocket voice transport disabled');
    return;
  }
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      return;
    }
    res.writeHead(404).end();
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MIC_FRAME * 4 });

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const claims = url.pathname === '/v1/voice' ? verifyVoiceToken(url.searchParams.get('token') ?? '', secret) : null;
    if (!claims) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      const tEntry = Date.now();
      const room = createWsVoiceRoom(ws, claims.sessionId);
      // Heartbeat: drop dead sockets (phones that lost signal) so the call ends.
      let alive = true;
      ws.on('pong', () => {
        alive = true;
      });
      const hb = setInterval(() => {
        if (!alive) {
          ws.terminate();
          return;
        }
        alive = false;
        ws.ping();
      }, 15_000);
      ws.on('close', () => clearInterval(hb));
      log.info({ sessionId: claims.sessionId, merchantId: claims.merchantId }, 'voice ws connected');
      run(room, { tEntry, tConnected: Date.now() }).catch((err) => {
        log.error({ err: (err as Error).message, sessionId: claims.sessionId }, 'voice session crashed');
        ws.close(1011, 'error');
      });
    });
  });

  server.listen(port, () => log.info({ port }, 'voice WebSocket server listening'));
}
