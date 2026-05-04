type Listener<T> = (v: T) => void;

export type STT = {
  start: () => void;
  stop: () => void;
  onFinal: (cb: Listener<string>) => void;
  onError: (cb: Listener<string>) => void;
  isActive: () => boolean;
};

// biome-ignore lint/suspicious/noExplicitAny: native SpeechRecognition is vendor-prefixed and weakly typed
type SpeechRecognitionCtor = new () => any;

export function createSTT(): STT | null {
  const g = globalThis as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  const Ctor = g.SpeechRecognition ?? g.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.continuous = true;
  rec.interimResults = false;
  rec.lang = 'en-US';
  let active = false;
  const finalListeners: Listener<string>[] = [];
  const errorListeners: Listener<string>[] = [];

  // biome-ignore lint/suspicious/noExplicitAny: native event shape
  rec.onresult = (ev: any) => {
    for (let i = 0; i < ev.results.length; i += 1) {
      const r = ev.results[i];
      if (r?.isFinal) {
        const text = r[0]?.transcript?.trim();
        if (text) for (const cb of finalListeners) cb(text);
      }
    }
  };
  // biome-ignore lint/suspicious/noExplicitAny: native event shape
  rec.onerror = (ev: any) => {
    for (const cb of errorListeners) cb(String(ev?.error ?? 'unknown'));
  };
  rec.onend = () => {
    active = false;
  };

  return {
    start: () => {
      if (active) return;
      active = true;
      try {
        rec.start();
      } catch {
        // already started — webkit throws InvalidStateError; ignore
      }
    },
    stop: () => {
      if (!active) return;
      active = false;
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    onFinal: (cb) => {
      finalListeners.push(cb);
    },
    onError: (cb) => {
      errorListeners.push(cb);
    },
    isActive: () => active,
  };
}
