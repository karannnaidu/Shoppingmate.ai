import { encodeWidgetMessage } from '../transport/codec.js';
import type { VoiceMode, VoiceModeState } from './voiceModeWebSpeech.js';

// Voice over our own WebSocket (replaces LiveKit for merchants switched to it).
//   up:   visitor mic → RNNoise noise suppression → 16 kHz mono PCM16 frames
//   down: Olivia → 24 kHz mono PCM16 frames + JSON agent events;
//         {"type":"audio_clear"} = barge-in, drop what's queued
//
// v2 (2026-10-13, after a real-phone test was slow + crackly):
// - ONE continuous AudioWorklet player with a jitter buffer (prebuffer, refill
//   on stalls, smooth resampling) instead of a separate buffer per network
//   chunk — uneven mobile delivery no longer clicks.
// - RNNoise on the mic (LiveKit used Krisp) so room noise doesn't hold Gemini's
//   turn open or cut Olivia off.
// - The call shows CONNECTING until Olivia's audio actually starts, so
//   "connected" means she is already speaking — no dead air after it.

const IN_RATE = 16_000;
const OUT_RATE = 24_000;
const CTX_RATE = 48_000; // RNNoise needs 48 kHz; 48k→16k is an exact 3:1 decimation
const SEND_SAMPLES = 640; // 40 ms per frame up
const WARM_IDLE_MS = 60_000;
const READY_FALLBACK_MS = 8_000; // flip to listening if no audio arrives at all
const NS_LIB = 'https://cdn.jsdelivr.net/npm/@sapphi-red/web-noise-suppressor@0.4.1';

// Capture (box-filter decimation to 16 kHz) + playback (jitter-buffered ring,
// linear-interpolated 24 kHz → context rate) processors, loaded from a blob.
const WORKLETS = `
class SmCap extends AudioWorkletProcessor {
  // Decimate to 16 kHz, then a speech gate (like Krisp gives LiveKit): only
  // speech passes, everything else becomes true silence so Gemini sees clean
  // pauses and ends the turn. 10 ms frames, adaptive noise floor, 100 ms
  // look-back so the first syllable isn't clipped, 600 ms hold so a normal
  // pause between words never reads as the end of the turn (200 ms felt like
  // being cut off — Karan, 2026-10-14). Thresholds loosened 2026-10-27: on
  // Karan's phone 91% of frames were gated to silence and soft word endings
  // were dropped; the server's turn detector now decides what is speech.
  constructor(){super();this.r=sampleRate/16000;this.pos=0;
    // Anti-alias low-pass (windowed sinc, ~7 kHz) before dropping to 16 kHz: the old
    // 3-sample average folded the 8–24 kHz content of real phone mics back into
    // the speech band as distortion (TTS tests never showed it — little HF energy).
    this.N=63;this.taps=new Float32Array(this.N);{const fc=7000/sampleRate,M=this.N-1;let sum=0;
      for(let k=0;k<this.N;k++){const x=k-M/2;const sinc=x===0?2*fc:Math.sin(2*Math.PI*fc*x)/(Math.PI*x);
        const w=0.42-0.5*Math.cos(2*Math.PI*k/M)+0.08*Math.cos(4*Math.PI*k/M);this.taps[k]=sinc*w;sum+=this.taps[k];}
      for(let k=0;k<this.N;k++)this.taps[k]/=sum;}
    this.ring=new Float32Array(this.N);this.ri=0;
    this.f=new Float32Array(160);this.fi=0;this.hist=[];this.floor=0.01;this.run=0;this.hold=0;this.open=false;this.duck=false;
    // Echo guard: while Olivia is speaking, require louder input to open the gate.
    this.bypass=false;
    this.port.onmessage=(e)=>{if(e.data&&typeof e.data.duck==='boolean')this.duck=e.data.duck;if(e.data&&typeof e.data.bypass==='boolean')this.bypass=e.data.bypass;};}
  frame(fr){if(this.bypass){this.port.postMessage(fr);return;}let s=0;for(let i=0;i<160;i++)s+=fr[i]*fr[i];const rms=Math.sqrt(s/160);
    if(rms<this.floor)this.floor=this.floor*0.9+rms*0.1;else this.floor=this.floor*0.9995+rms*0.0005;
    const thr=Math.max(0.006,this.floor*2.5);const speech=rms>thr;
    // Echo guard applies to OPENING only: once the visitor is talking, a
    // "mm-hmm" or reply starting must never swallow their next words.
    const opens=rms>thr*(this.duck?3:1);
    this.run=opens?this.run+1:0;
    if(!this.open&&this.run>=2){this.open=true;
      const out=new Float32Array(160*(this.hist.length+1));let o=0;for(const h of this.hist){out.set(h,o);o+=160;}out.set(fr,o);
      this.hist=[];this.hold=60;this.port.postMessage(out);return;}
    if(this.open){if(speech)this.hold=60;else if(--this.hold<=0)this.open=false;}
    if(this.open){this.port.postMessage(fr);}
    else{this.hist.push(fr);if(this.hist.length>10)this.hist.shift();this.port.postMessage(new Float32Array(160));}}
  process(inputs){const ch=inputs[0]&&inputs[0][0];if(!ch)return true;
    for(let i=0;i<ch.length;i++){this.ring[this.ri]=ch[i];this.ri=(this.ri+1)%this.N;this.pos+=1;
      if(this.pos>=this.r){let y=0;for(let k=0;k<this.N;k++)y+=this.taps[k]*this.ring[(this.ri+k)%this.N];
        this.f[this.fi++]=y;this.pos-=this.r;
        if(this.fi===160){this.frame(this.f.slice());this.fi=0;}}}
    return true;}}registerProcessor('sm-cap',SmCap);
class SmPlay extends AudioWorkletProcessor {
  constructor(o){super();const p=o.processorOptions||{};this.inRate=p.inRate||${OUT_RATE};
    this.step=this.inRate/sampleRate;this.cap=this.inRate*60;this.buf=new Float32Array(this.cap);
    this.r=0;this.w=0;this.n=0;this.pos=0;this.playing=false;
    this.pre=Math.round(this.inRate*(p.prebufferMs||150)/1000);this.maxPre=Math.round(this.inRate*0.35);
    this.lastDrain=0;this.lastWrite=0;this.stutters=0;this.frames=0;
    this.port.onmessage=(e)=>{const d=e.data;
      if(d==='clear'){this.r=0;this.w=0;this.n=0;this.pos=0;if(this.playing){this.playing=false;this.port.postMessage({t:'drained',cleared:true});}return;}
      this.lastWrite=this.frames;for(let i=0;i<d.length&&this.n<this.cap;i++){this.buf[this.w]=d[i];this.w=(this.w+1)%this.cap;this.n++;}};}
  process(_i,outputs){const out=outputs[0][0];this.frames++;
    if(!this.playing){
      // Start when the jitter buffer is full, or data stopped coming (a short reply).
      if(this.n>=this.pre||(this.n>0&&this.frames-this.lastWrite>20)){
        // Data arrived again within ~0.1s of running dry mid-utterance = a network stall.
        if(this.lastDrain&&this.frames-this.lastDrain<40){this.stutters++;this.pre=Math.min(this.maxPre,Math.round(this.pre*1.5));}
        this.playing=true;this.port.postMessage({t:'playing',stutters:this.stutters,preMs:Math.round(this.pre*1000/this.inRate)});
      } else {out.fill(0);return true;}}
    for(let i=0;i<out.length;i++){
      if(this.n<2){out.fill(0,i);this.n=0;this.r=this.w;this.pos=0;this.playing=false;this.lastDrain=this.frames;this.port.postMessage({t:'drained'});break;}
      const a=this.buf[this.r],b=this.buf[(this.r+1)%this.cap];out[i]=a+(b-a)*this.pos;this.pos+=this.step;
      while(this.pos>=1){this.pos-=1;this.r=(this.r+1)%this.cap;this.n--;}}
    return true;}}
registerProcessor('sm-play',SmPlay);`;

type NsLib = {
  loadRnnoise: (u: { url: string; simdUrl: string }) => Promise<ArrayBuffer>;
  RnnoiseWorkletNode: new (ctx: AudioContext, o: { maxChannels: number; wasmBinary: ArrayBuffer }) => AudioWorkletNode;
};

export type WsVoiceStats = {
  stutters: number;
  micFrames: number;
  /** Peak mic loudness sent (0..1), to prove audio is actually leaving the browser. */
  micPeak: number;
  noiseSuppression: boolean;
  prebufferMs: number;
  playStarts: number;
  /** Olivia is sounding right now (for timing tests). */
  playing: boolean;
};

const voiceFlag = (k: string): string | undefined => (globalThis as Record<string, unknown>)[k] as string | undefined;

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
  let readyTimer: ReturnType<typeof setTimeout> | null = null;
  let ctx: AudioContext | null = null;
  let outGain: GainNode | null = null;
  let player: AudioWorkletNode | null = null;
  let setupP: Promise<{ ns: AudioWorkletNode | null }> | null = null;
  let mic: MediaStream | null = null;
  let micNodes: AudioNode[] = [];
  let capNode: AudioWorkletNode | null = null;
  let pending: number[] = [];
  let audioPlaying = false;
  const stats: WsVoiceStats = { stutters: 0, micFrames: 0, micPeak: 0, noiseSuppression: false, prebufferMs: 150, playStarts: 0, playing: false };
  (globalThis as { __smVoiceStats?: WsVoiceStats }).__smVoiceStats = stats;
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
    sendJson(
      encodeWidgetMessage({
        type: 'voice_timing',
        sessionId: opts.sessionId,
        timings: { ...timings, transport_ws: 1, ns: stats.noiseSuppression ? 1 : 0 },
      }),
    );
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
  // Connected = Olivia's voice is actually coming out of the speaker.
  const becomeLive = () => {
    if (readyTimer) clearTimeout(readyTimer);
    readyTimer = null;
    if (state === 'connecting') set(muted ? 'muted' : audioPlaying ? 'speaking' : 'listening');
  };

  // ---- audio graph (built during warm-up, before the tap) -------------------
  const ensureCtx = (): AudioContext => {
    if (ctx) return ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    try {
      ctx = new AC({ sampleRate: CTX_RATE, latencyHint: 'interactive' });
    } catch {
      ctx = new AC();
    }
    outGain = ctx.createGain();
    outGain.connect(ctx.destination);
    return ctx;
  };
  const setup = (): Promise<{ ns: AudioWorkletNode | null }> => {
    if (setupP) return setupP;
    setupP = (async () => {
      const c = ensureCtx();
      const url = URL.createObjectURL(new Blob([WORKLETS], { type: 'application/javascript' }));
      await c.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      player = new AudioWorkletNode(c, 'sm-play', {
        numberOfInputs: 0,
        outputChannelCount: [1],
        processorOptions: { inRate: OUT_RATE, prebufferMs: stats.prebufferMs },
      });
      player.connect(outGain as GainNode);
      player.port.onmessage = (e: MessageEvent<{ t: string; stutters?: number; preMs?: number; cleared?: boolean }>) => {
        const m = e.data;
        if (m.t === 'playing') {
          audioPlaying = true;
          stats.playing = true;
          capNode?.port.postMessage({ duck: true });
          stats.playStarts++;
          stats.stutters = m.stutters ?? stats.stutters;
          stats.prebufferMs = m.preMs ?? stats.prebufferMs;
          if (timings && !('first_audio' in timings)) {
            mark('first_audio');
            reportTimings();
          }
          if (state === 'connecting') becomeLive();
          else if (!muted) set('speaking');
        } else if (m.t === 'drained') {
          audioPlaying = false;
          stats.playing = false;
          capNode?.port.postMessage({ duck: false });
          if (state === 'speaking') set('listening');
        }
      };
      // Noise suppression (RNNoise, ~LiveKit's Krisp). Optional: a site whose
      // CSP blocks the CDN just gets the browser's own noise suppression.
      let ns: AudioWorkletNode | null = null;
      try {
        if (voiceFlag('__SM_VOICE_NS__') === 'off') throw new Error('noise suppression off');
        const lib = (await import(/* @vite-ignore */ `${NS_LIB}/+esm`)) as NsLib;
        const [wasmBinary] = await Promise.all([
          lib.loadRnnoise({ url: `${NS_LIB}/dist/rnnoise.wasm`, simdUrl: `${NS_LIB}/dist/rnnoise_simd.wasm` }),
          c.audioWorklet.addModule(`${NS_LIB}/dist/rnnoise/workletProcessor.js`),
        ]);
        if (c.sampleRate === CTX_RATE) {
          ns = new lib.RnnoiseWorkletNode(c, { maxChannels: 1, wasmBinary });
          stats.noiseSuppression = true;
        }
      } catch (err) {
        console.warn('[voiceModeWs] noise suppression unavailable', err);
      }
      return { ns };
    })();
    setupP.catch(() => {
      setupP = null;
    });
    return setupP;
  };

  const sendPcm = (f: Float32Array) => {
    if (muted || !ws || ws.readyState !== WebSocket.OPEN) return;
    for (let i = 0; i < f.length; i++) {
      const v = f[i] as number;
      pending.push(v);
      if (Math.abs(v) > stats.micPeak) stats.micPeak = Math.abs(v);
    }
    while (pending.length >= SEND_SAMPLES) {
      const chunk = pending.splice(0, SEND_SAMPLES);
      const out = new Int16Array(SEND_SAMPLES);
      for (let i = 0; i < SEND_SAMPLES; i++) {
        const v = Math.max(-1, Math.min(1, chunk[i] as number));
        out[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
      }
      ws.send(out.buffer);
      stats.micFrames++;
    }
  };
  const startMic = async () => {
    const c = ensureCtx();
    const [stream, { ns }] = await Promise.all([
      navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      }),
      setup(),
    ]);
    mic = stream;
    const source = c.createMediaStreamSource(stream);
    const cap = new AudioWorkletNode(c, 'sm-cap');
    // Gate off: send the mic as-is and let the server's turn detector decide.
    if (voiceFlag('__SM_VOICE_GATE__') === 'off') cap.port.postMessage({ bypass: true });
    capNode = cap;
    cap.port.onmessage = (e: MessageEvent<Float32Array>) => sendPcm(e.data);
    if (ns) {
      source.connect(ns);
      ns.connect(cap);
    } else {
      source.connect(cap);
    }
    micNodes = [source, ...(ns ? [ns] : []), cap];
  };
  const stopMic = () => {
    for (const n of micNodes) {
      try {
        n.disconnect();
      } catch {
        /* ignore */
      }
    }
    micNodes = [];
    for (const t of mic?.getTracks() ?? []) t.stop();
    mic = null;
    pending = [];
  };
  const clearPlayback = () => {
    player?.port.postMessage('clear');
    audioPlaying = false;
    if (state === 'speaking') set(muted ? 'muted' : 'listening');
  };
  const enqueue = (buf: ArrayBuffer) => {
    if (!player) return;
    const pcm = new Int16Array(buf);
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = (pcm[i] as number) / 32768;
    player.port.postMessage(f, [f.buffer]);
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
        // Closed before it ever opened (server unreachable / refused): fail now
        // so the LiveKit fallback kicks in at once, not after the no-audio timeout.
        if (s.readyState !== WebSocket.OPEN && ws !== s) reject(new Error('voice websocket connect failed'));
        if (ws === s) ws = null;
        openP = null;
        if (started) {
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
      setup().catch((err) => console.warn('[voiceModeWs] audio setup failed', err));
    },
    start: () => {
      if (state !== 'idle') return;
      set('connecting');
      clearIdle();
      tTap = performance.now();
      timings = { was_warm: ws?.readyState === WebSocket.OPEN ? 1 : 0 };
      // Resume audio INSIDE the tap (autoplay rules).
      void ensureCtx().resume();
      (async () => {
        try {
          await open();
          mark('room_connected');
          await startMic();
          mark('mic_on');
          (globalThis as { __smVoiceMicOnAt?: number }).__smVoiceMicOnAt = Date.now();
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
      if (readyTimer) clearTimeout(readyTimer);
      readyTimer = null;
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
      else if (state === 'muted') set(audioPlaying ? 'speaking' : 'listening');
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
      // Stay CONNECTING until Olivia's audio actually plays (becomeLive); only
      // fall back to listening if no audio ever comes.
      if (state === 'connecting' && !readyTimer) readyTimer = setTimeout(becomeLive, READY_FALLBACK_MS);
    },
    publishData: async (bytes) => {
      sendJson(new TextDecoder().decode(bytes));
    },
  };
}
