"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Phone, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { OliviaPill } from "./olivia/OliviaPill";
import { SerifEm, Tick } from "./v2/primitives";

// A real shopping conversation with the product's signature: every step Olivia
// actually takes lands as a green receipt, and the cart badge counts up.
type Step =
  | { kind: "olivia" | "you"; text: string }
  | { kind: "receipt"; text: string; cart?: number };

const script: Step[] = [
  { kind: "olivia", text: "Hi, I'm Olivia. Shopping for something for sensitive skin?" },
  { kind: "you", text: "Yes — a fragrance-free moisturiser for winter." },
  { kind: "olivia", text: "Hydra Soothe is the best fit, and it's in stock. Shall I add it?" },
  { kind: "you", text: "Yes please. Any discount?" },
  { kind: "receipt", text: "Added Hydra Soothe Cream to your cart", cart: 1 },
  { kind: "receipt", text: "Applied code WINTER15" },
  { kind: "olivia", text: "Done — you're saving 15%. Want me to fill in checkout for you?" },
];

export function Hero() {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? script.length : 0);
  const [typed, setTyped] = useState("");

  useEffect(() => {
    if (reduce) return;
    if (shown >= script.length) {
      const t = setTimeout(() => {
        setShown(0);
        setTyped("");
      }, 4200);
      return () => clearTimeout(t);
    }
    const step = script[shown];
    if (step.kind === "receipt") {
      const t = setTimeout(() => setShown((v) => v + 1), 650);
      return () => clearTimeout(t);
    }
    if (typed.length < step.text.length) {
      const t = setTimeout(() => setTyped(step.text.slice(0, typed.length + 1)), 22);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setShown((v) => v + 1);
      setTyped("");
    }, 650);
    return () => clearTimeout(t);
  }, [shown, typed, reduce]);

  const cart = script.slice(0, shown).reduce((n, s) => (s.kind === "receipt" && s.cart ? s.cart : n), 0);
  const current = shown < script.length ? script[shown] : null;

  return (
    <section className="grain relative overflow-hidden pb-20 pt-14 md:pb-28 md:pt-20">
      <div className="aurora" aria-hidden />
      <div className="absolute inset-0 grid-bg opacity-50" aria-hidden />

      <div className="relative z-10 mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid items-center gap-14 lg:grid-cols-[1.1fr_1fr]">
          {/* LEFT — copy */}
          <div>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="inline-flex items-center gap-2.5 rounded-full border border-border bg-surface-elevated/80 py-1.5 pl-2 pr-3.5 text-xs font-medium text-text-secondary backdrop-blur-md"
            >
              <span className="rounded-full bg-signal-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-signal">
                New
              </span>
              A tick for every step that really happened
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
              className="mt-7 font-display text-[2.75rem] font-semibold leading-[1.02] tracking-[-0.045em] text-balance md:text-7xl lg:text-[5.25rem]"
            >
              Your store, <SerifEm>finally</SerifEm> talking back.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.12 }}
              className="mt-6 max-w-xl text-lg leading-relaxed text-text-secondary text-pretty md:text-xl"
            >
              Olivia greets every shopper, answers out loud or in chat, adds to cart, finds the
              best code and fills in checkout — and shows a tick for every step that{" "}
              <span className="text-text-primary">really happened</span>. One line of code.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/signup"
                aria-label="Sign up"
                data-tour-stop="signup-hero"
                className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-foreground px-6 py-3.5 text-[15px] font-medium text-background shadow-[var(--shadow-md)] transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Get started — from $30/mo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/demo"
                className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-6 py-3.5 text-[15px] font-medium text-text-primary transition-colors hover:border-border-strong"
              >
                <span className="relative grid h-5 w-5 place-items-center rounded-full bg-signal text-background">
                  <Phone className="h-3 w-3" />
                  <span className="absolute inset-0 animate-ping rounded-full bg-signal opacity-30" />
                </span>
                Talk to Olivia
              </Link>
            </motion.div>

            <motion.ul
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.35 }}
              className="mt-10 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-text-secondary"
            >
              {["Live in 60 seconds", "Shopify, WooCommerce or any website", "Never sees card details"].map((f) => (
                <li key={f} className="inline-flex items-center gap-2">
                  <Tick />
                  {f}
                </li>
              ))}
            </motion.ul>
          </div>

          {/* RIGHT — live stage */}
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
            className="relative"
          >
            <div className="absolute -inset-4 rounded-[36px] bg-gradient-to-br from-violet/25 via-transparent to-signal/20 blur-3xl" aria-hidden />
            <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[#0d0d12] p-5 text-white shadow-[var(--shadow-lg)] sm:p-6">
              <div className="absolute inset-0 grid-bg opacity-20" aria-hidden />

              {/* storefront bar */}
              <div className="relative flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet/40 to-fuchsia/20">
                    <ShoppingBag className="h-5 w-5 text-white/90" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Hydra Soothe Cream · 50ml</p>
                    <p className="text-xs text-white/50">In stock · Fragrance-free</p>
                  </div>
                </div>
                <div className="relative grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04]" aria-label={`Cart: ${cart} item`}>
                  <ShoppingBag className="h-4 w-4 text-white/70" />
                  <AnimatePresence>
                    {cart > 0 && (
                      <motion.span
                        key={cart}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: "spring", stiffness: 500, damping: 15 }}
                        className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#3ddc97] text-[10px] font-bold text-black"
                      >
                        {cart}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* conversation */}
              <div className="relative mt-4 flex min-h-[288px] flex-col justify-end gap-2" aria-live="off">
                {[
                  ...script.slice(0, shown).map((s, i) => ({ s, i, typing: false })),
                  ...(current && current.kind !== "receipt"
                    ? [{ s: { ...current, text: typed } as Step, i: shown, typing: true }]
                    : []),
                ]
                  .slice(-7)
                  .map(({ s, i, typing }) => (
                    <Line key={i} step={s} typing={typing} />
                  ))}
              </div>

              <div className="relative mt-5 flex flex-col items-center gap-2">
                <OliviaPill interactive start="resting" />
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/40">tap Call to hear her</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Line({ step, typing }: { step: Step; typing?: boolean }) {
  if (step.kind === "receipt") {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8, scale: 0.97 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="inline-flex items-center gap-2 self-start rounded-full bg-[#3ddc97]/10 py-1 pl-1.5 pr-3 text-[12px] font-medium text-[#a7f3d0] ring-1 ring-inset ring-[#3ddc97]/25"
      >
        <span className="tick-pop grid h-4 w-4 place-items-center rounded-full bg-[#3ddc97] text-[10px] font-bold text-black">✓</span>
        {step.text}
      </motion.div>
    );
  }
  const olivia = step.kind === "olivia";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={`flex ${olivia ? "justify-start" : "justify-end"}`}
    >
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-snug ${
          olivia ? "rounded-bl-md bg-white text-zinc-900" : "rounded-br-md border border-white/10 bg-white/[0.06] text-white"
        }`}
      >
        {step.text}
        {typing && <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 animate-pulse bg-current" />}
      </div>
    </motion.div>
  );
}
