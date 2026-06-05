"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Phone, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OliviaPill } from "./olivia/OliviaPill";

// Olivia's side of a real shopping conversation. Plays on a loop beneath the
// live launcher so the hero is wall-to-wall Olivia, not a generic SaaS mock.
const lines = [
  { who: "olivia", text: "Hi, I'm Olivia. Looking for something for sensitive skin?" },
  { who: "you", text: "Yeah — a fragrance-free moisturizer for winter." },
  { who: "olivia", text: "Two in stock that fit. Want me to pop both in your cart?" },
  { who: "you", text: "Yes please — and a coupon if you have one." },
  { who: "olivia", text: "Applied WINTER15 — saved you $5. Ready to check out?" },
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
        Math.max(18, 30 - current.length / 8),
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
                <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400/70" />
                <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              <span>Meet Olivia — your storefront&rsquo;s voice</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.05 }}
              className="mt-6 font-display text-4xl font-semibold tracking-tight text-balance md:text-6xl lg:text-[4.75rem] lg:leading-[1.03]"
            >
              Meet Olivia. She greets every visitor,{" "}
              <span className="gradient-text">listens</span>, and builds the cart.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
              className="mt-6 max-w-2xl text-lg text-text-secondary text-pretty md:text-xl"
            >
              One line of code puts Olivia on every page of your store. She answers out
              loud, picks the right variant, applies coupons, and hands off to your native
              checkout. <span className="text-text-primary">No integrations. No card data
              ever.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/signup"
                aria-label="Sign up"
                data-tour-stop="signup-hero"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-foreground px-6 py-3.5 text-[15px] font-medium text-background shadow-[var(--shadow-md)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <span className="relative z-10">Put Olivia on my store — $30/mo</span>
                <ArrowRight className="relative z-10 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-violet via-fuchsia to-cyan opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100" />
              </Link>
              <Link
                href="/demo"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3.5 text-[15px] font-medium text-text-primary transition-colors hover:border-border-strong"
              >
                <Phone className="h-4 w-4 text-emerald-500" />
                Talk to Olivia
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3 text-sm text-text-muted"
            >
              <Stat value="< 60s" label="to install" />
              <span className="hidden sm:inline-block h-4 w-px bg-border" />
              <Stat value="5–8 min" label="to go live" />
              <span className="hidden sm:inline-block h-4 w-px bg-border" />
              <Stat value="0" label="card data stored" />
            </motion.div>
          </div>

          {/* RIGHT — live Olivia stage */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.15 }}
            className="relative"
          >
            <div className="absolute -inset-3 rounded-[32px] bg-gradient-to-br from-fuchsia/30 via-violet/15 to-cyan/30 blur-2xl opacity-60" aria-hidden />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-br from-zinc-900 to-black p-5 shadow-[var(--shadow-lg)] sm:p-7">
              <div className="absolute inset-0 grid-bg opacity-20" aria-hidden />

              {/* product context */}
              <div className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-fuchsia/30 to-violet/20">
                  <ShoppingBag className="h-5 w-5 text-fuchsia-300" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">Hydra Soothe Cream — 50ml</p>
                  <p className="text-xs text-white/50">In stock · Fragrance-free</p>
                </div>
                <span className="font-mono text-sm font-semibold tabular-nums text-white/80">
                  $19.00
                </span>
              </div>

              {/* conversation */}
              <div className="relative mt-4 grid min-h-[180px] content-start gap-2.5">
                {lines.slice(0, visible).map((l, i) => (
                  <Bubble key={i} who={l.who} text={l.text} />
                ))}
                {visible < lines.length && (
                  <Bubble who={lines[visible].who} text={typed} blink />
                )}
              </div>

              {/* the real launcher — interactive */}
              <div className="relative mt-5 flex flex-col items-center gap-2">
                <OliviaPill interactive start="resting" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
                  tap Call to hear her
                </span>
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
  who: "olivia" | "you" | string;
  text: string;
  blink?: boolean;
}) {
  const isOlivia = who === "olivia";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${isOlivia ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug ${
          isOlivia
            ? "rounded-bl-md bg-white text-zinc-900"
            : "rounded-br-md border border-white/10 bg-white/[0.06] text-white"
        }`}
      >
        {text}
        {blink && (
          <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 bg-current animate-pulse" />
        )}
      </div>
    </motion.div>
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
