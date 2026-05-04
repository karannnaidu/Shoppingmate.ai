export type TTS = {
  speak: (text: string) => Promise<void>;
  cancel: () => void;
  available: () => boolean;
};

export function createTTS(): TTS {
  const synth = (globalThis as unknown as { speechSynthesis?: SpeechSynthesis })
    .speechSynthesis;
  if (!synth) {
    return { speak: async () => {}, cancel: () => {}, available: () => false };
  }
  function pickVoice(): SpeechSynthesisVoice | null {
    if (!synth) return null;
    const voices = synth.getVoices();
    return (
      voices.find((v) => v.lang.startsWith('en-') && v.default) ??
      voices.find((v) => v.lang.startsWith('en-')) ??
      voices[0] ??
      null
    );
  }
  return {
    speak: (text) =>
      new Promise<void>((resolve) => {
        const u = new SpeechSynthesisUtterance(text);
        const voice = pickVoice();
        if (voice) u.voice = voice;
        u.rate = 1.0;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        synth.speak(u);
      }),
    cancel: () => synth.cancel(),
    available: () => true,
  };
}
