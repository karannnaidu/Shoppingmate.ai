'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, MicOff, Send, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/cn';

type Msg = { role: 'user' | 'assistant'; text: string };

// Minimal Web Speech API typing (Chrome/Edge/Safari expose it, Firefox doesn't).
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
};

const SUGGESTIONS = [
  "The assistant isn't showing on my site",
  'How do I change how it sounds?',
  'I want to request a feature',
  'How many conversations have I used?',
];

export function SupportAssistant({ brand }: { brand: string }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: 'assistant',
      text: `Hi! I'm the shoppingmate support assistant for ${brand}. Ask me how to do something, tell me what's not working, or what you'd like us to build — I can check your setup and send it to the team. Tap the mic to talk.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [voiceOk, setVoiceOk] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    setVoiceOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
  }, []);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, busy]);

  function say(text: string) {
    if (!speak || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.03;
    window.speechSynthesis.speak(u);
  }

  async function send(text: string) {
    const t = text.trim();
    if (!t || busy) return;
    const next: Msg[] = [...messages, { role: 'user', text: t }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const res = await fetch('/api/support/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(1) }),
      });
      const j = (await res.json().catch(() => ({}))) as { reply?: string; ticketId?: number | null };
      const reply = j.reply ?? 'Sorry — something went wrong. Please try again.';
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
      say(reply);
      if (j.ticketId) router.refresh(); // show the new ticket in "Your requests"
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: "I couldn't reach the server — check your connection and try again." }]);
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e) => {
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) finalText += r[0]!.transcript;
        else interim += r[0]!.transcript;
      }
      setInput((finalText + interim).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) {
        setSpeak(true);
        void send(finalText);
      }
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <section className="card-v2 flex h-[560px] flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <span className="relative grid h-8 w-8 place-items-center rounded-full bg-signal-soft text-signal">
            <span className="h-2 w-2 rounded-full bg-signal" />
          </span>
          <div>
            <p className="text-sm font-semibold">Support assistant</p>
            <p className="text-[11.5px] text-text-muted">Answers instantly · sends requests to our team</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setSpeak((s) => !s);
            if (speak && 'speechSynthesis' in window) window.speechSynthesis.cancel();
          }}
          aria-pressed={speak}
          aria-label={speak ? 'Stop reading replies aloud' : 'Read replies aloud'}
          className="grid h-9 w-9 place-items-center rounded-xl border border-border text-text-secondary transition-colors hover:text-text-primary"
        >
          {speak ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
      </div>

      <div className="flex-1 space-y-2.5 overflow-y-auto px-5 py-4" aria-live="polite">
        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <p
              className={cn(
                'dash-enter max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed',
                m.role === 'user'
                  ? 'rounded-br-md bg-foreground text-background'
                  : 'rounded-bl-md border border-border bg-surface-muted text-text-primary',
              )}
            >
              {m.text}
            </p>
          </div>
        ))}
        {busy && (
          <div className="flex gap-1 px-1 py-2" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-text-muted" style={{ animationDelay: `${i * 120}ms` }} />
            ))}
          </div>
        )}
        {messages.length === 1 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void send(s)}
                className="rounded-full border border-border px-3 py-1.5 text-[12.5px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
        className="flex items-center gap-2 border-t border-border p-3"
      >
        {voiceOk && (
          <button
            type="button"
            onClick={toggleMic}
            aria-label={listening ? 'Stop listening' : 'Talk to the assistant'}
            className={cn(
              'grid h-11 w-11 flex-none place-items-center rounded-xl border transition-colors',
              listening ? 'border-rose-500/40 bg-rose-500/10 text-rose-500' : 'border-border text-text-secondary hover:text-text-primary',
            )}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>
        )}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={listening ? 'Listening…' : 'Ask anything, or describe the problem…'}
          aria-label="Message the support assistant"
          className="h-11 flex-1 rounded-xl border border-border bg-surface-elevated px-3.5 text-[14px] placeholder:text-text-muted focus:border-violet focus:outline-none focus:ring-4 focus:ring-violet/15"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          aria-label="Send"
          className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-foreground text-background transition-opacity disabled:opacity-40"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}
