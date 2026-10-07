"use client";

import { motion } from "framer-motion";
import { CreditCard, EyeOff, ShieldCheck, Timer } from "lucide-react";
import { Eyebrow, SerifEm } from "./v2/primitives";

const items = [
  {
    icon: CreditCard,
    title: "Never sees a card",
    body: "Shoppers always pay on your own checkout. Card details never touch us.",
  },
  {
    icon: Timer,
    title: "Conversations auto-delete",
    body: "Transcripts are removed after 24 hours. You keep the outcomes, not the chatter.",
  },
  {
    icon: ShieldCheck,
    title: "Only asks what it needs",
    body: "Contact details are collected only when a shopper asks for help or checks out — and sent to you, not sold.",
  },
  {
    icon: EyeOff,
    title: "Your shoppers stay yours",
    body: "No sharing between stores and no training other brands' assistants on your data.",
  },
];

export function Privacy() {
  return (
    <section className="relative pb-24 pt-8 md:pb-32 md:pt-12">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center lg:gap-20">
          <div>
            <Eyebrow tone="signal">Privacy & trust</Eyebrow>
            <h2 className="mt-5 font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.03em] text-balance md:text-[3.25rem]">
              Built to be trusted <SerifEm>by your shoppers.</SerifEm>
            </h2>
            <p className="mt-5 max-w-lg text-[17px] leading-relaxed text-text-secondary text-pretty md:text-lg">
              The short answer for your security review:{" "}
              <span className="text-text-primary">we never handle payment, we keep conversations for a day, and your customers&apos; data stays yours.</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((it, i) => (
              <motion.div
                key={it.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="card-v2 card-v2-hover p-5"
              >
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-signal-soft text-signal">
                  <it.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 font-medium tracking-tight">{it.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{it.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
