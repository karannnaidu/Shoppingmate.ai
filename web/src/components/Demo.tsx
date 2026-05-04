"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Send, Mic, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SectionHead } from "./HowItWorks";

type Msg = { who: "agent" | "user"; text: string };

const personas = [
  { id: "calm-clinician", label: "Calm clinician", desc: "Skincare, wellness" },
  { id: "stylist", label: "Witty stylist", desc: "Apparel, beauty" },
  { id: "coach", label: "No-nonsense coach", desc: "Fitness, supplements" },
  { id: "concierge", label: "Boutique concierge", desc: "Luxury, jewelry" },
];

const scripts: Record<string, Msg[]> = {
  "calm-clinician": [
    { who: "agent", text: "Hi, I'm Sage. What does your skin need help with today?" },
    { who: "user", text: "Dry, flaky skin in winter. No fragrance." },
    {
      who: "agent",
      text:
        "Two perfect picks: Hydra Soothe Cream ($19) and our Barrier Repair Serum ($28). Both fragrance-free. Pop them in your cart?",
    },
  ],
  stylist: [
    { who: "agent", text: "Hey! I'm Lumi. Outfit hunt or just browsing today?" },
    { who: "user", text: "Wedding next weekend, formal but not boring." },
    {
      who: "agent",
      text:
        "Think structured silk blazer in deep emerald — pairs with our wide-leg trouser. Want me to grab your size?",
    },
  ],
  coach: [
    { who: "agent", text: "What's the goal — strength, cut, or just energy?" },
    { who: "user", text: "Cut. 12 weeks." },
    {
      who: "agent",
      text:
        "Stack: whey isolate, EAA intra, thermogenic. WINTER15 stacks with bundle pricing — $52 saved. Ready?",
    },
  ],
  concierge: [
    { who: "agent", text: "A pleasure. May I help you find a piece for someone?" },
    { who: "user", text: "Anniversary gift. Classic, not loud." },
    {
      who: "agent",
      text:
        "Then the Solitaire Pendant in 18k yellow gold — quietly extraordinary. Shall I begin a private viewing appointment?",
    },
  ],
};

export function Demo() {
  const [persona, setPersona] = useState(personas[0].id);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [thinking, setThinking] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const script = scripts[persona];
    if (!script) return;

    setMsgs([]);
    setThinking(false);

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
      await wait(250);
      for (const msg of script) {
        if (cancelled) return;
        if (msg.who === "agent") {
          setThinking(true);
          await wait(700);
          if (cancelled) return;
          setThinking(false);
        }
        setMsgs((m) => [...m, msg]);
        await wait(msg.who === "agent" ? 700 : 800);
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [persona]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [msgs, thinking]);

  function send() {
    if (!input.trim()) return;
    setMsgs((m) => [...m, { who: "user", text: input.trim() }]);
    setInput("");
    setThinking(true);
    setTimeout(() => {
      setThinking(false);
      setMsgs((m) => [
        ...m,
        {
          who: "agent",
          text:
            "Beautiful pick. Want me to drop two best-matching products in your cart so you can compare?",
        },
      ]);
    }, 1100);
  }

  return (
    <section id="demo" className="relative py-24 md:py-32 bg-surface-muted/40 border-y border-border">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <SectionHead
          eyebrow="Live demo"
          title="Try the conversation. Switch the persona."
          subtitle="One engine, every voice. Pick the persona that fits your brand and your customer."
        />

        <div className="mt-14 grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-start">
          {/* Persona picker */}
          <div className="grid gap-2.5">
            {personas.map((p) => {
              const active = persona === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setPersona(p.id)}
                  aria-pressed={active}
                  className={`group relative flex items-center justify-between gap-3 rounded-2xl border px-5 py-4 text-left transition-all cursor-pointer ${
                    active
                      ? "border-transparent bg-foreground text-background"
                      : "border-border bg-surface-elevated hover:border-border-strong"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="persona-glow"
                      className="absolute -inset-px -z-10 rounded-2xl bg-gradient-to-br from-violet via-fuchsia to-cyan opacity-90 blur-md"
                      transition={{ type: "spring", stiffness: 280, damping: 30 }}
                    />
                  )}
                  <div>
                    <div className="font-medium tracking-tight">{p.label}</div>
                    <div
                      className={`text-xs ${
                        active ? "text-background/70" : "text-text-muted"
                      }`}
                    >
                      {p.desc}
                    </div>
                  </div>
                  <span
                    className={`grid h-7 w-7 place-items-center rounded-full border ${
                      active
                        ? "border-background/30 bg-background/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    <Sparkles
                      className={`h-3.5 w-3.5 ${
                        active ? "text-background" : "text-text-muted"
                      }`}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          {/* Chat panel */}
          <div className="relative">
            <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-violet/15 via-fuchsia/8 to-cyan/15 blur-2xl opacity-60" aria-hidden />
            <div className="relative rounded-[24px] border border-border bg-surface-elevated shadow-[var(--shadow-md)]">
              <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
                <span className="relative grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-violet to-cyan text-white text-xs font-semibold">
                  {personas.find((p) => p.id === persona)?.label.charAt(0)}
                  <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-surface-elevated" />
                </span>
                <div className="flex-1">
                  <div className="text-sm font-medium">
                    {personas.find((p) => p.id === persona)?.label}
                  </div>
                  <div className="text-[11px] text-text-muted font-mono uppercase tracking-wider">
                    online · responds in &lt; 800ms
                  </div>
                </div>
              </div>

              <div ref={scrollRef} className="grid gap-2.5 p-5 min-h-[360px] max-h-[420px] overflow-y-auto">
                <AnimatePresence initial={false}>
                  {msgs
                    .filter((m): m is Msg => Boolean(m?.who && m?.text))
                    .map((m, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      className={`flex ${m.who === "agent" ? "justify-start" : "justify-end"}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-[14px] leading-snug ${
                          m.who === "agent"
                            ? "rounded-bl-md bg-foreground text-background"
                            : "rounded-br-md border border-border bg-surface text-text-primary"
                        }`}
                      >
                        {m.text}
                      </div>
                    </motion.div>
                  ))}
                  {thinking && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="flex justify-start"
                    >
                      <div className="rounded-2xl rounded-bl-md bg-foreground/95 px-4 py-3">
                        <div className="flex items-center gap-1">
                          {[0, 1, 2].map((i) => (
                            <motion.span
                              key={i}
                              className="h-1.5 w-1.5 rounded-full bg-background"
                              animate={{ opacity: [0.3, 1, 0.3] }}
                              transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                delay: i * 0.2,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
                className="flex items-center gap-2 border-t border-border p-3"
              >
                <button
                  type="button"
                  aria-label="Voice"
                  className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-text-secondary transition-colors hover:text-text-primary cursor-pointer"
                >
                  <Mic className="h-4 w-4" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Try: 'I need a gift for my sister'"
                  className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5 text-sm placeholder:text-text-muted focus:outline-none focus:border-violet"
                />
                <button
                  type="submit"
                  aria-label="Send"
                  className="grid h-10 w-10 place-items-center rounded-full bg-foreground text-background transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
