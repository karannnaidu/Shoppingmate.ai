"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Phone,
  PhoneOff,
  MessageSquare,
  X,
  Send,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Mode = "pill" | "expanded" | "call" | "chat";
type Turn = { who: "agent" | "user"; text: string };

const callScript: Turn[] = [
  { who: "agent", text: "Hi, I'm Sage. What are you shopping for today?" },
  { who: "user", text: "Looking for a winter face cream — fragrance-free." },
  {
    who: "agent",
    text:
      "Got it — sensitive skin. I'd suggest Hydra Soothe Cream, $19. Barrier repair, no fragrance.",
  },
  { who: "user", text: "Sounds good. What about a serum to pair?" },
  {
    who: "agent",
    text:
      "Barrier Repair Serum, $28. WINTER15 stacks — saves you $5 on both. Want me to add them?",
  },
];

const chatReplies: Record<string, string> = {
  "What does it cost?":
    "Flat monthly: Starter $30, Growth $60, Enterprise custom. Unmetered conversations. Cancel anytime.",
  "How does install work?":
    "One <script> tag in your <head>. Auto-onboards in 5–8 minutes. No SDK, no app, no plugin.",
  "Is my data safe?":
    "Card data never touches us — payment redirects to your native checkout. Transcripts auto-expire at 24h.",
};

const quickReplies = Object.keys(chatReplies);

function Waveform({ active }: { active: boolean }) {
  return (
    <div
      className="flex h-20 items-center justify-center gap-1"
      aria-hidden="true"
    >
      {Array.from({ length: 28 }).map((_, i) => {
        const seed = (i * 53) % 100;
        const peak = 35 + (seed % 60);
        return (
          <motion.span
            key={i}
            className="w-[3px] rounded-full bg-gradient-to-t from-violet via-fuchsia to-cyan"
            animate={
              active
                ? { height: ["12%", `${peak}%`, "12%"] }
                : { height: "10%" }
            }
            transition={
              active
                ? {
                    duration: 0.7 + ((seed % 5) * 0.08),
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: (i % 9) * 0.04,
                  }
                : { duration: 0.25 }
            }
            style={{ height: "10%" }}
          />
        );
      })}
    </div>
  );
}

function formatElapsed(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
}

export function WidgetPreview() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("pill");

  // Call state
  const [transcript, setTranscript] = useState<Turn[]>([]);
  const [callStatus, setCallStatus] = useState<"speaking" | "listening">(
    "speaking"
  );
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Chat state
  const [chatMsgs, setChatMsgs] = useState<Turn[]>([
    { who: "agent", text: "Quick question? I'll keep this short." },
  ]);
  const [input, setInput] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 2200);
    return () => clearTimeout(t);
  }, []);

  // Subtle attention-grab: auto-expand briefly to hint at the call action
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(() => {
      setMode((m) => (m === "pill" ? "expanded" : m));
    }, 1400);
    return () => clearTimeout(t);
  }, [mounted]);

  // Drive the simulated voice call
  useEffect(() => {
    if (mode !== "call") return;
    setTranscript([]);
    setCallStatus("speaking");
    let cancelled = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          timers.delete(t);
          resolve();
        }, ms);
        timers.add(t);
      });

    (async () => {
      await wait(700);
      for (const turn of callScript) {
        if (cancelled) return;
        setCallStatus(turn.who === "agent" ? "speaking" : "listening");
        setTranscript((t) => [...t, turn]);
        await wait(turn.who === "agent" ? 3200 : 2200);
      }
      if (!cancelled) setCallStatus("listening");
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [mode]);

  // Elapsed timer for the call
  useEffect(() => {
    if (mode !== "call") {
      setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [mode]);

  // Scroll transcripts as messages append
  useEffect(() => {
    if (transcriptRef.current)
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [transcript]);
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMsgs, mode]);

  function sendChat(text?: string) {
    const t = (text ?? input).trim();
    if (!t) return;
    setInput("");
    setChatMsgs((m) => [...m, { who: "user", text: t }]);
    setTimeout(() => {
      const reply =
        chatReplies[t] ??
        "On a real merchant I'd answer from their brand KB. Here's a demo — try a quick reply.";
      setChatMsgs((m) => [...m, { who: "agent", text: reply }]);
    }, 700);
  }

  if (!mounted) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[60] flex flex-col items-end gap-3 md:bottom-7 md:right-7">
      {/* Above-pill panels */}
      <AnimatePresence>
        {mode === "call" && (
          <motion.div
            key="call-panel"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-[min(380px,calc(100vw-2.5rem))] origin-bottom-right"
          >
            <div
              className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-violet/30 via-fuchsia/15 to-cyan/30 blur-2xl opacity-70"
              aria-hidden
            />
            <div className="relative flex flex-col overflow-hidden rounded-[22px] border border-border bg-surface-elevated shadow-[var(--shadow-lg)]">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <span className="relative grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet to-cyan text-white text-[13px] font-semibold">
                    S
                    <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-surface-elevated" />
                  </span>
                  <div>
                    <div className="text-[14px] font-medium leading-tight">
                      Sage
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      on call · {callStatus === "speaking" ? "speaking" : "listening"}
                    </div>
                  </div>
                </div>
                <span className="font-mono text-[11px] tabular-nums text-text-muted">
                  {formatElapsed(elapsed)}
                </span>
              </div>

              {/* Voice visualization */}
              <div className="relative px-5 pb-2 pt-6">
                <div
                  className="absolute inset-x-8 top-3 -z-10 h-24 rounded-full bg-gradient-to-br from-violet/15 via-fuchsia/10 to-cyan/15 blur-2xl"
                  aria-hidden
                />
                <Waveform active={callStatus === "speaking" && !muted} />
                <div className="mt-3 flex items-center justify-center gap-1.5 font-mono text-[11px] uppercase tracking-wider text-text-muted">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      callStatus === "speaking"
                        ? "bg-violet animate-pulse"
                        : "bg-emerald-400"
                    }`}
                  />
                  {muted
                    ? "you're muted"
                    : callStatus === "speaking"
                    ? "Sage is speaking…"
                    : "listening to you…"}
                </div>
              </div>

              {/* Live transcript */}
              <div
                ref={transcriptRef}
                aria-live="polite"
                className="grid gap-2 overflow-y-auto px-5 py-4 max-h-[180px]"
              >
                <AnimatePresence initial={false}>
                  {transcript.map((t, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                      className={`flex ${
                        t.who === "agent" ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
                          t.who === "agent"
                            ? "rounded-bl-md bg-foreground text-background"
                            : "rounded-br-md border border-border bg-surface text-text-primary"
                        }`}
                      >
                        {t.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* Call controls */}
              <div className="flex items-center justify-center gap-3 border-t border-border bg-surface-muted/40 px-5 py-4">
                <button
                  onClick={() => setMuted((m) => !m)}
                  aria-pressed={muted}
                  aria-label={muted ? "Unmute microphone" : "Mute microphone"}
                  className={`grid h-12 w-12 place-items-center rounded-full border transition-transform hover:scale-105 active:scale-95 cursor-pointer ${
                    muted
                      ? "border-rose-500/40 bg-rose-500/10 text-rose-500"
                      : "border-border bg-surface text-text-primary"
                  }`}
                >
                  {muted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={() => setMode("expanded")}
                  aria-label="End call"
                  className="grid h-14 w-14 place-items-center rounded-full bg-rose-500 text-white shadow-[var(--shadow-md)] transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <PhoneOff className="h-6 w-6" />
                </button>
                <button
                  onClick={() => setMode("chat")}
                  aria-label="Switch to text chat"
                  className="grid h-12 w-12 place-items-center rounded-full border border-border bg-surface text-text-primary transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>

              <div className="border-t border-border bg-surface-muted/30 px-4 py-2 text-center font-mono text-[10px] uppercase tracking-wider text-text-muted">
                this is a demo · the live widget talks too
              </div>
            </div>
          </motion.div>
        )}

        {mode === "chat" && (
          <motion.div
            key="chat-panel"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
            className="relative w-[min(360px,calc(100vw-2.5rem))] origin-bottom-right"
          >
            <div className="relative flex h-[440px] max-h-[70vh] flex-col overflow-hidden rounded-[22px] border border-border bg-surface-elevated shadow-[var(--shadow-lg)]">
              <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet to-cyan text-white text-[12px] font-semibold">
                    S
                  </span>
                  <div className="leading-tight">
                    <div className="text-[13px] font-medium">Sage</div>
                    <div className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
                      text fallback · voice preferred
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setMode("call")}
                  aria-label="Switch back to voice"
                  className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-violet via-fuchsia to-cyan px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-[0.97] cursor-pointer"
                >
                  <Phone className="h-3 w-3" />
                  CALL
                </button>
              </div>

              <div ref={chatRef} className="flex-1 overflow-y-auto px-4 py-4">
                <div className="grid gap-2.5">
                  {chatMsgs.map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                      className={`flex ${
                        m.who === "agent" ? "justify-start" : "justify-end"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-snug ${
                          m.who === "agent"
                            ? "rounded-bl-md bg-foreground text-background"
                            : "rounded-br-md border border-border bg-surface text-text-primary"
                        }`}
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  ))}
                </div>

                {chatMsgs.length <= 1 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {quickReplies.map((q) => (
                      <button
                        key={q}
                        onClick={() => sendChat(q)}
                        className="rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary cursor-pointer"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  sendChat();
                }}
                className="flex items-center gap-2 border-t border-border p-2.5"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a quick question…"
                  className="flex-1 rounded-full border border-border bg-surface px-3.5 py-2 text-[13px] placeholder:text-text-muted focus:border-violet focus:outline-none"
                />
                <button
                  type="submit"
                  aria-label="Send message"
                  className="grid h-9 w-9 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Always-visible voice-first pill */}
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative flex items-center gap-2.5 rounded-full border border-white/10 bg-zinc-950 py-1.5 pl-1.5 pr-2 text-white shadow-[0_18px_40px_-12px_rgba(124,58,237,0.45),0_8px_20px_-8px_rgba(0,0,0,0.5)]"
      >
        <button
          onClick={() =>
            setMode((m) => (m === "pill" ? "expanded" : "pill"))
          }
          aria-expanded={mode !== "pill"}
          aria-label={mode === "pill" ? "Open Sage" : "Collapse"}
          className="flex items-center gap-3 rounded-full pr-1 transition-opacity hover:opacity-95 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-violet"
        >
          <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-violet via-fuchsia to-cyan text-[14px] font-semibold">
            S
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-400 ring-2 ring-zinc-950" />
          </span>
          <span className="text-left leading-tight">
            <span className="block text-[13px] font-medium">
              {mode === "pill" ? "Talk to Sage" : "Sage"}
            </span>
            <span className="block font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/55">
              AI salesmate
            </span>
          </span>
        </button>

        <AnimatePresence initial={false}>
          {mode !== "pill" && (
            <motion.div
              key="actions"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="flex items-center gap-1"
            >
              <button
                onClick={() =>
                  setMode((m) => (m === "call" ? "expanded" : "call"))
                }
                aria-pressed={mode === "call"}
                aria-label={mode === "call" ? "End call" : "Start voice call"}
                className={`relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[12px] font-semibold tracking-wide transition-transform hover:scale-[1.04] active:scale-[0.96] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  mode === "call"
                    ? "bg-rose-500 text-white"
                    : "bg-gradient-to-r from-violet via-fuchsia to-cyan text-white shadow-[0_6px_18px_-4px_rgba(217,70,239,0.55)]"
                }`}
              >
                {mode === "call" ? (
                  <PhoneOff className="h-3.5 w-3.5" />
                ) : (
                  <Phone className="h-3.5 w-3.5" />
                )}
                {mode === "call" ? "END" : "CALL"}
              </button>

              <button
                onClick={() =>
                  setMode((m) => (m === "chat" ? "expanded" : "chat"))
                }
                aria-pressed={mode === "chat"}
                aria-label="Open text chat"
                title="Text chat (fallback)"
                className={`grid h-9 w-9 place-items-center rounded-full transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                  mode === "chat"
                    ? "bg-white/15 text-white"
                    : "bg-white/5 text-white/75 hover:bg-white/10 hover:text-white"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>

              <button
                onClick={() => setMode("pill")}
                aria-label="Close"
                className="grid h-9 w-9 place-items-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtle glow halo when collapsed */}
        {mode === "pill" && (
          <span
            className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-r from-violet/30 via-fuchsia/20 to-cyan/30 opacity-0 blur-md transition-opacity duration-500 hover:opacity-100"
            aria-hidden
          />
        )}
      </motion.div>
    </div>
  );
}
