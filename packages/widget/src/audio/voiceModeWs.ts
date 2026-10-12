import { encodeWidgetMessage } from '../transport/codec.js';
import type { VoiceMode, VoiceModeState } from './voiceModeWebSpeech.js';

// Voice over our own WebSocket (replaces LiveKit for merchants switched to it).
//   up:   visitor mic → 16 kHz mono PCM16 binary frames (+ JSON widget messages)
//   down: Olivia → 24 kHz mono PCM16 binary frames (+ JSON agent events,
//         {"type":"audio_clear"} = barge-in, drop what's queued)
// Mic uses the browser's echo cancellation; playback goes through an <audio>
// element (not straight to the speakers) because Chrome's echo canceller only
// "hears" media-element/WebRTC output — otherwise Olivia would interrupt herself.

const IN_RATE = 16_000;
const OUT_RATE = 24_000;
const SEND_SAMPLES = 640; // 40 ms per frame up
const WARM_IDLE_MS = 60_000;

// Resampler to 16 kHz, run in an AudioWorklet (off the main thread). Box-filter
// decimation: averages the input samples that fall into each output sample.
const WORKLET = `class SmCap extends AudioWorkletProcessor {
  constructor(){super();this.r=sampleRate/${IN_RATE};this.acc=0;this.n=0;this.pos=0;}
  process(inputs){const ch=inputs[0]&&inputs[0][0];if(!ch)return true;const out=[];
    for(let i=0;i<ch.length;i++){this.acc+=ch[i];this.n++;this.pos+=1;
      if(this.pos>=this.r){out.push(this.acc/this.n);this.acc=0;this.n=0;this.pos-=this.r;}}
    if(out.length)this.port.postMessage(new Float32Array(out));return true;}}
registerProcessor('sm-cap',SmCap);`;

type Ctx = AudioContext;

export function createVoiceModeWs(opts: {
  sessionId: string;
  url: string;
  onAgentEvent: (raw: Uint8Array) => void;
}): VoiceMode {
  let state: VoiceModeState = 'idle';
  let muted = false;
  let started = false;
  let ws: WebSocket | null = null;
  let openP: Promise<WebSocket> | null = null;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let ctx: Ctx | null = null;
  let outGain: GainNode | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let mic: MediaStream | null = null;
  let capNode: AudioWorkletNode | ScriptProcessorNode | null = null;
  let pending: number[] = [];
  let nextTime = 0;
  const playing = new Set<AudioBufferSourceNode>();
  const listeners: ((s: VoiceModeState) => void)[] = [];
  const errorListeners: ((info: { code: string; message: string }) => void)[] = [];

  // Call-startup timings (ms since the tap), reported once per call.
  let tTap = 0;
  let timings: Record<string, number> | null = null;
  const mark = (k: string) => {
    if (timings && !(k in timings)) timings[k] = Math.round(performance.now() - tTap);
  };
  const reportTimings = () => {
    if (!timings) return;
    sendJson(encodeWidgetMessage({ type: 'voice_timing', sessionId: opts.sessionId, timings: { ...timings, transport_ws: 1 } }));
    timings = null;
  };

  const set = (s: VoiceModeState) => {
    if (state === s) return;
    state = s;
    for (const cb of listeners) cb(s);
  };
  const emitError = (code: string, message: string) => {
    for (const cb of errorListeners) cb({ code, message });
  };
  const sendJson = (s: string) => {
    if (ws?.readyState === WebSocket.OPEN) ws.send(s);
  };
  const clearIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = null;
  };
  const armIdle = () => {
    clearIdle();
    if (started) return;
    idleTimer = setTimeout(() => {
      if (!started) closeSocket();
    }, WARM_IDLE_MS);
  };
  const closeSocket = () => {
    clearIdle();
    const s = ws;
    ws = null;
    openP = null;
    try {
      s?.close(1000);
    } catch {
      /* already closed */
    }
  };

  // ---- playback -----------------------------------------------------------
  const ensureCtx = (): Ctx => {
    if (ctx) return ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    outGain = ctx.createGain();
    try {
      const dest = ctx.createMediaStreamDestination();
      outGain.connect(dest);
      audioEl = new Audio();
      audioEl.autoplay = true;
      audioEl.srcObject = dest.stream;
    } catch {
      outGain.connect(ctx.destination); // very old browsers
    }
    return ctx;
  };
  const clearPlayback = () => {
    for (const src of playing) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    playing.clear();
    nextTime = 0;
    if (state === 'speaking') set(muted ? 'muted' : 'listening');
  };
  const enqueue = (buf: ArrayBuffer) => {
    if (!ctx || !outGain) return;
    const pcm = new Int16Array(buf);
    if (pcm.length === 0) return;
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = (pcm[i] as number) / 32768;
    const ab = ctx.createBuffer(1, f.length, OUT_RATE);
    ab.copyToChannel(f, 0);
    const src = ctx.createBufferSource();
    src.buffer = ab;
    src.connect(outGain);
    const at = Math.max(ctx.currentTime + 0.04, nextTime);
    src.start(at);
    nextTime = at + ab.duration;
    playing.add(src);
    if (!muted) set('speaking');
    if (timings && !('first_audio' in timings)) {
      mark('first_audio');
      reportTimings();
    }
    src.onended = () => {
      playing.delete(src);
      if (playing.size === 0 && state === 'speaking') set('listening');
    };
  };

  // ---- socket ---------------------------------------------------------------
  const open = (): Promise<WebSocket> => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      armIdle();
      return Promise.resolve(ws);
    }
    if (openP) return openP;
    openP = new Promise<WebSocket>((resolve, reject) => {
      const s = new WebSocket(opts.url);
      s.binaryType = 'arraybuffer';
      s.onopen = () => {
        ws = s;
        armIdle();
        resolve(s);
      };
      s.onerror = () => reject(new Error('voice websocket connect failed'));
      s.onmessage = (ev) => {
        if (ev.data instanceof ArrayBuffer) {
          enqueue(ev.data);
          return;
        }
        const text = String(ev.data);
        if (text.includes('"audio_clear"')) {
          clearPlayback();
          return;
        }
        opts.onAgentEvent(new TextEncoder().encode(text));
      };
      s.onclose = () => {
        if (ws === s) ws = null;
        openP = null;
        if (started) {
          // Call dropped (network / server). Tell the panel; the visitor can tap again.
          started = false;
          stopMic();
          clearPlayback();
          set('idle');
          emitError('connect_failed', 'voice connection closed');
        }
      };
    });
    openP.catch(() => {
      openP = null;
    });
    return openP;
  };

  // ---- mic ------------------------------------------------------------------
  const sendPcm = (f: Float32Array) => {
    if (muted || !ws || ws.readyState !== WebSocket.OPEN) return;
    for (let i = 0; i < f.length; i++) pending.push(f[i] as number);
    while (pending.length >= SEND_SAMPLES) {
      const chunk = pending.splice(0, SEND_SAMPLES);
      const out = new Int16Array(SEND_SAMPLES);
      for (let i = 0; i < SEND_SAMPLES; i++) {
        const v = Math.max(-1, Math.min(1, chunk[i] as number));
        out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      ws.send(out.buffer);
    }
  };
  // Load the capture worklet ahead of the tap (during warm-up): it took ~1.5s
  // of the tap → mic-on time when loaded on click. A context created before a
  // gesture starts suspended, which is fine for loading; start() resumes it.
  let workletP: Promise<boolean> | null = null;
  const loadWorklet = (c: Ctx): Promise<boolean> => {
    if (workletP) return workletP;
    workletP = (async () => {
      try {
        const url = URL.createObjectURL(new Blob([WORKLET], { type: 'application/javascript' }));
        await c.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);
        return true;
      } catch {
        return false; // strict CSP: ScriptProcessor fallback
      }
    })();
    return workletP;
  };
  const startMic = async (c: Ctx) => {
    const [stream, hasWorklet] = await Promise.all([
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      }),
      loadWorklet(c),
    ]);
    mic = stream;
    const source = c.createMediaStreamSource(mic);
    try {
      if (!hasWorklet) throw new Error('no worklet');
      const node = new AudioWorkletNode(c, 'sm-cap');
      node.port.onmessage = (e: MessageEvent<Float32Array>) => sendPcm(e.data);
      source.connect(node);
      capNode = node;
    } catch {
      // Sites whose CSP blocks blob: worklets: main-thread fallback.
      const proc = c.createScriptProcessor(2048, 1, 1);
      const ratio = c.sampleRate / IN_RATE;
      let acc = 0;
      let n = 0;
      let pos = 0;
      proc.onaudioprocess = (e) => {
        const ch = e.inputBuffer.getChannelData(0);
        const out: number[] = [];
        for (let i = 0; i < ch.length; i++) {
          acc += ch[i] as number;
          n++;
          pos += 1;
          if (pos >= ratio) {
            out.push(acc / n);
            acc = 0;
            n = 0;
            pos -= ratio;
          }
        }
        sendPcm(new Float32Array(out));
      };
      source.connect(proc);
      // ScriptProcessor only runs when connected to the output — through a muted gain.
      const sink = c.createGain();
      sink.gain.value = 0;
      proc.connect(sink);
      sink.connect(c.destination);
      capNode = proc;
    }
  };
  const stopMic = () => {
    try {
      capNode?.disconnect();
    } catch {
      /* ignore */
    }
    capNode = null;
    for (const t of mic?.getTracks() ?? []) t.stop();
    mic = null;
    pending = [];
  };

  const classify = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : '';
    if (/permissions? policy|feature policy/i.test(message)) return 'mic_policy_blocked';
    if (name === 'NotAllowedError' || /denied|permission/i.test(message)) return 'mic_denied';
    if (name === 'NotFoundError' || /no.*microphone|not.*found/i.test(message)) return 'mic_unavailable';
    if (/connect|network|websocket|timeout/i.test(message)) return 'connect_failed';
    return 'unknown';
  };

  return {
    warm: () => {
      open().catch((err) => console.warn('[voiceModeWs] warm failed', err));
      try {
        void loadWorklet(ensureCtx());
      } catch {
        /* no Web Audio — start() will report it */
      }
    },
    start: () => {
      if (state !== 'idle') return;
      set('connecting');
      clearIdle();
      tTap = performance.now();
      timings = { was_warm: ws?.readyState === WebSocket.OPEN ? 1 : 0 };
      // Create/resume audio + start the <audio> sink INSIDE the tap (autoplay rules).
      const c = ensureCtx();
      void c.resume();
      void audioEl?.play().catch(() => {});
      (async () => {
        try {
          await open();
          mark('room_connected');
          await startMic(c);
          mark('mic_on');
          started = true;
          sendJson(encodeWidgetMessage({ type: 'start_voice', sessionId: opts.sessionId }));
          if (muted) set('muted');
        } catch (err) {
          stopMic();
          set('idle');
          emitError(classify(err), err instanceof Error ? err.message : String(err));
        }
      })();
    },
    stop: () => {
      if (timings) {
        mark('hung_up');
        reportTimings();
      }
      started = false;
      stopMic();
      clearPlayback();
      closeSocket();
      set('idle');
    },
    speak: async () => {
      // Server-side voice (Gemini Live) owns speech.
    },
    setMuted: (m) => {
      muted = m;
      if (outGain) outGain.gain.value = m ? 0 : 1;
      if (m) set('muted');
      else if (state === 'muted') set(playing.size ? 'speaking' : 'listening');
    },
    getState: () => state,
    onStateChange: (cb) => {
      listeners.push(cb);
    },
    onError: (cb) => {
      errorListeners.push(cb);
    },
    signalAgentReady: () => {
      mark('agent_ready');
      if (state === 'connecting') set(muted ? 'muted' : playing.size ? 'speaking' : 'listening');
    },
    publishData: async (bytes) => {
      sendJson(new TextDecoder().decode(bytes));
    },
  };
}

