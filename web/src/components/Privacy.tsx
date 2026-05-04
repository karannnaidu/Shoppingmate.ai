"use client";

import { motion } from "framer-motion";
import { Lock, Timer, KeyRound, EyeOff } from "lucide-react";

const items = [
  {
    icon: Lock,
    title: "No card data, ever",
    body: "Payment is always a redirect to your native checkout. We are never in PCI scope.",
  },
  {
    icon: Timer,
    title: "24-hour transcript expiry",
    body: "Conversation logs auto-purge from Redis. S3 audio blobs deleted after 7 days.",
  },
  {
    icon: KeyRound,
    title: "Permanent overrides",
    body: "Locked selectors are immune to auto-recrawl. Your edits survive every healing pass.",
  },
  {
    icon: EyeOff,
    title: "No cross-merchant sharing",
    body: "Your visitors, your data. No shared model fine-tuning, no cross-sell across stores.",
  },
];

export function Privacy() {
  return (
    <section className="relative py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20 lg:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-elevated px-3 py-1 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
              <span className="h-1 w-1 rounded-full bg-cyan" />
              Privacy posture
            </span>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight md:text-5xl text-balance">
              Trust isn&apos;t a feature.{" "}
              <span className="gradient-text">It&apos;s the architecture.</span>
            </h2>
            <p className="mt-5 max-w-lg text-text-secondary md:text-lg text-pretty">
              Designed so you can answer the only question that matters from your
              security review in one sentence: <span className="text-text-primary">we never see the card, the order, or the customer&apos;s session.</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {items.map((it, i) => (
              <motion.div
                key={it.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="rounded-2xl border border-border bg-surface-elevated p-5"
              >
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-surface-muted text-text-secondary">
                  <it.icon className="h-4 w-4" />
                </div>
                <h3 className="mt-4 font-medium tracking-tight">{it.title}</h3>
                <p className="mt-1.5 text-sm text-text-secondary">{it.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
