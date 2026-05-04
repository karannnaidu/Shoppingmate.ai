"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Sparkles, Mic, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

const lines = [
  { who: "agent", text: "Hi! I'm Sage. Looking for something for sensitive skin?" },
  { who: "user", text: "Yeah — a moisturizer for winter, fragrance-free." },
  {
    who: "agent",
    text: "Got it. Two best matches in stock. Want me to pop both in your cart?",
  },
  { who: "user", text: "Yes please. And a coupon if you have one." },
  { who: "agent", text: "Applied WINTER15 — saved you $5. Ready to check out?" },
];

export function Hero() {
  const reduce = useReducedMotion();
  const [visible, setVisible] = useState(reduce ? lines.length : 0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (reduce) return;
    if (visible >= lines.length) {
      const t = setTimeout(() => {
        setVisible(0);
        setTyped("");
      }, 4000);
      return () => clearTimeout(t);
    }
    const current = lines[visible].text;
    if (typed.length < current.length) {
      const t = setTimeout(
        () => setTyped(current.slice(0, typed.length + 1)),
        Math.max(20, 32 - current.length / 8)
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setVisible((v) => v + 1);
      setTyped("");
    }, 700);
    return () => clearTimeout(t);
  }, [visible, typed, reduce]);

  return (
    <section className="relative overflow-hidden pt-16 md:pt-24 pb-20 md:pb-28">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-bg opacity-60" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
          {/* LEFT — copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated/80 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-md"
            >
              <span className="relative grid h-1.5 w-1.5 place-items-center">
                <span className="absolute inset-0 animate-ping rounded-full bg-cyan/70" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-cyan" />
              </span>
              <Sparkles className="h-3.5 w-3.5 text-violet" />
              <span>Live on Shopify, Woo, Magento, BigCommerce, Wix, Squarespace + custom</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
              className="mt-6 font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl lg:text-[5rem] lg:leading-[1.02]"
            >
              The 24/7 sales floor
              <br />
              your store never had.{" "}
              <span className="gradient-text">Voice shopping</span> that builds carts.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
              className="mt-6 max-w-2xl text-lg text-text-secondary text-pretty md:text-xl"
            >
              Paste one line of code. Within 8 minutes your AI salesmate is live —
              greeting visitors, picking variants, applying coupons, and handing off to
              your native checkout. <span className="text-text-primary">No integrations.
              No PCI scope. No card data ever.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/signup"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-foreground px-6 py-3.5 text-[15px] font-medium text-background shadow-[var(--shadow-md)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="relative z-10">Get started — $30/mo</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-violet via-fuchsia to-cyan opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100" />
              </Link>
              <Link
                href="#demo"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3.5 text-[15px] font-medium text-text-primary transition-colors hover:border-border-strong"
              >
                <Mic className="h-4 w-4" />
                Hear it talk
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-text-muted"
            >
              <Stat value="< 60s" label="install" />
              <span className="hidden sm:inline-block h-4 w-px bg-border" />
              <Stat value="5–8 min" label="auto-onboard" />
              <span className="hidden sm:inline-block h-4 w-px bg-border" />
              <Stat value="0" label="card data stored" />
            </motion.div>
          </div>

          {/* RIGHT — live demo card */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-[28px] bg-gradient-to-br from-violet/30 via-fuchsia/15 to-cyan/30 blur-2xl opacity-60" aria-hidden />
            <div className="relative rounded-[24px] border border-border bg-surface-elevated/90 p-3 shadow-[var(--shadow-lg)] backdrop-blur-xl">
              {/* fake browser chrome */}
              <div className="flex items-center justify-between rounded-t-[16px] border-b border-border bg-surface-muted/60 px-4 py-2.5">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                </div>
                <div className="text-[11px] font-mono text-text-muted">
                  glowderma.in/products/sensitive-skin
                </div>
                <span className="h-2 w-8" />
              </div>

              <div className="relative grid gap-3 p-5 sm:p-6">
                {/* product card preview */}
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-3">
                  <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-violet/20 to-cyan/20">
                    <ShoppingBag className="h-5 w-5 text-violet" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Hydra Soothe Cream — 50ml</p>
                    <p className="text-xs text-text-muted">In stock · Fragrance-free</p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums">
                    $19.00
                  </span>
                </div>

                {/* conversation */}
                <div className="grid gap-2.5 min-h-[230px]">
                  {lines.slice(0, visible).map((l, i) => (
                    <Bubble key={i} who={l.who} text={l.text} />
                  ))}
                  {visible < lines.length && (
                    <Bubble who={lines[visible].who} text={typed} blink />
                  )}
                </div>

                {/* mic */}
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-surface px-3.5 py-3">
                  <button
                    aria-label="Talk"
                    className="relative grid h-10 w-10 place-items-center rounded-full bg-foreground text-background"
                  >
                    <span
                      className="absolute inset-0 animate-ping rounded-full bg-violet/40"
                      aria-hidden
                    />
                    <Mic className="relative h-4 w-4" />
                  </button>
                  <div className="flex-1">
                    <Waveform />
                  </div>
                  <span className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
                    listening
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Bubble({
  who,
  text,
  blink,
}: {
  who: "agent" | "user" | string;
  text: string;
  blink?: boolean;
}) {
  const isAgent = who === "agent";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isAgent ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug ${
          isAgent
            ? "rounded-bl-md bg-foreground text-background"
            : "rounded-br-md border border-border bg-surface-muted text-text-primary"
        }`}
      >
        {text}
        {blink && <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 bg-current animate-pulse" />}
      </div>
    </motion.div>
  );
}

function Waveform() {
  const heights = [40, 70, 30, 90, 60, 75, 50, 95, 35, 80, 55, 65, 45, 85, 55];
  return (
    <div className="flex h-8 items-center gap-[3px]">
      {heights.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-b from-violet to-cyan"
          style={{
            height: `${h}%`,
            animation: `bar 1.2s ease-in-out ${i * 0.05}s infinite alternate`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes bar {
          from {
            transform: scaleY(0.4);
          }
          to {
            transform: scaleY(1);
          }
        }
      `}</style>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-display text-[15px] font-semibold tabular-nums text-text-primary">
        {value}
      </span>
      <span className="text-text-muted">{label}</span>
    </span>
  );
}
