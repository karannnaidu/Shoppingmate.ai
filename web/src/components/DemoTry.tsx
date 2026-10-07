"use client";

import { motion } from "framer-motion";
import { Mic, MessageCircle, ShoppingBag, Sparkles } from "lucide-react";

const prompts = [
  "Show me your pricing",
  "How fast is install?",
  "What platforms do you support?",
  "I need a gift for my sister — under $50",
  "How is privacy handled?",
];

const capabilities = [
  {
    icon: Mic,
    title: "Talk out loud",
    body: "Tap Call in the bottom corner. Olivia listens, answers and moves around the site with you.",
  },
  {
    icon: MessageCircle,
    title: "Or just type",
    body: "Prefer typing? Same Olivia, same memory — switch whenever you like.",
  },
  {
    icon: ShoppingBag,
    title: "Real products",
    body: "Ask for a shopping tour and Olivia pulls real products from a demo store.",
  },
];

export function DemoTry() {
  return (
    <section className="relative py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5 }}
            className="grid gap-5"
          >
            <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
              Try asking one of these.
            </h2>
            <p className="text-text-secondary md:text-lg">
              Tap the button in the bottom corner of this page. Olivia answers, opens the
              right page and points out what you asked about — no sales call needed.
            </p>

            <ul className="mt-2 grid gap-2.5">
              {prompts.map((p, i) => (
                <motion.li
                  key={p}
                  initial={{ opacity: 0, x: -8 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.04 }}
                  className="card-v2 card-v2-hover flex items-center gap-3 px-4 py-3 text-sm text-text-primary"
                >
                  <Sparkles className="h-4 w-4 text-violet" aria-hidden />
                  &ldquo;{p}&rdquo;
                </motion.li>
              ))}
            </ul>
          </motion.div>

          <div className="grid gap-4">
            {capabilities.map((c, i) => (
              <motion.div
                key={c.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="card-v2 flex gap-4 p-6"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-signal-soft">
                  <c.icon className="h-5 w-5 text-signal" />
                </div>
                <div>
                  <h3 className="font-display text-base font-semibold tracking-tight">
                    {c.title}
                  </h3>
                  <p className="mt-1.5 text-sm text-text-secondary">{c.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
